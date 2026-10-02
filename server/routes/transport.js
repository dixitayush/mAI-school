const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');
const { logAudit } = require('../lib/audit');

const router = express.Router();
const pool = getAppPool();

/** transport_stops / student_transport have no institution_id, so every
 *  route-scoped request has to prove the route belongs to the caller's tenant. */
async function assertRouteInTenant(routeId, institutionId) {
  const { rows } = await pool.query(
    'SELECT id FROM transport_routes WHERE id = $1 AND institution_id = $2',
    [routeId, institutionId]
  );
  return rows.length > 0;
}

// --- Vehicles ---
router.post('/vehicles', requireAuth, requireRole('admin', 'opsadmin'), requireTenant, async (req, res) => {
  const { vehicle_number, vehicle_type, capacity, driver_name, driver_phone, attendant_name, attendant_phone } = req.body;
  if (!vehicle_number) return res.status(400).json({ error: 'vehicle_number is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO transport_vehicles (institution_id, vehicle_number, vehicle_type, capacity, driver_name, driver_phone, attendant_name, attendant_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.auth.institution_id, vehicle_number, vehicle_type || 'bus', capacity || null, driver_name || null, driver_phone || null, attendant_name || null, attendant_phone || null]
    );
    await logAudit(pool, req.auth, {
      action: 'transport.vehicle.create',
      entityType: 'transport_vehicle',
      entityId: rows[0].id,
    });
    res.json({ success: true, vehicle: rows[0] });
  } catch (err) {
    console.error('[transport] vehicle create failed:', err);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

router.get('/vehicles', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM transport_vehicles WHERE institution_id = $1 ORDER BY vehicle_number`, [req.auth.institution_id]);
    res.json({ vehicles: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load vehicles' }); }
});

// --- Routes ---
router.post('/routes', requireAuth, requireRole('admin', 'opsadmin'), requireTenant, async (req, res) => {
  const { name, vehicle_id, morning_start_time, afternoon_start_time } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    if (vehicle_id) {
      const v = await pool.query(
        'SELECT id FROM transport_vehicles WHERE id = $1 AND institution_id = $2',
        [vehicle_id, req.auth.institution_id]
      );
      if (v.rows.length === 0) return res.status(400).json({ error: 'Unknown vehicle' });
    }
    const { rows } = await pool.query(
      `INSERT INTO transport_routes (institution_id, name, vehicle_id, morning_start_time, afternoon_start_time)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.auth.institution_id, name, vehicle_id || null, morning_start_time || null, afternoon_start_time || null]
    );
    await logAudit(pool, req.auth, {
      action: 'transport.route.create',
      entityType: 'transport_route',
      entityId: rows[0].id,
    });
    res.json({ success: true, route: rows[0] });
  } catch (err) {
    console.error('[transport] route create failed:', err);
    res.status(500).json({ error: 'Failed to create route' });
  }
});

router.get('/routes', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, v.vehicle_number, v.driver_name, v.driver_phone, v.capacity,
              (SELECT count(*) FROM student_transport st WHERE st.route_id = r.id AND st.is_active)::int AS student_count,
              (SELECT count(*) FROM transport_stops ts WHERE ts.route_id = r.id)::int AS stop_count
         FROM transport_routes r
         LEFT JOIN transport_vehicles v ON v.id = r.vehicle_id
        WHERE r.institution_id = $1 ORDER BY r.name`, [req.auth.institution_id]);
    res.json({ routes: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load routes' }); }
});

// --- Stops ---
router.post('/routes/:routeId/stops', requireAuth, requireRole('admin', 'opsadmin'), requireTenant, async (req, res) => {
  const { name, sequence, pickup_time, drop_time, latitude, longitude } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    if (!(await assertRouteInTenant(req.params.routeId, req.auth.institution_id))) {
      return res.status(404).json({ error: 'Route not found' });
    }
    const { rows } = await pool.query(
      `INSERT INTO transport_stops (route_id, name, sequence, pickup_time, drop_time, latitude, longitude)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.routeId, name, sequence || 0, pickup_time || null, drop_time || null, latitude || null, longitude || null]
    );
    res.json({ success: true, stop: rows[0] });
  } catch (err) {
    console.error('[transport] stop create failed:', err);
    res.status(500).json({ error: 'Failed to add stop' });
  }
});

