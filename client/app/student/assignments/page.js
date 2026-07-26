"use client";

import { useQuery, useMutation, gql } from "@apollo/client";
import {
  ClipboardList,
  Loader2,
  Calendar,
  Paperclip,
  Download,
  Send,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { fetchFileObjectUrl } from "@/lib/api";
import FileUpload from "@/components/FileUpload";
import { useRequireRole } from "@/lib/useSession";

const GET_STUDENT_ASSIGNMENTS = gql`
  query StudentAssignments($userId: UUID!) {
    allStudents(condition: { userId: $userId }) {
      nodes {
        id
        classId
      }
    }
  }
`;

const GET_CLASS_ASSIGNMENTS = gql`
  query ClassAssignments($classId: UUID!) {
    allAssignments(condition: { classId: $classId }, orderBy: CREATED_AT_DESC) {
      nodes {
        id
        title
        description
        dueDate
        createdAt
        fileId
        assignmentSubmissionsByAssignmentId {
          nodes {
            id
            comment
            grade
            remarks
            status
            submittedAt
            fileId
          }
        }
      }
    }
  }
`;

const SUBMIT_ASSIGNMENT = gql`
  mutation SubmitAssignment($assignmentId: UUID!, $comment: String, $fileId: UUID) {
    submitAssignment(
      input: { pAssignmentId: $assignmentId, pComment: $comment, pFileId: $fileId }
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

function StudentAssignmentsContent() {
  const { user, ready } = useRequireRole(["student", "admin"]);

  const { data: sData } = useQuery(GET_STUDENT_ASSIGNMENTS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });
  const classId = sData?.allStudents?.nodes?.[0]?.classId;

  const { data, loading, refetch } = useQuery(GET_CLASS_ASSIGNMENTS, {
    variables: { classId },
    skip: !classId,
    fetchPolicy: "cache-and-network",
  });
  const [submitAssignment] = useMutation(SUBMIT_ASSIGNMENT);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
      </div>
    );
  }

  const assignments = data?.allAssignments?.nodes || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">My Assignments</h1>
          <p className="text-sm text-zinc-500">Submit your work and track grades.</p>
        </div>
      </div>

      {!classId ? (
        <div className="rounded-xl border border-zinc-100 bg-white py-16 text-center text-zinc-500">
          You are not assigned to a class yet.
        </div>
      ) : loading && !data ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-zinc-100 bg-white py-16 text-center text-zinc-500">
          No assignments for your class yet.
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              onSubmit={async ({ comment, fileId }) => {
                try {
                  await submitAssignment({
                    variables: { assignmentId: a.id, comment: comment || null, fileId: fileId || null },
                  });
                  toast.success("Submitted");
                  await refetch();
                } catch (err) {
                  toast.error(err.message || "Failed to submit");
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentCard({ assignment: a, onSubmit }) {
  const mine = a.assignmentSubmissionsByAssignmentId?.nodes?.[0] || null;
  const [comment, setComment] = useState("");
  const [fileId, setFileId] = useState(null);
  const [busy, setBusy] = useState(false);
  const overdue = a.dueDate && new Date(a.dueDate) < new Date(new Date().toDateString());

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900">{a.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            {a.dueDate && (
              <span className={`inline-flex items-center gap-1 ${overdue && !mine ? "text-red-600" : ""}`}>
                <Calendar className="h-3.5 w-3.5" />
                Due {new Date(a.dueDate).toLocaleDateString()}
              </span>
            )}
            {a.fileId && (
              <button
                type="button"
                onClick={() => downloadFile(a.fileId, "assignment-attachment")}
                className="inline-flex items-center gap-1 text-blue-700 hover:underline"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Attachment
              </button>
            )}
          </div>
        </div>
        {mine && (
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(mine.status)}`}>
            {mine.status}
          </span>
        )}
      </div>

      {a.description && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-600">{a.description}</p>
      )}

      {mine ? (
        <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Clock className="h-3.5 w-3.5" />
            Submitted {new Date(mine.submittedAt).toLocaleString()}
          </div>
          {mine.comment && <p className="mt-1 text-zinc-600">“{mine.comment}”</p>}
          {mine.fileId && (
            <button
              type="button"
              onClick={() => downloadFile(mine.fileId, "my-submission")}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          )}
          {mine.status === "graded" && (
            <div className="mt-2 rounded-lg bg-green-50 p-2 text-green-800">
              <span className="font-semibold">Grade: {mine.grade}</span>
              {mine.remarks && <p className="mt-0.5 text-xs">{mine.remarks}</p>}
            </div>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-primary-700">
              Resubmit
            </summary>
            <SubmitForm
              comment={comment}
              setComment={setComment}
              setFileId={setFileId}
              busy={busy}
              onSubmit={async () => {
                setBusy(true);
                await onSubmit({ comment, fileId });
                setComment("");
                setFileId(null);
                setBusy(false);
              }}
            />
          </details>
        </div>
      ) : (
        <SubmitForm
          comment={comment}
          setComment={setComment}
          setFileId={setFileId}
          busy={busy}
          onSubmit={async () => {
            setBusy(true);
            await onSubmit({ comment, fileId });
            setComment("");
            setFileId(null);
            setBusy(false);
          }}
        />
      )}
    </div>
  );
}

function SubmitForm({ comment, setComment, setFileId, busy, onSubmit }) {
  return (
    <div className="mt-3 space-y-2">
      <textarea
        rows={2}
        placeholder="Add a comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FileUpload kind="submission" label="Attach file" onUploaded={(f) => setFileId(f.id)} />
        <button
          type="button"
          disabled={busy}
          onClick={onSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit
        </button>
      </div>
    </div>
  );
}

export default function StudentAssignmentsPage() {
  return <StudentAssignmentsContent />;
}
