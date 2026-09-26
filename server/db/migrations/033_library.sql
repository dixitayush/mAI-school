-- 033: Library management
-- PRD section 34

CREATE TABLE IF NOT EXISTS library_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  category TEXT,
  publisher TEXT,
  publish_year INTEGER,
  description TEXT,
  cover_image_id UUID,
  total_copies INTEGER NOT NULL DEFAULT 1,
  available_copies INTEGER NOT NULL DEFAULT 1,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_books_institution ON library_books (institution_id);
CREATE INDEX IF NOT EXISTS idx_library_books_search ON library_books (institution_id, title, author);

CREATE TABLE IF NOT EXISTS library_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES users(id),
  issued_by UUID REFERENCES users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date DATE NOT NULL,
  returned_at TIMESTAMPTZ,
  returned_to UUID REFERENCES users(id),
  fine_amount NUMERIC(10,2) DEFAULT 0,
  fine_paid BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('issued', 'returned', 'overdue', 'lost')) DEFAULT 'issued'
);

CREATE INDEX IF NOT EXISTS idx_library_tx_institution ON library_transactions (institution_id, status);
CREATE INDEX IF NOT EXISTS idx_library_tx_borrower ON library_transactions (borrower_id);
CREATE INDEX IF NOT EXISTS idx_library_tx_book ON library_transactions (book_id);
CREATE INDEX IF NOT EXISTS idx_library_tx_overdue ON library_transactions (due_date) WHERE status = 'issued';

CREATE TABLE IF NOT EXISTS library_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
