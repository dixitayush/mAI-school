"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, gql } from "@apollo/client";
import {
  ClipboardList,
  Plus,
  Loader2,
  Calendar,
  Paperclip,
  Users,
  CheckCircle2,
  Clock,
  Download,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { resolveSignInPath } from "@/lib/tenant";
import { fetchFileObjectUrl } from "@/lib/api";
import FileUpload from "@/components/FileUpload";

const GET_TEACHER_ASSIGNMENTS = gql`
  query TeacherAssignments {
    allClasses(orderBy: NAME_ASC) {
      nodes {
        id
        name
      }
    }
    allAssignments(orderBy: CREATED_AT_DESC) {
      nodes {
        id
        title
        description
        section
        dueDate
        createdAt
        classId
        fileId
        classByClassId {
          name
        }
        assignmentSubmissionsByAssignmentId {
          totalCount
          nodes {
            id
            comment
            grade
            remarks
            status
            submittedAt
            fileId
            studentByStudentId {
              rollNumber
              userByUserId {
                fullName
              }
            }
          }
        }
      }
    }
  }
`;

const CREATE_ASSIGNMENT = gql`
  mutation CreateAssignment(
    $classId: UUID!
    $title: String!
    $description: String
    $dueDate: Date
    $section: String
    $fileId: UUID
  ) {
    createAssignment(
      input: {
        pClassId: $classId
        pTitle: $title
        pDescription: $description
        pDueDate: $dueDate
        pSection: $section
        pFileId: $fileId
      }
    ) {
      assignment {
        id
      }
    }
  }
`;

const GRADE_SUBMISSION = gql`
  mutation GradeSubmission($submissionId: UUID!, $grade: String!, $remarks: String) {
    gradeSubmission(
      input: { pSubmissionId: $submissionId, pGrade: $grade, pRemarks: $remarks }
    ) {
      assignmentSubmission {
        id
        status
      }
    }
  }
`;

function statusBadge(status) {
  const map = {
    graded: "bg-green-100 text-green-700",
    late: "bg-amber-100 text-amber-700",
    submitted: "bg-blue-100 text-blue-700",
  };
  return map[status] || "bg-zinc-100 text-zinc-600";
}

async function downloadFile(fileId, filename) {
  const url = await fetchFileObjectUrl(fileId);
  if (!url) return toast.error("File unavailable");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "file";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function TeacherAssignmentsContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const role = localStorage.getItem("role");
    if (!storedUser || (role !== "teacher" && role !== "admin" && role !== "principal")) {
      router.push(resolveSignInPath());
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  const { data, loading, refetch } = useQuery(GET_TEACHER_ASSIGNMENTS, {
    skip: !user,
    fetchPolicy: "cache-and-network",
  });
  const [createAssignment] = useMutation(CREATE_ASSIGNMENT);
  const [gradeSubmission] = useMutation(GRADE_SUBMISSION);

  const classes = useMemo(() => data?.allClasses?.nodes || [], [data]);
  const assignments = data?.allAssignments?.nodes || [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ classId: "", title: "", description: "", dueDate: "", section: "" });
  const [fileId, setFileId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.classId || !form.title.trim()) {
      return toast.error("Class and title are required");
    }
    setSaving(true);
    try {
      await createAssignment({
        variables: {
          classId: form.classId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          dueDate: form.dueDate || null,
          section: form.section.trim() || null,
          fileId: fileId || null,
        },
      });
      toast.success("Assignment created");
      setForm({ classId: "", title: "", description: "", dueDate: "", section: "" });
      setFileId(null);
      setShowForm(false);
      await refetch();
    } catch (err) {
      toast.error(err.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Assignments</h1>
            <p className="text-sm text-zinc-500">Create assignments and review student submissions.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "New Assignment"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid gap-4 rounded-2xl border border-zinc-100 bg-white p-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-zinc-500">Class</label>
            <select
              value={form.classId}
              onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Section (optional)</label>
            <input
              type="text"
              value={form.section}
              onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-500">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-500">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Due date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <FileUpload
              kind="assignment"
              label="Attach file"
              onUploaded={(f) => setFileId(f.id)}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </button>
          </div>
        </form>
      )}

      {loading && !data ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-zinc-100 bg-white py-16 text-center text-zinc-500">
          No assignments yet.
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const subs = a.assignmentSubmissionsByAssignmentId?.nodes || [];
            const isOpen = openId === a.id;
            return (
              <div key={a.id} className="rounded-2xl border border-zinc-100 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : a.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-900">{a.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {a.classByClassId?.name}
                        {a.section ? ` · ${a.section}` : ""}
                      </span>
                      {a.dueDate && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Due {new Date(a.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {a.fileId && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadFile(a.fileId, "assignment-attachment");
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 text-blue-700 hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          Attachment
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                    {subs.length} submitted
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-zinc-100 p-4">
                    {a.description && (
                      <p className="mb-4 whitespace-pre-wrap text-sm text-zinc-600">{a.description}</p>
                    )}
                    {subs.length === 0 ? (
                      <p className="text-sm text-zinc-400">No submissions yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {subs.map((s) => (
                          <SubmissionRow
                            key={s.id}
                            sub={s}
                            onGrade={async (grade, remarks) => {
                              try {
                                await gradeSubmission({
                                  variables: { submissionId: s.id, grade, remarks: remarks || null },
                                });
                                toast.success("Graded");
                                await refetch();
                              } catch (err) {
                                toast.error(err.message || "Failed to grade");
                              }
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ sub, onGrade }) {
  const [grade, setGrade] = useState(sub.grade || "");
  const [remarks, setRemarks] = useState(sub.remarks || "");
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-zinc-800">
            {sub.studentByStudentId?.userByUserId?.fullName}
            {sub.studentByStudentId?.rollNumber ? ` · Roll ${sub.studentByStudentId.rollNumber}` : ""}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${statusBadge(sub.status)}`}>
              {sub.status}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(sub.submittedAt).toLocaleString()}
            </span>
          </div>
        </div>
        {sub.fileId && (
          <button
            type="button"
            onClick={() => downloadFile(sub.fileId, "submission")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        )}
      </div>
      {sub.comment && <p className="mt-2 text-sm text-zinc-600">“{sub.comment}”</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Remarks (optional)"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={busy || !grade.trim()}
          onClick={async () => {
            setBusy(true);
            await onGrade(grade.trim(), remarks.trim());
            setBusy(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Save grade
        </button>
      </div>
    </div>
  );
}

export default function TeacherAssignmentsPage() {
  return <TeacherAssignmentsContent />;
}
