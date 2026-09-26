const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

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
    const { rows } = await pool.query(
      `INSERT INTO transport_routes (institution_id, name, vehicle_id, morning_start_time, afternoon_start_time)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.auth.institution_id, name, vehicle_id || null, morning_start_time || null, afternoon_start_time || null]
    );
    res.json({ success: true, route: rows[0] });
  } catch (err) {
    console.error('[transport] route create failed:', err);
    res.status(500).json({ error: 'Failed to create route' });
  }
});

router.get('/routes', requireAuth, requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, v.vehicle_number,
              (SELECT count(*) FROM student_transport st WHERE st.route_id = r.id AND st.is_active)::int AS student_count
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
    const { rows } = await pool.query(
      `SELECT * FROM transport_stops WHERE route_id = $1 ORDER BY sequence`, [req.params.routeId]);
    res.json({ stops: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load stops' }); }
});

// --- Student assignments ---
router.post('/assign', requireAuth, requireRole('admin', 'opsadmin'), requireTenant, async (req, res) => {
  const { student_id, route_id, stop_id, transport_fee } = req.body;
  if (!student_id || !route_id) return res.status(400).json({ error: 'student_id and route_id required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO student_transport (student_id, route_id, stop_id, transport_fee)
       VALUES ($1,$2,$3,$4) ON CONFLICT (student_id, route_id) DO UPDATE SET stop_id = $3, transport_fee = $4, is_active = true
       RETURNING *`,
      [student_id, route_id, stop_id || null, transport_fee || null]
    );
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
        WHERE st.student_id = $1 AND st.is_active = true`,
      [req.params.studentId]
    );
    res.json({ transport: rows[0] || null });
  } catch (err) { res.status(500).json({ error: 'Failed to load transport info' }); }
});

module.exports = router;
