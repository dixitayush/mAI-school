"use client";

import { useState } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, X } from "lucide-react";
import DataTable from "@/components/DataTable";
import { getInstitutionIdFromStorage } from "@/lib/tenant";

const GET_HOLIDAYS = gql`
  query GetHolidays {
    allHolidays(orderBy: START_DATE_ASC) {
      nodes {
        id
        title
        startDate
        endDate
        type
        description
      }
    }
  }
`;

const CREATE_HOLIDAY = gql`
  mutation CreateHoliday(
    $institutionId: UUID!
    $title: String!
    $startDate: Date!
    $endDate: Date!
    $type: String
    $description: String
  ) {
    createHoliday(
      input: {
        pInstitutionId: $institutionId
        pTitle: $title
        pStartDate: $startDate
        pEndDate: $endDate
        pType: $type
        pDescription: $description
      }
    ) {
      holiday { id }
    }
  }
`;

const UPDATE_HOLIDAY = gql`
  mutation UpdateHoliday(
    $id: UUID!
    $title: String!
    $startDate: Date!
    $endDate: Date!
    $type: String
    $description: String
  ) {
    updateHoliday(
      input: {
        pId: $id
        pTitle: $title
        pStartDate: $startDate
        pEndDate: $endDate
        pType: $type
        pDescription: $description
      }
    ) {
      holiday { id }
    }
  }
`;

const DELETE_HOLIDAY = gql`
  mutation DeleteHoliday($id: UUID!) {
    deleteHoliday(input: { pId: $id }) {
      uuid
    }
  }
`;

const TYPE_LABELS = {
  national: { label: "National", cls: "bg-red-50 text-red-700" },
  school: { label: "School", cls: "bg-blue-50 text-blue-700" },
  festival: { label: "Festival", cls: "bg-purple-50 text-purple-700" },
  emergency: { label: "Emergency", cls: "bg-orange-50 text-orange-700" },
};

const EMPTY = { title: "", startDate: "", endDate: "", type: "school", description: "" };

export default function HolidaysPage() {
  const { data, loading, refetch } = useQuery(GET_HOLIDAYS);
  const [createHoliday] = useMutation(CREATE_HOLIDAY);
  const [updateHoliday] = useMutation(UPDATE_HOLIDAY);
  const [deleteHoliday] = useMutation(DELETE_HOLIDAY);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      title: row.title,
      startDate: row.startDate,
      endDate: row.endDate,
      type: row.type,
      description: row.description || "",
    });
    setModalOpen(true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const institutionId = getInstitutionIdFromStorage();
    if (!institutionId) return toast.error("No institution context");
    if (!form.title || !form.startDate) return toast.error("Title and start date required");
    const endDate = form.endDate || form.startDate;
    try {
      if (editing) {
        await updateHoliday({ variables: { id: editing.id, ...form, endDate } });
        toast.success("Holiday updated");
      } else {
        await createHoliday({ variables: { institutionId, ...form, endDate } });
        toast.success("Holiday added");
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to save");
    }
  };

  const onDelete = async (row) => {
    if (!confirm(`Delete holiday "${row.title}"?`)) return;
    try {
      await deleteHoliday({ variables: { id: row.id } });
      toast.success("Holiday deleted");
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const columns = [
    { header: "Title", accessor: "title" },
    {
      header: "Dates",
      accessor: "startDate",
      render: (r) => (r.startDate === r.endDate ? r.startDate : `${r.startDate} → ${r.endDate}`),
    },
    {
      header: "Type",
      accessor: "type",
      render: (r) => {
        const t = TYPE_LABELS[r.type] || TYPE_LABELS.school;
        return (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.cls}`}>
            {t.label}
          </span>
        );
      },
    },
    { header: "Description", accessor: "description", render: (r) => r.description || "—" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Holiday Calendar</h1>
          <p className="text-sm text-zinc-500">
            Holidays affect attendance, working days, and exam eligibility.
          </p>
        </div>
      </div>

      <DataTable
        title="Holidays"
        columns={columns}
        data={data?.allHolidays?.nodes || []}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={onDelete}
        isLoading={loading}
      />

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.form
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={onSubmit}
              className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-900">
                  {editing ? "Edit Holiday" : "Add Holiday"}
                </h2>
                <button type="button" onClick={() => setModalOpen(false)}>
                  <X className="h-5 w-5 text-zinc-400" />
                </button>
              </div>

              <input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Start</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">End (optional)</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="school">School Holiday</option>
                <option value="national">National Holiday</option>
                <option value="festival">Festival Holiday</option>
                <option value="emergency">Emergency Closure</option>
              </select>
              <textarea
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  {editing ? "Update" : "Add"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