router.get('/routes/:routeId/stops', requireAuth, requireTenant, async (req, res) => {
  try {
    if (!(await assertRouteInTenant(req.params.routeId, req.auth.institution_id))) {
      return res.status(404).json({ error: 'Route not found' });
    }
    const { rows } = await pool.query(
      `SELECT * FROM transport_stops WHERE route_id = $1 ORDER BY sequence`, [req.params.routeId]);
    res.json({ stops: rows });
  } catch (err) {
    console.error('[transport] stops list failed:', err);
    res.status(500).json({ error: 'Failed to load stops' });
  }
});

// Every student assigned to transport, for the admin roster view.
router.get('/assignments', requireAuth, requireRole('admin', 'opsadmin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT st.id, st.student_id, st.route_id, st.stop_id, st.transport_fee, st.is_active,
              u.full_name AS student_name, s.registration_id, s.roll_number, c.name AS class_name,
              r.name AS route_name, ts.name AS stop_name, ts.pickup_time, ts.drop_time,
              v.vehicle_number
         FROM student_transport st
         JOIN students s ON s.id = st.student_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN classes c ON c.id = s.class_id
         JOIN transport_routes r ON r.id = st.route_id
         LEFT JOIN transport_stops ts ON ts.id = st.stop_id
         LEFT JOIN transport_vehicles v ON v.id = r.vehicle_id
        WHERE r.institution_id = $1
        ORDER BY r.name, u.full_name`,
      [req.auth.institution_id]
    );
    res.json({ assignments: rows });
  } catch (err) {
    console.error('[transport] assignments failed:', err);
    res.status(500).json({ error: 'Failed to load assignments' });
  }
});

// Remove a student from a route.
router.delete('/assign/:id', requireAuth, requireRole('admin', 'opsadmin'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM student_transport st
         USING transport_routes r
        WHERE st.id = $1 AND r.id = st.route_id AND r.institution_id = $2
        RETURNING st.id`,
      [req.params.id, req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    await logAudit(pool, req.auth, {
      action: 'transport.unassign',
      entityType: 'student_transport',
      entityId: req.params.id,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[transport] unassign failed:', err);
    res.status(500).json({ error: 'Failed to remove assignment' });
  }
});

// --- Student assignments ---
router.post('/assign', requireAuth, requireRole('admin', 'opsadmin'), requireTenant, async (req, res) => {
  const { student_id, route_id, stop_id, transport_fee } = req.body;
  if (!student_id || !route_id) return res.status(400).json({ error: 'student_id and route_id required' });
  try {
    if (!(await assertRouteInTenant(route_id, req.auth.institution_id))) {
      return res.status(400).json({ error: 'Unknown route' });
    }
    const student = await pool.query(
      `SELECT s.id FROM students s JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND u.institution_id = $2`,
      [student_id, req.auth.institution_id]
    );
    if (student.rows.length === 0) return res.status(400).json({ error: 'Unknown student' });
    if (stop_id) {
      const stop = await pool.query('SELECT id FROM transport_stops WHERE id = $1 AND route_id = $2', [
        stop_id,
        route_id,
      ]);
      if (stop.rows.length === 0) return res.status(400).json({ error: 'Stop does not belong to that route' });
    }
    const { rows } = await pool.query(
      `INSERT INTO student_transport (student_id, route_id, stop_id, transport_fee)
       VALUES ($1,$2,$3,$4) ON CONFLICT (student_id, route_id) DO UPDATE SET stop_id = $3, transport_fee = $4, is_active = true
       RETURNING *`,
      [student_id, route_id, stop_id || null, transport_fee || null]
    );
    await logAudit(pool, req.auth, {
      action: 'transport.assign',
      entityType: 'student_transport',
      entityId: rows[0].id,
      metadata: { student_id, route_id },
    });
    res.json({ success: true, assignment: rows[0] });
  } catch (err) {
    console.error('[transport] assign failed:', err);
    res.status(500).json({ error: 'Assignment failed' });
  }
});

// Parent view: child's transport info
router.get('/student/:studentId', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT st.*, r.name AS route_name, v.vehicle_number, v.driver_name, v.driver_phone,
              s.name AS stop_name, s.pickup_time, s.drop_time
         FROM student_transport st
         JOIN transport_routes r ON r.id = st.route_id
         LEFT JOIN transport_vehicles v ON v.id = r.vehicle_id
         LEFT JOIN transport_stops s ON s.id = st.stop_id
        WHERE st.student_id = $1 AND st.is_active = true AND r.institution_id = $2`,
      [req.params.studentId, req.auth.institution_id]
    );
    res.json({ transport: rows[0] || null });
  } catch (err) { res.status(500).json({ error: 'Failed to load transport info' }); }
});

module.exports = router;
