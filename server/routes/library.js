const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');
const { logAudit } = require('../lib/audit');

const router = express.Router();
const pool = getAppPool();

/** Late fee per day, in the school's currency. */
const FINE_PER_DAY = Number(process.env.LIBRARY_FINE_PER_DAY) || 1;

// CRUD for books
router.post('/', requireAuth, requireRole('admin', 'principal', 'teacher'), requireTenant, async (req, res) => {
  const { title, author, isbn, category, publisher, publish_year, description, total_copies, location } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const copies = Math.max(1, Number(total_copies) || 1);
    const { rows } = await pool.query(
      `INSERT INTO library_books (institution_id, title, author, isbn, category, publisher, publish_year, description, total_copies, available_copies, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10) RETURNING *`,
      [req.auth.institution_id, title, author || null, isbn || null, category || null, publisher || null, publish_year || null, description || null, copies, location || null]
    );
    res.json({ success: true, book: rows[0] });
  } catch (err) {
    console.error('[library] create failed:', err);
    res.status(500).json({ error: 'Failed to add book' });
  }
});

router.get('/', requireAuth, requireTenant, async (req, res) => {
  // The catalog screen sends `q`; `search` is kept for existing callers.
  const search = req.query.search || req.query.q;
  const { category, page } = req.query;
  const limit = 50;
  const offset = Math.max(0, (Number(page) || 1) - 1) * limit;
  try {
    let query = `SELECT * FROM library_books WHERE institution_id = $1`;
    const params = [req.auth.institution_id];
    let idx = 2;
    if (search) { query += ` AND (title ILIKE $${idx} OR author ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (category) { query += ` AND category = $${idx++}`; params.push(category); }
    query += ` ORDER BY title ASC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
    const { rows } = await pool.query(query, params);
    res.json({ books: rows });
  } catch (err) {
    console.error('[library] list failed:', err);
    res.status(500).json({ error: 'Failed to load books' });
  }
});

// Issue book
router.post('/issue', requireAuth, requireRole('admin', 'teacher'), requireTenant, async (req, res) => {
  const { book_id, borrower_id, due_date } = req.body;
  if (!book_id || !borrower_id || !due_date) {
    return res.status(400).json({ error: 'book_id, borrower_id, and due_date are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const book = await client.query(
      `SELECT available_copies FROM library_books WHERE id = $1 AND institution_id = $2 FOR UPDATE`,
      [book_id, req.auth.institution_id]
    );
    if (book.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Book not found' }); }
    if (book.rows[0].available_copies <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No copies available' }); }

    const borrower = await client.query(
      'SELECT id FROM users WHERE id = $1 AND institution_id = $2',
      [borrower_id, req.auth.institution_id]
    );
    if (borrower.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Unknown borrower' });
    }

    const { rows } = await client.query(
      `INSERT INTO library_transactions (institution_id, book_id, borrower_id, issued_by, due_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.auth.institution_id, book_id, borrower_id, req.auth.user_id, due_date]
    );
    await client.query(
      `UPDATE library_books SET available_copies = available_copies - 1, updated_at = NOW() WHERE id = $1`,
      [book_id]
    );
    await client.query('COMMIT');
    await logAudit(pool, req.auth, {
      action: 'library.issue',
      entityType: 'library_transaction',
      entityId: rows[0].id,
      metadata: { book_id, borrower_id },
    });
    res.json({ success: true, transaction: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[library] issue failed:', err);
    res.status(500).json({ error: 'Issue failed' });
  } finally {
    client.release();
  }
});

// Return book
router.post('/return', requireAuth, requireRole('admin', 'teacher'), requireTenant, async (req, res) => {
  const { transaction_id } = req.body;
  if (!transaction_id) return res.status(400).json({ error: 'transaction_id is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = await client.query(
      `SELECT * FROM library_transactions WHERE id = $1 AND institution_id = $2 AND status = 'issued' FOR UPDATE`,
      [transaction_id, req.auth.institution_id]
    );
    if (tx.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Transaction not found or already returned' }); }

    // Late returns carry a per-day fine so the overdue list clears with a balance.
    const dueDate = new Date(tx.rows[0].due_date);
    const daysLate = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86400000));
    const fine = Number((daysLate * FINE_PER_DAY).toFixed(2));

    const updated = await client.query(
      `UPDATE library_transactions
          SET status = 'returned', returned_at = NOW(), returned_to = $1,
              fine_amount = $3::numeric, fine_paid = ($3::numeric = 0)
        WHERE id = $2 RETURNING *`,
      [req.auth.user_id, transaction_id, fine]
    );
    await client.query(
      `UPDATE library_books SET available_copies = LEAST(total_copies, available_copies + 1), updated_at = NOW()
        WHERE id = $1`,
      [tx.rows[0].book_id]
    );
    await client.query('COMMIT');
    await logAudit(pool, req.auth, {
      action: 'library.return',
      entityType: 'library_transaction',
      entityId: transaction_id,
      metadata: { days_late: daysLate, fine },
    });
    res.json({ success: true, days_late: daysLate, fine_amount: fine, transaction: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[library] return failed:', err);
    res.status(500).json({ error: 'Return failed' });
  } finally {
    client.release();
  }
});

// Overdue books
router.get('/overdue', requireAuth, requireRole('admin', 'teacher'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT lt.*, lb.title AS book_title, u.full_name AS borrower_name, u.role AS borrower_role,
              (CURRENT_DATE - lt.due_date)::int AS days_overdue,
              ((CURRENT_DATE - lt.due_date) * $2::numeric)::float AS accrued_fine
         FROM library_transactions lt
         JOIN library_books lb ON lb.id = lt.book_id
         JOIN users u ON u.id = lt.borrower_id
        WHERE lt.institution_id = $1 AND lt.status = 'issued' AND lt.due_date < CURRENT_DATE
        ORDER BY lt.due_date ASC`,
      [req.auth.institution_id, FINE_PER_DAY]
    );
    res.json({ overdue: rows });
  } catch (err) {
    console.error('[library] overdue failed:', err);
    res.status(500).json({ error: 'Failed to load overdue' });
  }
});

// Borrowing history for a user
router.get('/history/:userId', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT lt.*, lb.title AS book_title, lb.author
         FROM library_transactions lt
         JOIN library_books lb ON lb.id = lt.book_id
        WHERE lt.borrower_id = $1 AND lt.institution_id = $2
        ORDER BY lt.issued_at DESC LIMIT 50`,
      [req.params.userId, req.auth.institution_id]
    );
    res.json({ history: rows });
  } catch (err) {
    console.error('[library] history failed:', err);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// Current loans — drives the "Issued" tab and the return action.
router.get('/transactions', requireAuth, requireTenant, async (req, res) => {
  const status = req.query.status || 'issued';
  try {
    const { rows } = await pool.query(
      `SELECT lt.*, lb.title AS book_title, lb.author, u.full_name AS borrower_name, u.role AS borrower_role,
              GREATEST(0, CURRENT_DATE - lt.due_date)::int AS days_overdue
         FROM library_transactions lt
         JOIN library_books lb ON lb.id = lt.book_id
         JOIN users u ON u.id = lt.borrower_id
        WHERE lt.institution_id = $1 AND ($2 = 'all' OR lt.status = $2)
        ORDER BY lt.issued_at DESC
        LIMIT 200`,
      [req.auth.institution_id, status]
    );
    res.json({ transactions: rows });
  } catch (err) {
    console.error('[library] transactions failed:', err);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

// Who a book can be issued to — lets the UI offer names instead of raw UUIDs.
router.get('/borrowers', requireAuth, requireRole('admin', 'principal', 'teacher'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.role,
              COALESCE(c.name, '') AS class_name,
              COALESCE(s.roll_number, '') AS roll_number,
              s.registration_id
         FROM users u
         LEFT JOIN students s ON s.user_id = u.id
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE u.institution_id = $1 AND u.role IN ('student', 'teacher')
        ORDER BY u.role, u.full_name`,
      [req.auth.institution_id]
    );
    res.json({ borrowers: rows });
  } catch (err) {
    console.error('[library] borrowers failed:', err);
    res.status(500).json({ error: 'Failed to load borrowers' });
  }
});

// Dashboard stats
router.get('/stats', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         (SELECT count(*) FROM library_books WHERE institution_id = $1)::int AS total_books,
         (SELECT sum(total_copies) FROM library_books WHERE institution_id = $1)::int AS total_copies,
         (SELECT count(*) FROM library_transactions WHERE institution_id = $1 AND status = 'issued')::int AS issued,
         (SELECT count(*) FROM library_transactions WHERE institution_id = $1 AND status = 'issued' AND due_date < CURRENT_DATE)::int AS overdue,
         (SELECT COALESCE(sum(available_copies), 0) FROM library_books WHERE institution_id = $1)::int AS available,
         (SELECT COALESCE(sum(fine_amount), 0) FROM library_transactions WHERE institution_id = $1 AND fine_paid = false)::float AS unpaid_fines`,
      [req.auth.institution_id]
    );
    res.json({ stats: { ...rows[0], total_copies: rows[0].total_copies || 0 } });
  } catch (err) {
    console.error('[library] stats failed:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
