/**
 * Sends school emails after GraphQL mutations succeed.
 *
 * PostGraphile runs each request in a transaction and commits it before the
 * HTTP response is written, so the email work is deferred until the response
 * finishes (`afterCommit`). That way the emails read committed data and are
 * never sent for a mutation that rolled back.
 *
 * Requires `additionalGraphQLContextFromRequest` to put `req`/`res` on the
 * GraphQL context (see index.js).
 */

const { makeWrapResolversPlugin } = require('graphile-utils');
const schoolEmails = require('../services/schoolEmails');

function afterCommit(context, label, task) {
  const res = context?.res;
  const run = () => schoolEmails.fire(label, task);
  if (res && !res.writableFinished) res.once('finish', run);
  else setImmediate(run);
}

const rowId = (alias) => ({ childColumns: [{ column: 'id', alias }] });

/** Wrap a mutation returning a row: read `columns` from it, then run `after`. */
function onRow(label, columns, after) {
  return {
    requires: { childColumns: columns.map(([column, alias]) => ({ column, alias })) },
    async resolve(resolve, source, args, context) {
      const result = await resolve();
      const data = result?.data;
      if (data) afterCommit(context, label, () => after(data, args.input || {}, context));
      return result;
    },
  };
}

module.exports = makeWrapResolversPlugin({
  Mutation: {
    // --- accounts: username + password -------------------------------------
    registerStudent: onRow('student credentials', [['user_id', '$user_id']], (d, input) =>
      schoolEmails.accountCredentials({ userId: d.$user_id, password: input.password })
    ),
    registerTeacher: onRow('teacher credentials', [['user_id', '$user_id']], (d, input) =>
      schoolEmails.accountCredentials({ userId: d.$user_id, password: input.password })
    ),
    registerStaffUser: onRow('staff credentials', [['id', '$user_id']], (d, input) =>
      schoolEmails.accountCredentials({ userId: d.$user_id, password: input.pPassword })
    ),
    setUserPassword: {
      async resolve(resolve, source, args, context) {
        const result = await resolve();
        const { pUserId, pPassword } = args.input || {};
        afterCommit(context, 'password reset', () =>
          schoolEmails.accountCredentials({ userId: pUserId, password: pPassword, reset: true })
        );
        return result;
      },
    },

    // --- assignments -------------------------------------------------------
    createAssignment: onRow('assignment created', [['id', '$id']], (d) => schoolEmails.assignmentCreated(d.$id)),
    submitAssignment: onRow('assignment submitted', [['id', '$id']], (d) => schoolEmails.assignmentSubmitted(d.$id)),
    gradeSubmission: onRow('assignment graded', [['id', '$id']], (d) => schoolEmails.assignmentGraded(d.$id)),

    // --- exams & results ---------------------------------------------------
    registerExam: onRow('exam scheduled', [['id', '$id']], (d) => schoolEmails.examScheduled(d.$id)),
    upsertResult: {
      requires: rowId('$id'),
      async resolve(resolve, source, args, context) {
        const { pExamId, pStudentId } = args.input || {};
        // Only email when the result is new or the marks/feedback changed.
        const before = await context.pgClient.query(
          `SELECT marks_obtained, feedback FROM results WHERE exam_id = $1 AND student_id = $2`,
          [pExamId, pStudentId]
        );
        const result = await resolve();
        const prev = before.rows[0];
        const changed =
          !prev ||
          Number(prev.marks_obtained) !== Number(args.input.pMarks) ||
          (prev.feedback || '') !== (args.input.pFeedback || '');
        if (result?.data && changed) {
          afterCommit(context, 'result declared', () =>
            schoolEmails.resultsDeclared([{ examId: pExamId, studentId: pStudentId }])
          );
        }
        return result;
      },
    },

    // --- announcements (high / urgent) -------------------------------------
    createAnnouncement: onRow('announcement', [['id', '$id']], (d) => schoolEmails.announcementPublished(d.$id)),
    updateAnnouncement: announcementChange('pId'),
    toggleAnnouncement: announcementChange('pId'),

    // --- fees --------------------------------------------------------------
    createFee: onRow('fee invoice', [['id', '$id']], (d) => schoolEmails.feesInvoiced([d.$id])),
    generateInvoicesForPlan: {
      async resolve(resolve, source, args, context) {
        const result = await resolve();
        // Rows inserted in this transaction carry its timestamp (DEFAULT now()).
        const { rows } = await context.pgClient.query(`SELECT id FROM fees WHERE created_at = now()`);
        const ids = rows.map((r) => r.id);
        if (ids.length) afterCommit(context, 'plan invoices', () => schoolEmails.feesInvoiced(ids));
        return result;
      },
    },
    recordFeePayment: {
      async resolve(resolve, source, args, context) {
        const result = await resolve();
        const { rows } = await context.pgClient.query(
          `SELECT id FROM fee_payments WHERE fee_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [args.input?.pFeeId]
        );
        if (rows[0]) afterCommit(context, 'fee payment', () => schoolEmails.feePaymentReceived(rows[0].id));
        return result;
      },
    },
  },
});

/** Email an announcement when an edit/toggle makes it newly high-or-urgent and active. */
function announcementChange(idArg) {
  return {
    requires: rowId('$id'),
    async resolve(resolve, source, args, context) {
      const id = args.input?.[idArg];
      const before = await context.pgClient.query(
        `SELECT priority, is_active FROM announcements WHERE id = $1`,
        [id]
      );
      const result = await resolve();
      const wasEmailable = schoolEmails.shouldEmailAnnouncement(before.rows[0]);
      if (result?.data && !wasEmailable) {
        afterCommit(context, 'announcement', () => schoolEmails.announcementPublished(result.data.$id));
      }
      return result;
    },
  };
}
