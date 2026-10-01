"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Bus, Plus, Loader2, X, MapPin, UserPlus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

/** Mirrors the transport_vehicles.vehicle_type CHECK constraint (migration 034). */
const VEHICLE_TYPES = [
  { value: "bus", label: "Bus" },
  { value: "van", label: "Van" },
  { value: "car", label: "Car" },
  { value: "other", label: "Other" },
];

const EMPTY_VEHICLE = {
  vehicle_number: "",
  vehicle_type: "bus",
  capacity: "",
  driver_name: "",
  driver_phone: "",
  attendant_name: "",
  attendant_phone: "",
};
const EMPTY_ROUTE = { name: "", vehicle_id: "", morning_start_time: "", afternoon_start_time: "" };
const EMPTY_STOP = { name: "", sequence: 1, pickup_time: "", drop_time: "" };
const EMPTY_ASSIGN = { student_id: "", route_id: "", stop_id: "", transport_fee: "" };

export default function TransportPage() {
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [stopsByRoute, setStopsByRoute] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("vehicles");
  const [showAdd, setShowAdd] = useState(false);
  const [vForm, setVForm] = useState(EMPTY_VEHICLE);
  const [rForm, setRForm] = useState(EMPTY_ROUTE);
  const [stopForRoute, setStopForRoute] = useState(null);
  const [stopForm, setStopForm] = useState(EMPTY_STOP);
  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vData, rData, aData] = await Promise.all([
        apiFetch("/api/transport/vehicles"),
        apiFetch("/api/transport/routes"),
        apiFetch("/api/transport/assignments"),
      ]);
      setVehicles(vData.vehicles || []);
      setRoutes(rData.routes || []);
      setAssignments(aData.assignments || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Students are only needed on the assignment tab.
  useEffect(() => {
    if (tab !== "students" || students.length > 0) return;
    apiFetch("/api/students?limit=1000")
      .then((d) => setStudents(d.students || []))
      .catch((err) => toast.error(err.message));
  }, [tab, students.length]);

  const loadStops = useCallback(async (routeId) => {
    try {
      const data = await apiFetch(`/api/transport/routes/${routeId}/stops`);
      setStopsByRoute((m) => ({ ...m, [routeId]: data.stops || [] }));
      return data.stops || [];
    } catch (err) {
      toast.error(err.message);
      return [];
    }
  }, []);

  const addVehicle = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/transport/vehicles", {
        method: "POST",
        body: { ...vForm, capacity: vForm.capacity ? Number(vForm.capacity) : null },
      });
      toast.success("Vehicle added");
      setShowAdd(false);
      setVForm(EMPTY_VEHICLE);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const addRoute = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/transport/routes", {
        method: "POST",
        body: {
          name: rForm.name,
          vehicle_id: rForm.vehicle_id || null,
          morning_start_time: rForm.morning_start_time || null,
          afternoon_start_time: rForm.afternoon_start_time || null,
        },
      });
      toast.success("Route added");
      setShowAdd(false);
      setRForm(EMPTY_ROUTE);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const addStop = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/transport/routes/${stopForRoute.id}/stops`, {
        method: "POST",
        body: {
          name: stopForm.name,
          sequence: Number(stopForm.sequence) || 1,
          pickup_time: stopForm.pickup_time || null,
          drop_time: stopForm.drop_time || null,
        },
      });
      toast.success("Stop added");
      await loadStops(stopForRoute.id);
      setStopForm({ ...EMPTY_STOP, sequence: Number(stopForm.sequence) + 1 });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const assignStudent = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/transport/assign", {
        method: "POST",
        body: {
          student_id: assignForm.student_id,
          route_id: assignForm.route_id,
          stop_id: assignForm.stop_id || null,
          transport_fee: assignForm.transport_fee ? Number(assignForm.transport_fee) : null,
        },
      });
      toast.success("Student assigned");
      setAssignForm(EMPTY_ASSIGN);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const unassign = async (id) => {
    try {
      await apiFetch(`/api/transport/assign/${id}`, { method: "DELETE" });
      toast.success("Assignment removed");
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openStops = async (route) => {
    setStopForRoute(route);
    const stops = await loadStops(route.id);
    setStopForm({ ...EMPTY_STOP, sequence: stops.length + 1 });
  };

  const inputCls =
    "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const tabCls = (t) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      tab === t ? "bg-primary-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100"
    }`;

  const assignRouteStops = stopsByRoute[assignForm.route_id] || [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <Bus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Transport</h1>
            <p className="text-sm text-zinc-500">Vehicles, routes, stops and student assignments.</p>
          </div>
        </div>
        {tab !== "students" && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Add {tab === "vehicles" ? "Vehicle" : "Route"}
          </button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={vehicles.length} label="Vehicles" />
        <Stat value={routes.length} label="Routes" />
        <Stat value={routes.reduce((n, r) => n + (r.stop_count || 0), 0)} label="Stops" />
        <Stat value={assignments.length} label="Students Riding" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setTab("vehicles");
            setShowAdd(false);
          }}
          className={tabCls("vehicles")}
        >
          Vehicles
        </button>
        <button
          onClick={() => {
            setTab("routes");
            setShowAdd(false);
          }}
          className={tabCls("routes")}
        >
          Routes &amp; Stops
        </button>
        <button
          onClick={() => {
            setTab("students");
            setShowAdd(false);
          }}
          className={tabCls("students")}
        >
          Student Assignments
        </button>
      </div>

      {showAdd && tab === "vehicles" && (
        <Card title="Add Vehicle" onClose={() => setShowAdd(false)}>
          <form onSubmit={addVehicle} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Vehicle Number">
              <input
                required
                value={vForm.vehicle_number}
                onChange={(e) => setVForm((f) => ({ ...f, vehicle_number: e.target.value }))}
                className={inputCls}
                placeholder="e.g. KA-01-AB-1234"
              />
            </Field>
            <Field label="Type">
              <select
                value={vForm.vehicle_type}
                onChange={(e) => setVForm((f) => ({ ...f, vehicle_type: e.target.value }))}
                className={inputCls}
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Capacity">
              <input
                type="number"
                min="1"
                value={vForm.capacity}
                onChange={(e) => setVForm((f) => ({ ...f, capacity: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Driver Name">
              <input
                value={vForm.driver_name}
                onChange={(e) => setVForm((f) => ({ ...f, driver_name: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Driver Phone">
              <input
                value={vForm.driver_phone}
                onChange={(e) => setVForm((f) => ({ ...f, driver_phone: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Attendant Name">
              <input
                value={vForm.attendant_name}
                onChange={(e) => setVForm((f) => ({ ...f, attendant_name: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Attendant Phone">
              <input
                value={vForm.attendant_phone}
                onChange={(e) => setVForm((f) => ({ ...f, attendant_phone: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <div className="flex items-end sm:col-span-2">
              <SubmitButton submitting={submitting}>Add Vehicle</SubmitButton>
            </div>
          </form>
        </Card>
      )}

      {showAdd && tab === "routes" && (
        <Card title="Add Route" onClose={() => setShowAdd(false)}>
          <form onSubmit={addRoute} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Route Name">
              <input
                required
                value={rForm.name}
                onChange={(e) => setRForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder="e.g. North Line"
              />
            </Field>
            <Field label="Vehicle">
              <select
                value={rForm.vehicle_id}
                onChange={(e) => setRForm((f) => ({ ...f, vehicle_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">Unassigned</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicle_number}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Morning start">
              <input
                type="time"
                value={rForm.morning_start_time}
                onChange={(e) => setRForm((f) => ({ ...f, morning_start_time: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Afternoon start">
              <input
                type="time"
                value={rForm.afternoon_start_time}
                onChange={(e) => setRForm((f) => ({ ...f, afternoon_start_time: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <div className="sm:col-span-4">
              <SubmitButton submitting={submitting}>Add Route</SubmitButton>
            </div>
          </form>
        </Card>
      )}

      {stopForRoute && (
        <Card title={`Stops — ${stopForRoute.name}`} onClose={() => setStopForRoute(null)}>
          <div className="mb-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {(stopsByRoute[stopForRoute.id] || []).length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-400">No stops yet.</p>
            ) : (
              (stopsByRoute[stopForRoute.id] || []).map((st) => (
                <div key={st.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="flex items-center gap-2 font-medium text-zinc-800">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs text-zinc-600">
                      {st.sequence}
                    </span>
                    {st.name}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {st.pickup_time ? `Pickup ${st.pickup_time}` : "—"}
                    {st.drop_time ? ` · Drop ${st.drop_time}` : ""}
                  </span>
                </div>
              ))
            )}
          </div>
          <form onSubmit={addStop} className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <Field label="Stop name">
              <input
                required
                value={stopForm.name}
                onChange={(e) => setStopForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Sequence">
              <input
                type="number"
                min="1"
                value={stopForm.sequence}
                onChange={(e) => setStopForm((f) => ({ ...f, sequence: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Pickup time">
              <input
                type="time"
                value={stopForm.pickup_time}
                onChange={(e) => setStopForm((f) => ({ ...f, pickup_time: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Drop time">
              <input
                type="time"
                value={stopForm.drop_time}
                onChange={(e) => setStopForm((f) => ({ ...f, drop_time: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <div className="flex items-end">
              <SubmitButton submitting={submitting}>Add Stop</SubmitButton>
            </div>
          </form>
        </Card>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : tab === "vehicles" ? (
          vehicles.length === 0 ? (
            <Empty>No vehicles registered.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <Head cols={["Number", "Type", "Capacity", "Driver", "Phone", "Attendant"]} />
                <tbody className="divide-y divide-zinc-100">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-800">{v.vehicle_number}</td>
                      <td className="px-4 py-3 capitalize text-zinc-600">{v.vehicle_type}</td>
                      <td className="px-4 py-3 text-zinc-600">{v.capacity ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{v.driver_name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">{v.driver_phone || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">{v.attendant_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "routes" ? (
          routes.length === 0 ? (
            <Empty>No routes configured.</Empty>
          ) : (
            <div className="divide-y divide-zinc-100">
              {routes.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-zinc-50">
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{r.name}</p>
                    <p className="text-xs text-zinc-500">
                      {r.vehicle_number ? `${r.vehicle_number}` : "No vehicle"}
                      {r.driver_name ? ` · ${r.driver_name}` : ""}
                      {r.morning_start_time ? ` · AM ${r.morning_start_time}` : ""}
                      {r.afternoon_start_time ? ` · PM ${r.afternoon_start_time}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                      {r.stop_count ?? 0} stops
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {r.student_count ?? 0} students
                    </span>
                    <button
                      onClick={() => openStops(r)}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100"
                    >
                      <MapPin className="h-3.5 w-3.5" /> Manage stops
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="p-5">
            <form onSubmit={assignStudent} className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-5">
              <Field label="Student">
                <select
                  required
                  value={assignForm.student_id}
                  onChange={(e) => setAssignForm((f) => ({ ...f, student_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select student…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                      {s.class_name ? ` — ${s.class_name}${s.section ? `/${s.section}` : ""}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Route">
                <select
                  required
                  value={assignForm.route_id}
                  onChange={(e) => {
                    const route_id = e.target.value;
                    setAssignForm((f) => ({ ...f, route_id, stop_id: "" }));
                    if (route_id && !stopsByRoute[route_id]) loadStops(route_id);
                  }}
                  className={inputCls}
                >
                  <option value="">Select route…</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stop">
                <select
                  value={assignForm.stop_id}
                  onChange={(e) => setAssignForm((f) => ({ ...f, stop_id: e.target.value }))}
                  className={inputCls}
                  disabled={!assignForm.route_id}
                >
                  <option value="">No specific stop</option>
                  {assignRouteStops.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.sequence}. {st.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Monthly fee (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={assignForm.transport_fee}
                  onChange={(e) => setAssignForm((f) => ({ ...f, transport_fee: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <div className="flex items-end">
                <SubmitButton submitting={submitting} icon={<UserPlus className="h-4 w-4" />}>
                  Assign
                </SubmitButton>
              </div>
            </form>

            {assignments.length === 0 ? (
              <Empty>No students assigned to transport yet.</Empty>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full text-sm">
                  <Head cols={["Student", "Class", "Route", "Stop", "Vehicle", "Fee", ""]} />
                  <tbody className="divide-y divide-zinc-100">
                    {assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-800">{a.student_name}</td>
                        <td className="px-4 py-3 text-zinc-500">{a.class_name || "—"}</td>
                        <td className="px-4 py-3 text-zinc-600">{a.route_name}</td>
                        <td className="px-4 py-3 text-zinc-500">{a.stop_name || "—"}</td>
                        <td className="px-4 py-3 text-zinc-500">{a.vehicle_number || "—"}</td>
                        <td className="px-4 py-3 text-zinc-600">
                          {a.transport_fee ? `₹${Number(a.transport_fee).toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => unassign(a.id)}
                            title="Remove"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function Card({ title, onClose, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </motion.div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label>
      {children}
    </div>
  );
}

function SubmitButton({ submitting, children, icon }) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
    >
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : icon} {children}
    </button>
  );
}

function Head({ cols }) {
  return (
    <thead>
      <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {cols.map((c, i) => (
          <th key={i} className="px-4 py-3">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Empty({ children }) {
  return <div className="py-16 text-center text-sm text-zinc-400">{children}</div>;
}
