# mAI-school — Production Readiness & AI Expansion PRD

**Document:** `mAI-SCHOOL-PRODUCTION-AI-PRD.md`  
**Version:** 1.0  
**Status:** Implementation-ready product requirements  
**Target:** Production SaaS for schools / institutes  
**Primary stack:** Next.js + PostgreSQL + PostGraphile/GraphQL + REST + JWT  
**Email:** Resend  
**AI:** OpenAI API, model configurable through environment variables  
**Primary domain:** `maischool.ayushdixit.work`

---

## 1. Executive Summary

mAI-school is an existing multi-tenant school-management SaaS in which schools can self-onboard and operate through role-specific experiences for:

- Platform Admin
- School Admin
- Principal
- Teacher
- Student

The current product already covers the core school-management surface represented by the deployed product and repository documentation, including tenant/subdomain provisioning, role-shaped dashboards, attendance, fees, exams/results, announcements, meetings, timetables/online classes, reporting, and basic AI drafting/summarization.

This PRD defines the **net-new product layer required to turn mAI-school into a production-grade, commercially distributable, AI-native school operating system**.

The objective is not to rebuild the existing application. The implementation should:

1. Preserve all working existing functionality.
2. Harden authentication, authorization, tenancy, data isolation, reliability, observability, and deployment.
3. Add parent/guardian capabilities.
4. Add a first-class AI layer for admins, principals, teachers, and students.
5. Add high-value operational modules missing from the current product surface.
6. Add automation so routine school operations require less manual work.
7. Make the UI modern, fast, accessible, responsive, and excellent on mobile/tablet/desktop.
8. Keep the architecture simple enough for the existing Next.js/Postgres/PostGraphile/REST stack.
9. Make all new features genuinely end-to-end: database -> API -> permissions -> UI -> validation -> notifications -> audit -> tests.
10. Avoid AI features that are merely chat wrappers; AI should be grounded in school data and should produce useful actions, drafts, insights, recommendations, or learning experiences.

---

# 2. Product Vision

## 2.1 Vision

> **mAI-school should become the intelligent operating system for a school — managing operations while helping every person in the school make better use of their time.**

The platform should feel like:

- an ERP for administrators,
- an operating dashboard for principals,
- a teaching assistant for teachers,
- a learning companion for students,
- and a communication hub for parents.

## 2.2 Product principles

### Principle 1 — Tenant isolation is non-negotiable

No user, query, mutation, AI request, file, email, notification, report, or background job may cross tenant boundaries.

### Principle 2 — AI assists; humans remain accountable

AI may draft, summarize, explain, classify, recommend, generate, and surface anomalies. It must not silently make high-impact decisions about students.

### Principle 3 — Every AI result should be explainable

Where practical, show:

- source/context,
- confidence or evidence indicator,
- generated timestamp,
- relevant records used,
- and a clear "AI generated" label.

### Principle 4 — Fast by default

A normal CRUD interaction should not depend on an LLM.

AI calls must be:

- asynchronous when possible,
- streamed for interactive experiences,
- cached where safe,
- rate limited,
- observable,
- and protected by quotas.

### Principle 5 — Mobile first

Every major workflow must work on:

- phone,
- tablet,
- laptop,
- desktop.

Teachers should be able to perform common actions with one hand on a phone.

### Principle 6 — Progressive disclosure

Do not expose enterprise-level complexity to a school user until it is needed.

### Principle 7 — Automation over dashboards

A dashboard that only displays problems is less useful than a dashboard that identifies a problem and offers the next action.

---

# 3. Current Product Baseline

The following capabilities are treated as existing and must not be unnecessarily rebuilt:

- Multi-tenant school/institute model.
- Self-service school onboarding.
- Dedicated school subdomain.
- School branding / logo.
- Platform-level admin.
- School admin.
- Principal.
- Teacher.
- Student.
- JWT authentication.
- Role-based access.
- PostgreSQL.
- PostGraphile / GraphQL.
- REST APIs.
- Attendance.
- Fees.
- Exams/results.
- Announcements.
- Meetings.
- Timetables.
- Online classes.
- Reporting/dashboard capabilities.
- Existing AI drafting/summarization functionality.

The deployed public product describes each school as a tenant with isolated data and its own subdomain, and describes role-shaped experiences for admins, principals, teachers, and students.

**Implementation rule:** before adding a feature, inspect the existing schema/API/UI. If an existing feature partially overlaps with a PRD feature, extend the existing implementation instead of creating duplicate concepts.

---

# 4. Product Gaps / Net-New Scope

The major net-new areas are:

1. Production security and tenancy hardening.
2. Parent/guardian portal.
3. Admissions and applicant pipeline.
4. Student lifecycle management.
5. Documents and digital records.
6. School-wide notification center.
7. Workflow automation engine.
8. AI school copilot.
9. AI principal/admin intelligence.
10. AI teacher copilot.
11. AI student tutor.
12. Personalized learning plans.
13. AI assessment/question-paper generation.
14. AI assignment feedback.
15. AI meeting and communication intelligence.
16. Early-warning student support system.
17. Academic intervention workflows.
18. Library management.
19. Transport management.
20. Inventory/assets/procurement.
21. Staff leave/substitute management.
22. Parent-teacher communication.
23. Events/calendar.
24. Student portfolio and achievements.
25. Certificates and document generation.
26. Surveys/feedback.
27. Helpdesk/ticketing.
28. Consent management.
29. Data export/import.
30. Billing/subscription operations.
31. Audit/security center.
32. Observability and reliability.
33. Feature flags and tenant configuration.
34. PWA/offline-friendly teacher workflows.
35. Advanced search.
36. AI usage/cost governance.

---

# 5. User Roles

## 5.1 Platform Admin

Owns the SaaS platform.

Can:

- onboard/manage tenants,
- suspend/reactivate tenants,
- inspect platform health,
- view tenant-level usage,
- manage subscription plans,
- configure global AI limits,
- manage feature flags,
- review security/audit events,
- inspect system errors,
- view email delivery health,
- configure platform-level templates.

Platform Admin must not casually access school data. Any privileged cross-tenant access must be explicitly authorized and audited.

## 5.2 School Admin

Owns school configuration and operations.

Examples:

- users,
- classes,
- academic years,
- fees,
- documents,
- workflows,
- communication,
- reports,
- AI settings,
- integrations,
- school branding.

## 5.3 Principal

Focus:

- school health,
- academic performance,
- attendance,
- teacher performance,
- interventions,
- communication,
- risks,
- operational decisions.

## 5.4 Teacher

Focus:

- classes,
- attendance,
- lesson planning,
- assignments,
- assessments,
- grading,
- student support,
- parent communication,
- AI teaching assistance.

## 5.5 Student

Focus:

- timetable,
- attendance,
- assignments,
- exams,
- results,
- learning resources,
- AI tutor,
- goals,
- progress,
- certificates/achievements.

## 5.6 Parent / Guardian — NEW

A student may have one or more guardians.

Parent capabilities:

- multiple children under one account,
- attendance,
- results,
- homework,
- fee status,
- announcements,
- teacher communication,
- meeting booking,
- consent forms,
- documents,
- transport tracking where enabled,
- AI-generated weekly child progress digest,
- notification preferences.

A parent can only see children explicitly linked to the parent account.

---

# 6. Production-Ready Architecture Requirements

## 6.1 Preserve existing stack

Do not introduce microservices merely for architectural fashion.

Preferred architecture:

```text
Next.js
  |
  +-- Server/UI
  |
  +-- REST API
  |
  +-- GraphQL / PostGraphile
          |
       PostgreSQL
          |
      Background Jobs
          |
  +-------+---------+
  |                 |
Resend           OpenAI
```

Use modular application services inside the existing backend before considering separate services.

## 6.2 API responsibilities

### GraphQL / PostGraphile

Use for:

- standard CRUD,
- dashboards,
- relational reads,
- filtered lists,
- pagination,
- subscriptions only if already supported safely.

### REST

Use for:

- authentication flows,
- webhooks,
- file upload/download,
- AI streaming endpoints,
- long-running jobs,
- email operations,
- imports/exports,
- external integrations,
- signed URLs.

### Business service layer

Do not put complex business logic directly into UI components or raw GraphQL resolvers.

Create service modules for:

- tenant authorization,
- attendance,
- fees,
- admissions,
- AI,
- notifications,
- documents,
- workflows,
- billing,
- audit.

---

# 7. Multi-Tenancy & Data Isolation

## 7.1 Tenant identity

Every tenant-owned record must contain a tenant identifier directly or through an immutable parent relation.

Recommended:

```text
tenant
  id
  slug
  name
  status
  timezone
  locale
  branding
  settings
  created_at
  updated_at
```

## 7.2 Tenant isolation requirements

All tenant-owned tables must support:

- tenant-aware queries,
- tenant-aware unique constraints,
- tenant-aware indexes,
- tenant-aware API authorization.

Recommended database strategy:

- PostgreSQL Row Level Security where practical.
- Server-side tenant context.
- No client-supplied tenant ID trusted for authorization.
- JWT tenant claim validated against server-side membership.
- Every privileged query must enforce tenant scope.

## 7.3 Tenant-aware unique constraints

Examples:

```text
UNIQUE(tenant_id, slug)
UNIQUE(tenant_id, email)
UNIQUE(tenant_id, admission_number)
UNIQUE(tenant_id, employee_code)
UNIQUE(tenant_id, class_code)
```

## 7.4 Cross-tenant security tests

Automated tests must prove:

- Tenant A cannot query Tenant B users.
- Tenant A cannot mutate Tenant B attendance.
- Tenant A cannot download Tenant B documents.
- Tenant A cannot invoke AI using Tenant B context.
- Tenant A cannot access Tenant B email logs.
- Background jobs cannot execute against the wrong tenant.

---

# 8. Authentication & Security Hardening

## 8.1 JWT improvements

Keep JWT but introduce:

- short-lived access tokens,
- refresh token rotation,
- refresh token revocation,
- token family tracking,
- logout invalidation,
- session/device tracking.

Suggested:

```env
JWT_SECRET=
JWT_ISSUER=mai-school
JWT_AUDIENCE=postgraphile
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
```

## 8.2 Password security

Requirements:

- Argon2id or strong bcrypt configuration.
- Password strength rules.
- Never log passwords.
- Never return password hashes.
- Reset tokens must expire.
- Reset tokens must be single-use.
- Login attempt throttling.

## 8.3 Optional MFA

Add:

- TOTP MFA for admins/principals.
- Recovery codes.
- Trusted device management.

MFA should be configurable per tenant.

## 8.4 Session management

Users should be able to:

- view active sessions,
- identify device/browser,
- revoke a session,
- revoke all other sessions.

Admins should be able to revoke a user's sessions.

## 8.5 Authorization

Implement centralized authorization helpers:

```text
requireAuth()
requireTenant()
requireRole()
requirePermission()
requireOwnership()
```

Never rely only on frontend route hiding.

---

# 9. Production Security Center — NEW

Add:

**Admin -> Security Center**

Features:

- active sessions,
- failed logins,
- suspicious login attempts,
- password reset events,
- MFA events,
- API rate-limit events,
- permission changes,
- sensitive record access,
- tenant configuration changes,
- audit log.

Every sensitive event:

```text
id
tenant_id
actor_id
action
entity_type
entity_id
metadata
ip_address
user_agent
created_at
```

Do not store secrets or passwords in metadata.

---

# 10. Audit Log — NEW

Audit all important mutations:

- student creation/update/deletion,
- grade changes,
- attendance edits after lock,
- fee changes,
- fee refunds,
- user role changes,
- permissions,
- tenant settings,
- document access,
- AI-generated actions,
- AI-approved actions,
- bulk imports,
- exports.

Provide:

- filters,
- date range,
- actor,
- action,
- entity,
- export.

High-impact records should support immutable history rather than overwriting without trace.

---

# 11. Parent / Guardian Portal

## 11.1 Parent onboarding

Admin can:

- invite parent,
- link parent to one or multiple students,
- verify email,
- resend invite,
- revoke access.

Email:

```text
From: mAI-school <info@maischool.ayushdixit.work>
```

## 11.2 Parent dashboard

Cards:

- today's attendance,
- attendance trend,
- pending homework,
- upcoming exams,
- recent results,
- fee balance,
- school announcements,
- upcoming meetings,
- teacher messages.

## 11.3 Multi-child switcher

Parent can switch between children without logging out.

## 11.4 Parent weekly digest

Every configured week:

```text
Your child's week
Attendance
Homework
Academic progress
Upcoming assessments
Teacher notes
Achievements
Actions required
```

Parent can disable digest.

---

# 12. Admissions & Applicant Management — NEW

Create an admissions pipeline.

## 12.1 Pipeline

```text
Inquiry
  -> Application Started
  -> Documents Pending
  -> Application Submitted
  -> Under Review
  -> Interview
  -> Assessment
  -> Selected
  -> Fee Pending
  -> Enrolled
  -> Rejected/Withdrawn
```

## 12.2 Applicant portal

Public application page:

- student details,
- guardian details,
- previous school,
- requested grade,
- documents,
- declarations,
- consent,
- application fee if enabled.

## 12.3 Admin features

- application queue,
- duplicate detection,
- document verification,
- interview scheduling,
- notes,
- applicant scoring rubric,
- status automation,
- bulk communication.

AI may summarize applications, but selection decisions remain human-controlled.

---

# 13. Student Lifecycle Management — NEW

Track:

```text
Inquiry
Admission
Enrollment
Class Assignment
Promotion
Transfer
Withdrawal
Graduation
Alumni
```

Maintain student timeline:

```text
Student Timeline
----------------
Admission
Class changes
Attendance events
Academic milestones
Awards
Disciplinary events
Documents
Parent interactions
Teacher interventions
Certificates
```

---

# 14. Digital Documents & Student Vault — NEW

Each student gets a secure document vault.

Document categories:

- admission documents,
- identity documents,
- transfer certificate,
- medical/consent records where legally appropriate,
- certificates,
- report cards,
- fee receipts,
- disciplinary documents,
- parent-submitted documents.

Features:

- upload,
- preview,
- download,
- versioning,
- expiry date,
- verification status,
- access control,
- audit history.

Sensitive documents must use signed, expiring URLs.

---

# 15. Document Generation — NEW

Generate branded:

- report cards,
- fee receipts,
- bonafide certificates,
- transfer certificates,
- participation certificates,
- achievement certificates,
- admission letters,
- ID cards.

Template engine:

```text
School branding
Academic year
Student fields
Dynamic tables
QR verification
Signature
Seal/logo
```

Add public verification page:

```text
https://<school-subdomain>/verify/<certificate-id>
```

Do not expose unnecessary student data.

---

# 16. Notification Center — NEW

One notification abstraction for:

- in-app,
- email,
- push/PWA in future,
- SMS provider later.

Notification object:

```text
notification
- id
- tenant_id
- recipient_id
- type
- title
- body
- entity_type
- entity_id
- read_at
- created_at
```

Features:

- unread count,
- mark read,
- mark all read,
- deep links,
- preferences.

---

# 17. Communication Hub — NEW

Replace fragmented communication workflows with:

- teacher -> class,
- teacher -> parent,
- admin -> school,
- principal -> staff,
- parent -> teacher,
- student -> teacher where enabled.

Capabilities:

- message threads,
- attachments,
- read status,
- moderation,
- message templates,
- scheduled announcements.

For minors, do not create unrestricted private communication patterns. School policy should control which roles can directly message each other.

---

# 18. Workflow Automation Engine — NEW

Create:

**Admin -> Automations**

Trigger examples:

```text
Attendance below threshold
Fee overdue
New admission
Exam result published
Assignment overdue
Document expired
Student absent N days
New teacher joined
Parent invitation not accepted
```

Actions:

```text
Send email
Create notification
Create task
Assign staff member
Generate report
Create intervention
Schedule reminder
```

Example:

```text
WHEN
student attendance falls below 75%

THEN
notify class teacher
create principal review task
send parent email
```

Every automation must be:

- tenant-scoped,
- idempotent,
- retryable,
- auditable,
- disableable.

---

# 19. AI Platform Layer

## 19.1 AI configuration

All model configuration must come from environment variables.

Suggested:

```env
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_FAST_MODEL=
OPENAI_REASONING_MODEL=

AI_ENABLED=true
AI_MAX_INPUT_TOKENS=
AI_MAX_OUTPUT_TOKENS=
AI_DAILY_TENANT_LIMIT=
AI_DAILY_USER_LIMIT=
AI_TIMEOUT_MS=30000
```

Do not hard-code API keys.

Do not expose OpenAI keys to the browser.

## 19.2 Model strategy

Use a model routing layer.

```text
AI Router
   |
   +-- FAST
   |     summaries
   |     classification
   |     extraction
   |
   +-- STANDARD
   |     teacher copilot
   |     student tutor
   |     drafting
   |
   +-- REASONING
         complex reports
         difficult academic reasoning
         advanced planning
```

The model names remain environment-configurable.

A cost-sensitive default should be used for high-volume operations. Current OpenAI documentation lists small/mini models specifically for high-volume and cost-sensitive workloads, while larger models can be reserved for difficult reasoning. Do not hard-code pricing assumptions into the application; model pricing changes over time.

## 19.3 AI service interface

Create a provider abstraction:

```ts
interface AIProvider {
  generateText(input: AIRequest): Promise<AIResponse>;
  streamText(input: AIRequest): AsyncIterable<AIChunk>;
  generateStructured<T>(
    input: AIStructuredRequest<T>
  ): Promise<T>;
}
```

The application should depend on the interface, not directly on OpenAI calls.

## 19.4 AI request metadata

Store:

```text
ai_request
- id
- tenant_id
- user_id
- feature
- model
- input_tokens
- output_tokens
- latency_ms
- status
- estimated_cost
- created_at
```

Never store unnecessary sensitive prompts or full student records.

## 19.5 AI guardrails

Every AI request must have:

- tenant context,
- user role,
- minimum required data,
- allowed data fields,
- maximum input size,
- timeout,
- retry policy,
- rate limit,
- audit metadata.

---

# 20. AI School Copilot — NEW

Add a persistent AI assistant to admin/principal dashboards.

Examples:

> "Which classes have the largest attendance drop this month?"

> "Show students whose attendance and academic performance are both declining."

> "Draft a parent announcement about tomorrow's holiday."

> "Summarize this week's school operations."

> "What fees are overdue by more than 30 days?"

> "Create a staff meeting agenda from unresolved operational issues."

## Important architecture

The LLM must not receive the entire database.

Use tools:

```text
get_attendance_summary
get_fee_summary
get_exam_summary
get_class_performance
get_student_count
get_teacher_workload
get_upcoming_events
get_overdue_tasks
draft_announcement
create_task
```

Tool access is role-specific.

## Action confirmation

For mutations:

```text
AI proposes action
      |
User reviews
      |
Confirm
      |
Server validates permissions
      |
Mutation
      |
Audit log
```

AI must never directly execute destructive actions.

---

# 21. AI Principal Intelligence — NEW

Principal dashboard gains:

## Daily Brief

Automatically generated:

```text
Today's school brief

Attendance
Academic risks
Operational alerts
Fees
Staff issues
Upcoming events
Pending approvals
Recommended actions
```

## Weekly Principal Report

Sections:

- attendance,
- academics,
- assessments,
- fees,
- teacher workload,
- student support,
- unresolved issues,
- trends,
- suggested questions for staff meeting.

## Trend detection

Surface:

- unusual absenteeism,
- class-level performance drops,
- sudden fee collection changes,
- assignment completion decline,
- repeated discipline incidents.

AI should flag patterns, not diagnose students or staff.

---

# 22. AI Admin Copilot — NEW

Admin workflows:

### Fee assistant

Ask:

> "Which fee categories have the highest overdue amount?"

> "Draft polite reminders for overdue accounts."

### Communication assistant

Generate:

- circulars,
- notices,
- holiday announcements,
- event reminders,
- parent emails.

### Data assistant

Ask natural-language questions against approved structured tools.

### Report builder

User selects:

```text
Students
Columns
Filters
Grouping
Date range
```

AI converts intent into a validated report definition.

---

# 23. AI Teacher Copilot — NEW

Teacher gets:

**AI Teaching Studio**

## Lesson Planner

Input:

- grade,
- subject,
- topic,
- duration,
- learning objectives.

Output:

- lesson objectives,
- explanation,
- activities,
- examples,
- formative assessment,
- homework,
- differentiation ideas.

## Worksheet Generator

Generate:

- MCQ,
- true/false,
- fill blanks,
- short answer,
- long answer,
- case-based,
- competency-based.

Teacher must review before publishing.

## Question Paper Generator

Inputs:

```text
Class
Subject
Chapter
Difficulty
Marks
Duration
Question distribution
Learning outcomes
```

Output:

- paper,
- answer key,
- marking scheme.

## Rubric Generator

Generate rubrics for:

- projects,
- presentations,
- practicals,
- assignments.

## Student feedback assistant

Turn structured performance data into constructive comments.

---

# 24. AI Assignment Feedback — NEW

Teacher uploads/pastes student work where supported.

AI can:

- identify strengths,
- identify missing concepts,
- suggest improvement,
- generate feedback draft,
- map to rubric.

AI should not silently assign final marks.

Recommended:

```text
AI suggestion
   ->
Teacher review
   ->
Teacher accepts/edits
   ->
Final grade
```

---

# 25. AI Student Tutor — NEW

Add:

**My AI Tutor**

The tutor must be constrained by the student's:

- class,
- subjects,
- curriculum configuration,
- available learning resources.

Capabilities:

- explain concepts,
- ask Socratic questions,
- generate practice,
- provide hints,
- explain mistakes,
- create revision plans,
- generate flashcards,
- summarize school-provided materials.

## Tutor modes

```text
Explain
Practice
Quiz Me
Give Hint
Check My Answer
Revise
Exam Prep
```

## Anti-cheating mode

For active assessments, AI should be disabled or restricted according to school configuration.

If an exam is configured as closed-book:

- no answer generation,
- no direct solution,
- no external tool access.

## Age-appropriate safety

AI output should be filtered for:

- unsafe content,
- sexual content involving minors,
- self-harm content,
- bullying,
- harassment,
- inappropriate instructions.

Provide escalation messaging for safety-sensitive situations.

---

# 26. Personalized Student Learning Plan — NEW

Create:

**My Learning Plan**

Inputs:

- results,
- assignment completion,
- attendance,
- teacher feedback,
- student goals.

Output:

```text
Current strengths
Needs practice
This week's goals
Recommended practice
Revision schedule
Progress
```

Do not label students with permanent AI-generated categories.

Use language such as:

- "needs practice in..."
- "recently struggled with..."
- "consider reviewing..."

---

# 27. AI Study Planner — NEW

Student enters:

```text
I have a math exam in 12 days.
```

System uses:

- syllabus,
- exam date,
- available time,
- previous performance.

Output:

```text
Day 1
Algebra basics
30 min

Day 2
Linear equations
45 min

...
```

Allow:

- reschedule,
- mark complete,
- regenerate,
- reduce workload.

---

# 28. AI Question Generator — NEW

Question generation should produce structured JSON:

```json
{
  "questions": [
    {
      "type": "mcq",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "answer": "B",
      "explanation": "...",
      "difficulty": "medium",
      "learningObjective": "..."
    }
  ]
}
```

Server validates the schema before storing.

---

# 29. AI Meeting Assistant — NEW

For school meetings:

Before meeting:

- agenda draft,
- pending actions,
- relevant data.

During/after meeting:

- notes,
- decisions,
- action items,
- owners,
- deadlines.

AI output must be reviewed before being saved as official minutes.

---

# 30. AI Parent Digest — NEW

Parent receives concise weekly summary:

```text
This week's school update

Attendance: 96%
Assignments: 8/9 completed
Recent assessment: improving
Upcoming:
- Science test
- Parent meeting

Teacher note:
...

Suggested action:
Review chapter 4 before Friday.
```

Parent can configure:

- weekly,
- only important,
- email off.

---

# 31. Student Early-Warning & Intervention System — NEW

Create a rules-based + analytics system.

Signals:

- attendance trend,
- assignment completion,
- assessment trend,
- repeated late submissions,
- teacher intervention notes,
- sudden change in performance.

Output:

```text
Potential support needed
Reason:
Attendance dropped from X to Y.
Recent assessment scores also decreased.

Suggested next step:
Teacher check-in.
```

Do not use AI to diagnose mental health, medical conditions, disability, or other sensitive traits.

Human staff must own intervention decisions.

---

# 32. Intervention Workflow — NEW

Teacher/principal can create:

```text
Intervention
- student
- concern
- observed evidence
- action plan
- owner
- review date
- status
- outcome
```

Statuses:

```text
Open
In Progress
Monitoring
Resolved
Escalated
```

AI can draft an action plan, but staff approve it.

---

# 33. Student Portfolio — NEW

Student profile gains:

- achievements,
- certificates,
- projects,
- competitions,
- extracurricular activities,
- skills,
- teacher comments,
- portfolio files.

Student can generate a shareable portfolio link with explicit school/student permission.

---

# 34. Library Management — NEW

Features:

- books,
- categories,
- authors,
- copies,
- barcode/QR,
- issue/return,
- overdue,
- fines,
- reservations,
- student borrowing history.

Dashboard:

- overdue books,
- popular books,
- inactive inventory,
- circulation trend.

AI:

- reading recommendations based on school library inventory,
- reading-plan generation.

Do not expose other students' borrowing histories.

---

# 35. Transport Management — NEW

Features:

- routes,
- stops,
- vehicles,
- drivers,
- attendants,
- student assignments,
- pickup/drop points,
- transport fees.

Future-compatible location integration:

```text
Vehicle
 -> current status
 -> route
 -> ETA
```

Do not collect continuous student location unless necessary and explicitly consented/configured.

Parent view:

```text
Bus 04
Route A
Status: On route
ETA: ...
```

---

# 36. Inventory & Asset Management — NEW

Track:

- computers,
- projectors,
- furniture,
- lab equipment,
- sports equipment,
- stationery.

Lifecycle:

```text
Purchased
Assigned
Under Repair
Available
Disposed
```

Include:

- asset ID,
- QR code,
- purchase date,
- warranty,
- location,
- assigned user,
- maintenance history.

---

# 37. Staff Leave & Substitute Management — NEW

Teacher/staff can:

- request leave,
- view leave balance,
- upload supporting documents if required.

Admin/principal:

- approve/reject,
- find substitute,
- notify affected classes.

AI can recommend substitute candidates using non-sensitive operational criteria such as:

- free period,
- subject match,
- class familiarity.

Final assignment is human-controlled.

---

# 38. Event & Calendar Hub — NEW

Unified calendar:

- exams,
- holidays,
- meetings,
- parent meetings,
- events,
- assignment deadlines,
- fee deadlines,
- staff leave.

Views:

- month,
- week,
- agenda.

Role-specific visibility.

---

# 39. Surveys & Feedback — NEW

Create surveys for:

- parents,
- students,
- teachers,
- staff.

Question types:

- rating,
- MCQ,
- text,
- multiple select.

AI may summarize anonymous aggregated responses.

Do not expose individual responses unless the survey explicitly allows it.

---

# 40. Helpdesk / School Support — NEW

Create internal ticketing:

```text
Issue
Category
Priority
Reporter
Assignee
Status
Comments
Attachments
Resolution
```

Categories:

- IT,
- facilities,
- academics,
- fees,
- transport,
- library,
- account access.

AI can classify tickets and draft responses.

---

# 41. Consent Management — NEW

Track explicit consent for:

- photographs/media,
- excursions,
- online classes,
- data processing notices,
- transport,
- optional services.

Parent can:

- view consent,
- grant,
- revoke where permitted.

Every consent change is audited.

---

# 42. Import / Export Center — NEW

Admin can import:

- students,
- teachers,
- parents,
- classes,
- fee structures,
- historical marks,
- attendance.

CSV import pipeline:

```text
Upload
 -> Parse
 -> Validate
 -> Preview
 -> Fix errors
 -> Confirm
 -> Background import
 -> Summary
```

Never partially import a batch without clearly reporting failures.

Export:

- CSV,
- XLSX,
- PDF where useful.

Exports are audited.

---

# 43. Advanced Search — NEW

Global search for authorized records:

```text
Students
Parents
Teachers
Classes
Documents
Fees
Results
Announcements
Tickets
Events
```

Requirements:

- tenant-scoped,
- role-scoped,
- typo tolerant,
- fast,
- keyboard accessible.

Do not expose sensitive fields in autocomplete.

---

# 44. PWA / Offline-Friendly Teacher Mode — NEW

Teachers frequently operate in classrooms with poor connectivity.

Add PWA support for selected workflows.

Offline candidates:

- attendance,
- class roster,
- lesson notes.

Flow:

```text
Online
 -> cache class data

Offline
 -> teacher marks attendance

Reconnect
 -> sync

Server
 -> validate
 -> resolve conflict
 -> audit
```

Do not attempt to make the entire ERP offline.

---

# 45. Performance Requirements

## 45.1 Frontend

Target:

- fast initial render,
- route-level code splitting,
- lazy-load heavy components,
- optimized images,
- virtualized long tables,
- skeleton loading,
- optimistic UI where safe,
- no unnecessary global state.

## 45.2 API

Target:

- common reads under 300ms at p50 under normal load,
- common mutations under 500ms p50 excluding external providers,
- AI responses streamed where interactive.

Do not block CRUD requests on:

- email,
- AI,
- PDF generation,
- large imports.

Use background jobs.

## 45.3 Database

Add indexes for:

- tenant_id,
- foreign keys,
- status,
- created_at,
- common filter combinations.

Avoid N+1 queries.

Paginate all large lists.

Never return unlimited rows.

---

# 46. Background Job System — NEW

Introduce a reliable job mechanism.

Use the simplest production-compatible option for the current infrastructure.

Jobs:

- emails,
- AI reports,
- AI digests,
- PDF generation,
- CSV imports,
- scheduled notifications,
- workflow automation,
- cleanup,
- analytics aggregation.

Job model:

```text
job
- id
- tenant_id
- type
- payload
- status
- attempts
- max_attempts
- run_at
- locked_at
- last_error
- created_at
- completed_at
```

Jobs must be idempotent.

---

# 47. Email System — Resend

Replace the existing SMTP/Gmail-style configuration with Resend.

## 47.1 Environment

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL="mAI-school <info@maischool.ayushdixit.work>"
RESEND_WEBHOOK_SECRET=
```

The sending domain must be verified in Resend before production sending.

## 47.2 Email service

Create:

```text
EmailService
  send()
  sendTemplate()
  sendBatch()
  schedule()
```

Never call Resend directly from UI code.

## 47.3 Transactional templates

Create templates for:

- school onboarding,
- admin welcome,
- password reset,
- email verification,
- parent invitation,
- teacher invitation,
- student invitation,
- fee reminder,
- payment receipt,
- exam result published,
- announcement,
- meeting reminder,
- event reminder,
- intervention notification,
- weekly parent digest,
- system alerts.

## 47.4 Email delivery tracking

Store:

```text
email_message
- id
- tenant_id
- recipient_id
- provider_message_id
- template
- status
- sent_at
- delivered_at
- opened_at
- bounced_at
- complained_at
```

Resend webhooks should update these statuses.

Verify webhook signatures before processing.

## 47.5 Email reliability

Requirements:

- retries,
- exponential backoff,
- idempotency,
- bounce handling,
- complaint handling,
- dead-letter state,
- admin delivery logs.

Email sending must never block a user-facing request.

---

# 48. AI Cost Governance

Because AI is multi-tenant, cost control is a product requirement.

## Tenant AI quota

```text
AI requests/day
AI tokens/day
AI estimated cost/day
```

Admin sees:

```text
AI usage
Requests
Tokens
Estimated cost
Top features
Top users
```

## Rate limiting

Separate:

- user limit,
- tenant limit,
- IP limit,
- expensive-feature limit.

## Cost-aware routing

Example:

```text
Simple classification
 -> FAST

Draft announcement
 -> FAST/STANDARD

Student tutoring
 -> STANDARD

Complex principal analysis
 -> REASONING
```

## Prompt caching

Reuse stable system instructions where supported.

Avoid sending repetitive large context.

---

# 49. AI Data Privacy

AI requests must follow least privilege.

Never send:

- passwords,
- JWTs,
- payment credentials,
- unnecessary identity documents,
- secrets,
- raw authentication records.

For student queries, only send fields required for the task.

Example:

Bad:

```json
{
  "entireStudentRecord": {}
}
```

Good:

```json
{
  "subject": "Mathematics",
  "recentScores": [62, 71, 68],
  "topicsNeedingPractice": ["fractions"]
}
```

---

# 50. AI Prompt Injection Protection

School content may contain arbitrary text.

Treat:

- assignment text,
- uploaded documents,
- student messages,
- announcements,
- teacher notes

as untrusted data.

Never allow retrieved text to override system/developer instructions.

Tool permissions must be enforced outside the model.

---

# 51. AI Structured Output Validation

Never trust raw AI JSON.

Flow:

```text
OpenAI
 -> parse
 -> schema validation
 -> business validation
 -> authorization
 -> persist
```

If invalid:

```text
retry with repair prompt
```

If still invalid:

```text
fail safely
```

---

# 52. AI Feature Auditability

For generated content store:

```text
ai_generation
- id
- tenant_id
- user_id
- feature
- model
- source_type
- source_ids
- created_at
```

Do not store full sensitive prompts indefinitely unless necessary.

Allow administrators to configure retention.

---

# 53. UI/UX Redesign

## 53.1 Design direction

Modern:

- calm,
- premium,
- minimal,
- responsive,
- accessible,
- low cognitive load.

Avoid:

- dashboard clutter,
- excessive cards,
- giant tables on mobile,
- too many colors,
- decorative animations that hurt performance.

## 53.2 Navigation

Desktop:

```text
Sidebar
  Dashboard
  People
  Academics
  Attendance
  Fees
  Communication
  Calendar
  AI
  Reports
  Documents
  Operations
  Settings
```

Mobile:

- bottom navigation for top actions,
- slide-over navigation,
- floating contextual action where appropriate.

## 53.3 Role-specific navigation

Do not show all modules to every user.

Teacher should see:

```text
Home
My Classes
Attendance
Assignments
Assessments
AI Studio
Messages
Calendar
```

Student:

```text
Home
Learning
Assignments
Results
AI Tutor
Calendar
Messages
Profile
```

Admin:

```text
Home
People
Academics
Finance
Communication
Operations
AI Insights
Reports
Settings
```

## 53.4 Responsive tables

On mobile:

- cards,
- expandable rows,
- horizontal scrolling only when unavoidable.

## 53.5 Loading

Use:

- skeletons,
- optimistic updates,
- inline progress,
- non-blocking toasts.

## 53.6 Empty states

Every empty state should explain:

1. what is empty,
2. why it matters,
3. what the user can do next.

---

# 54. Motion / Effects

Use subtle effects:

- page transition,
- hover elevation,
- card entrance,
- progress animation,
- number transitions,
- command palette animation.

Rules:

- respect `prefers-reduced-motion`,
- avoid animation on critical workflows,
- no continuous expensive animations,
- keep mobile performance high.

---

# 55. Command Palette — NEW

Add:

`Cmd/Ctrl + K`

Actions:

```text
Find student
Create announcement
Mark attendance
Open AI assistant
Create assignment
Search fee records
Open settings
Switch child
```

Role-aware.

---

# 56. Dashboard Personalization — NEW

Users can:

- reorder widgets,
- hide widgets,
- choose compact/comfortable density.

Store per-user preferences.

Admins can define default layouts by role.

---

# 57. Feature Flags — NEW

Tenant-level feature flags:

```text
AI_TUTOR
AI_TEACHER_STUDIO
AI_PRINCIPAL_INSIGHTS
PARENT_PORTAL
TRANSPORT
LIBRARY
ADMISSIONS
WORKFLOWS
PWA_OFFLINE
```

Platform Admin can enable/disable globally.

School Admin can see enabled modules.

Never ship unfinished features as visible production modules.

---

# 58. School Configuration Center — NEW

Create a setup wizard:

```text
School Profile
Academic Year
Classes
Subjects
Grading
Attendance Rules
Fee Rules
Communication
AI Settings
Parent Settings
Branding
Roles
```

Show:

```text
Setup completion: 82%
```

Each item links directly to the required action.

---

# 59. School Onboarding Improvements

Current self-service onboarding should be extended with:

1. School details.
2. Branding.
3. Academic year.
4. Classes.
5. Subjects.
6. Admin.
7. Import students.
8. Import teachers.
9. Fee configuration.
10. Notification preferences.
11. AI policy.
12. Parent invitation.
13. Go-live checklist.

Allow skipping non-critical steps.

---

# 60. Go-Live Checklist

Admin sees:

```text
✓ School profile
✓ Admin account
✓ Academic year
✓ Classes
✓ Teachers
✓ Students

⚠ Fee structure
⚠ Parent invitations
⚠ Attendance rules
⚠ Branding
⚠ Email verification
```

Button:

**Complete setup**

---

# 61. Billing & Subscription Operations — NEW

If mAI-school is distributed commercially, add platform billing primitives even if payment collection is initially manual.

Tenant:

```text
plan
student_limit
active_students
billing_status
billing_cycle
subscription_start
subscription_end
```

Statuses:

```text
Trial
Active
Past Due
Suspended
Cancelled
```

Add:

- invoices,
- payment history,
- plan changes,
- usage meter,
- export.

Payment gateway can be integrated later without changing tenant billing architecture.

---

# 62. Tenant Branding

Each school can configure:

- logo,
- favicon,
- primary color,
- secondary color,
- email logo,
- report-card branding,
- certificate branding,
- login background,
- school name,
- contact details.

Validate colors for accessibility.

---

# 63. White-Label Readiness

Architecture should support:

```text
school-a.maischool.ayushdixit.work
school-b.maischool.ayushdixit.work
```

Future custom domain:

```text
portal.schoolname.edu
```

Store:

```text
tenant_domain
- tenant_id
- hostname
- type
- verified
- active
```

---

# 64. Observability

Production must have:

## Logs

Structured JSON:

```text
timestamp
level
service
request_id
tenant_id
user_id
route
duration
status
error_code
```

Never log:

- passwords,
- JWTs,
- API keys,
- full sensitive student records.

## Metrics

Track:

- request latency,
- error rate,
- DB latency,
- GraphQL errors,
- job failures,
- email failures,
- AI latency,
- AI token usage,
- AI errors,
- login failures.

## Health endpoints

```text
GET /health
GET /health/live
GET /health/ready
```

Readiness checks:

- database,
- required configuration,
- critical dependencies.

Do not expose sensitive details.

---

# 65. Error Handling

Standard API error:

```json
{
  "error": {
    "code": "ATTENDANCE_ALREADY_LOCKED",
    "message": "Attendance is locked for this date.",
    "requestId": "..."
  }
}
```

Never expose stack traces in production.

Create stable error codes for frontend handling.

---

# 66. Rate Limiting

Protect:

- login,
- password reset,
- OTP/MFA,
- public admissions,
- AI,
- file uploads,
- exports,
- bulk operations,
- GraphQL complexity.

Rate limits must be tenant-aware where appropriate.

---

# 67. GraphQL Security

Add:

- query depth limits,
- complexity limits,
- pagination enforcement,
- introspection policy for production,
- authorization at resolver/data layer,
- timeout,
- persisted queries if practical.

Never rely on UI restrictions to secure GraphQL.

---

# 68. REST Security

Every REST endpoint must define:

```text
Authentication
Authorization
Tenant scope
Input validation
Rate limit
Audit requirement
```

Document this in API documentation.

---

# 69. File Upload Security

Requirements:

- MIME validation,
- extension validation,
- size limits,
- virus/malware scanning where infrastructure permits,
- random storage names,
- signed URLs,
- tenant-scoped paths,
- no executable file types,
- audit downloads.

Never trust filename extensions.

---

# 70. Data Retention

Tenant settings:

```text
audit log retention
AI log retention
notification retention
email event retention
document retention
```

Provide configurable cleanup jobs.

Deletion should respect legal and operational requirements.

---

# 71. Backups & Disaster Recovery

Production database:

- automated backups,
- point-in-time recovery if supported,
- encrypted backups,
- retention policy,
- restore testing.

Document:

```text
RPO target
RTO target
backup frequency
restore process
```

A backup that has never been restored/tested is not considered production-ready.

---

# 72. Database Migration Safety

Every schema change must:

- have migration,
- be backward-compatible where possible,
- be tested against production-like data,
- avoid destructive migration without explicit migration plan.

For large tables:

```text
add nullable column
backfill
deploy code
enforce constraint later
```

---

# 73. Testing Strategy

## Unit tests

Services:

- authorization,
- fee calculation,
- attendance rules,
- grade calculations,
- workflow triggers,
- AI routing,
- notification preferences.

## Integration tests

- GraphQL,
- REST,
- PostgreSQL,
- Resend adapter,
- AI adapter,
- authentication.

## Tenant isolation tests

Mandatory.

## E2E tests

Critical flows:

### School onboarding

```text
Start online
 -> create tenant
 -> receive email
 -> login
 -> setup school
```

### Teacher

```text
Login
 -> open class
 -> mark attendance
 -> create assignment
 -> publish
```

### Student

```text
Login
 -> see assignment
 -> submit
 -> view result
 -> use AI tutor
```

### Parent

```text
Accept invitation
 -> login
 -> link child
 -> view attendance
 -> view assignment
 -> read digest
```

### AI teacher

```text
Open AI Studio
 -> select subject
 -> generate worksheet
 -> validate
 -> edit
 -> publish
```

### AI admin

```text
Ask operational question
 -> tool query
 -> result
 -> explanation
```

### Email

```text
Trigger event
 -> enqueue email
 -> send Resend
 -> receive webhook
 -> update delivery status
```

---

# 74. AI Evaluation

Do not test AI only by checking HTTP 200.

Create evaluation datasets.

Examples:

```text
Question generation
Expected:
- correct answer
- valid structure
- appropriate difficulty
- no duplicate questions
```

Tutor:

```text
Expected:
- correct concept
- age appropriate
- does not give answer when hint mode is active
```

Principal insight:

```text
Expected:
- only uses supplied data
- no invented statistics
- correct aggregation
```

Run evaluations before changing production prompts/models.

---

# 75. Security Acceptance Criteria

Production launch is blocked unless:

- [ ] No known tenant isolation vulnerability.
- [ ] JWT secrets are environment-only.
- [ ] OpenAI key is server-only.
- [ ] Resend key is server-only.
- [ ] Password hashes are never returned.
- [ ] Refresh tokens are revocable.
- [ ] Sensitive actions are audited.
- [ ] File URLs expire.
- [ ] Rate limiting exists.
- [ ] GraphQL query limits exist.
- [ ] Error messages do not leak internal details.
- [ ] Backups are tested.
- [ ] Production CORS is restricted.
- [ ] HTTPS is enforced.
- [ ] Security headers are configured.
- [ ] Dependency vulnerabilities are reviewed.
- [ ] Admin accounts can use MFA.

---

# 76. Performance Acceptance Criteria

Target under normal production load:

- [ ] Dashboard loads progressively.
- [ ] Common list queries are paginated.
- [ ] No N+1 queries on core screens.
- [ ] Mobile navigation feels instant.
- [ ] Attendance marking does not require a full page reload.
- [ ] AI responses stream when interactive.
- [ ] Email never blocks normal CRUD.
- [ ] PDF generation is asynchronous.
- [ ] Imports are asynchronous.
- [ ] Large tables use virtualization or pagination.
- [ ] Images are optimized.
- [ ] Heavy AI/reporting code is lazy loaded.

---

# 77. AI Acceptance Criteria

- [ ] Model configured through env.
- [ ] API key configured through env.
- [ ] Model router exists.
- [ ] AI usage is logged.
- [ ] Tenant quotas exist.
- [ ] User quotas exist.
- [ ] AI requests are tenant-scoped.
- [ ] Tool access is role-scoped.
- [ ] AI cannot bypass authorization.
- [ ] AI mutations require explicit confirmation.
- [ ] Structured output is schema validated.
- [ ] Prompt injection protections exist.
- [ ] Student AI has age/safety controls.
- [ ] Assessment anti-cheating policy exists.
- [ ] AI failure does not break core school operations.

---

# 78. Email Acceptance Criteria

- [ ] Resend SDK integrated server-side.
- [ ] `info@maischool.ayushdixit.work` configured as sender.
- [ ] Sending domain verified.
- [ ] Email templates are branded.
- [ ] Password reset works.
- [ ] Parent invitation works.
- [ ] Teacher invitation works.
- [ ] Fee reminders work.
- [ ] Result notifications work.
- [ ] Resend webhooks work.
- [ ] Webhook signatures verified.
- [ ] Bounce/complaint states stored.
- [ ] Retry mechanism exists.
- [ ] Email jobs are idempotent.
- [ ] Email delivery logs are visible to authorized admins.

---

# 79. Product Analytics

Track product events without collecting unnecessary personal data.

Examples:

```text
school_created
student_created
teacher_invited
parent_invited
attendance_marked
assignment_created
assignment_submitted
result_published
ai_tutor_used
ai_lesson_generated
ai_question_generated
email_sent
email_bounced
workflow_triggered
```

Tenant admins see school-level analytics.

Platform admins see aggregate platform analytics.

---

# 80. Recommended Core Metrics

## School operations

- daily attendance rate,
- assignment completion,
- fee collection,
- overdue fees,
- exam completion,
- unresolved interventions,
- parent engagement.

## Product

- weekly active schools,
- weekly active teachers,
- student active rate,
- parent activation rate,
- AI usage,
- AI cost/student,
- email delivery rate,
- error rate,
- p95 API latency.

---

# 81. UX Accessibility

Target WCAG-oriented practices:

- keyboard navigation,
- visible focus,
- semantic labels,
- accessible forms,
- sufficient contrast,
- screen-reader-friendly dialogs,
- no color-only status indicators,
- reduced-motion support.

---

# 82. Localization Readiness

Even if initially English-only, schema/UI should support:

```text
locale
timezone
currency
date_format
number_format
```

Future:

- Hindi,
- regional Indian languages.

AI should be able to respond in the student's configured language.

---

# 83. Indian School Readiness

Make configurable rather than hard-coded:

- academic sessions,
- grading systems,
- percentage/CGPA,
- class/section terminology,
- fee schedules,
- school holidays,
- roll numbers,
- admission numbers,
- transport,
- parent/guardian naming.

Avoid hard-coding CBSE/ICSE/state-board rules into core logic.

Create configurable academic frameworks.

---

# 84. Data Model Expansion

Recommended high-level entities:

```text
tenant
tenant_domain
tenant_feature_flag
tenant_setting

user
role
permission
user_session
user_tenant_membership

student
guardian
student_guardian
teacher
staff

academic_year
class
section
subject
enrollment

attendance
assignment
assignment_submission
assessment
question
question_bank
grade

admission
applicant
application_document
interview

fee_plan
invoice
payment
payment_receipt

document
document_version
certificate
certificate_verification

notification
notification_preference
message_thread
message

event
calendar_entry
meeting

intervention
student_support_signal

library_book
library_copy
library_transaction

vehicle
transport_route
transport_stop
student_transport

asset
asset_assignment
maintenance_ticket

leave_request
substitute_assignment

survey
survey_response

workflow
workflow_trigger
workflow_action
workflow_execution

ai_generation
ai_usage
ai_feedback

email_message
email_event

audit_log
job
feature_flag
```

Do not implement every table at once. Introduce them through feature migrations.

---

# 85. API Design Principles

## GraphQL

Use strongly typed inputs.

Avoid:

```graphql
updateStudent(data: JSON)
```

Prefer:

```graphql
updateStudent(
  input: UpdateStudentInput!
): Student
```

## REST

Use consistent:

```text
POST
GET
PATCH
DELETE
```

Use versioning for public/integration APIs:

```text
/api/v1/...
```

---

# 86. Idempotency

Required for:

- payments,
- email sends,
- imports,
- workflow actions,
- AI-generated mutations,
- webhook processing.

Example:

```http
Idempotency-Key: <uuid>
```

Store processed keys where required.

---

# 87. Webhook Architecture

Create webhook endpoints for:

- Resend,
- future payment gateway,
- future integrations.

Requirements:

- signature validation,
- raw-body verification,
- idempotency,
- event log,
- retry-safe handling.

---

# 88. Admin Data Export

Admin can request export.

Flow:

```text
Request export
 -> permission validation
 -> background job
 -> generate file
 -> temporary signed URL
 -> audit
```

Do not generate large exports synchronously.

---

# 89. Notification Preferences

Each user can configure:

```text
Email
In-app
Push later
```

Categories:

- attendance,
- fees,
- assignments,
- exams,
- announcements,
- meetings,
- AI digests,
- system.

Critical security notifications cannot be disabled.

---

# 90. AI UX

AI should never feel like a generic chatbot pasted into the ERP.

Use contextual actions:

```text
Student page
  -> Explain performance

Class page
  -> Create worksheet

Attendance page
  -> Find attendance trends

Fees page
  -> Draft reminders

Principal dashboard
  -> Explain this trend

Assignment page
  -> Generate rubric
```

Add a global AI entry point as a secondary option.

---

# 91. AI Citation / Evidence UX

When AI produces an insight:

```text
Why am I seeing this?

Attendance fell from 91% to 82%
for Grade 8B over the last 30 days.

Based on:
- 30-day attendance records
- class roster
- previous 30-day comparison
```

This is more trustworthy than an unexplained generated statement.

---

# 92. AI Feedback Loop

For AI outputs:

```text
Helpful
Not helpful
Report issue
```

Store lightweight feedback:

```text
ai_generation_id
rating
reason
created_at
```

Use this for evaluation and prompt/model improvements.

---

# 93. AI Fallback Behavior

If OpenAI is unavailable:

- core school management remains functional,
- AI button shows temporary unavailable state,
- retry option,
- no data loss,
- background AI jobs retry,
- admin sees AI service health.

Never make attendance, fees, login, or exams depend on AI availability.

---

# 94. Cost Controls by Feature

Recommended defaults:

```text
Simple summaries       -> cheap/fast model
Classification         -> cheapest capable model
Email drafting         -> cheap/fast model
Worksheet generation  -> standard model
Student tutor          -> standard model
Principal analysis     -> reasoning model when needed
Large report synthesis -> reasoning model
```

Keep all model IDs configurable.

---

# 95. Production Environment Variables

Suggested final environment contract:

```env
# App
NODE_ENV=production
APP_URL=
PUBLIC_API_URL=

# Database
DATABASE_URL=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=

# Auth
JWT_SECRET=
JWT_ISSUER=mai-school
JWT_AUDIENCE=postgraphile
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# GraphQL
MAI_GRAPHQL_DB_USER=
MAI_GRAPHQL_DB_PASSWORD=

# CORS
CORS_ORIGINS=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL="mAI-school <info@maischool.ayushdixit.work>"
RESEND_WEBHOOK_SECRET=

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_FAST_MODEL=
OPENAI_REASONING_MODEL=

# AI
AI_ENABLED=true
AI_MAX_OUTPUT_TOKENS=
AI_TIMEOUT_MS=
AI_DAILY_TENANT_LIMIT=
AI_DAILY_USER_LIMIT=

# Storage
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

# Jobs
JOB_CONCURRENCY=

# Observability
LOG_LEVEL=
SENTRY_DSN=

# Feature flags
ENABLE_PARENT_PORTAL=
ENABLE_AI_TUTOR=
ENABLE_AI_TEACHER_STUDIO=
ENABLE_ADMISSIONS=
ENABLE_TRANSPORT=
ENABLE_LIBRARY=
```

Do not commit real values.

---

# 96. Environment Validation

Application startup must validate required variables.

Fail fast for missing production secrets.

Example:

```text
Missing required environment variable:
RESEND_API_KEY
```

Do not start a production server with an invalid security configuration.

---

# 97. Deployment Requirements

Production deployment must support:

```text
Build
 -> migrations
 -> health check
 -> rolling restart
 -> smoke test
```

Never run destructive migrations automatically without safeguards.

---

# 98. CI/CD

Pipeline:

```text
Pull Request
  |
  +-- lint
  +-- typecheck
  +-- unit tests
  +-- integration tests
  +-- tenant isolation tests
  +-- build
  +-- security/dependency scan
        |
        v
     merge
        |
        v
     staging
        |
        v
  smoke tests
        |
        v
   production
```

---

# 99. Staging Environment

Maintain:

```text
staging.maischool...
```

Use:

- separate database,
- separate OpenAI key/project where possible,
- separate Resend domain or test mode,
- synthetic data.

Never test AI/email changes directly against real student data.

---

# 100. Seed / Demo School

Create a realistic demo tenant:

```text
Demo School
10 classes
20 teachers
200 students
200 parents
attendance history
exam history
fee records
assignments
library records
events
```

This makes sales demos and regression testing much easier.

---

# 101. Production Admin Console

Platform Admin should have:

### Tenants

- list,
- search,
- status,
- student count,
- plan,
- creation date,
- health.

### Usage

- active users,
- API usage,
- AI usage,
- email usage.

### Health

- error rate,
- job queue,
- database health,
- AI health,
- email health.

### Security

- suspicious login events,
- tenant isolation alerts,
- audit activity.

---

# 102. School Health Score

Do not create an arbitrary score that hides meaning.

Instead display explicit readiness signals:

```text
Attendance configured
Fees configured
Teachers assigned
Students imported
Parent activation
Email verified
Academic year active
```

Show actions rather than a single unexplained number.

---

# 103. Product Differentiators

The following should become the core differentiation:

## 1. AI-native school operations

AI understands authorized school data and can produce useful operational insights.

## 2. AI-native teaching

Teacher AI Studio reduces preparation workload.

## 3. AI-native learning

Students receive guided, curriculum-aware tutoring.

## 4. Parent intelligence

Parents receive concise, actionable progress summaries.

## 5. Intervention system

The platform turns weak signals into human-reviewed support workflows.

## 6. Automation

Schools configure "when this happens, do that" workflows.

## 7. Evidence-based AI

AI explains the records behind its insights.

## 8. Fast school setup

A school can go from signup to useful operation without a consultant.

---

# 104. What NOT to Build

Avoid unnecessary complexity in v1:

- native iOS app,
- native Android app,
- microservices,
- custom LLM training,
- blockchain,
- cryptocurrency,
- fully autonomous disciplinary decisions,
- fully autonomous admissions decisions,
- facial recognition attendance,
- continuous child GPS tracking,
- AI medical diagnosis,
- AI psychological diagnosis,
- unrestricted student-to-student AI chat,
- unrestricted public AI endpoints.

Use the web/PWA architecture first.

---

# 105. Phased Delivery Plan

## Phase 0 — Production Hardening

Priority: **P0**

Implement:

- tenant isolation audit,
- auth hardening,
- refresh tokens,
- session management,
- audit logs,
- rate limiting,
- GraphQL limits,
- error handling,
- health endpoints,
- structured logs,
- backups,
- migrations,
- CI/CD,
- environment validation,
- Resend,
- notification abstraction,
- background jobs.

**Exit criteria:** existing school functionality remains stable and security tests pass.

---

## Phase 1 — Commercial School Core

Priority: **P0**

Implement:

- parent portal,
- student lifecycle,
- document vault,
- document generation,
- notification center,
- communication hub,
- events/calendar,
- admissions,
- import/export,
- school setup checklist.

**Exit criteria:** a real school can onboard staff/students/parents and operate day-to-day without external spreadsheets for the covered workflows.

---

## Phase 2 — AI Foundation

Priority: **P0**

Implement:

- AI provider abstraction,
- OpenAI integration,
- model router,
- quotas,
- AI audit,
- structured outputs,
- prompt security,
- AI observability,
- AI feature flags,
- streaming.

**Exit criteria:** AI can be enabled per tenant without exposing secrets or cross-tenant data.

---

## Phase 3 — AI Admin / Principal

Priority: **P1**

Implement:

- school copilot,
- daily brief,
- weekly principal report,
- operational Q&A,
- fee assistant,
- communication assistant,
- intervention suggestions.

---

## Phase 4 — AI Teacher

Priority: **P1**

Implement:

- lesson planner,
- worksheet generator,
- question-paper generator,
- rubric generator,
- feedback assistant,
- assignment analysis,
- teacher AI Studio.

---

## Phase 5 — AI Student

Priority: **P1**

Implement:

- AI tutor,
- study planner,
- practice generator,
- mistake explanation,
- flashcards,
- personalized learning plan,
- exam prep.

---

## Phase 6 — Advanced Operations

Priority: **P2**

Implement:

- library,
- transport,
- inventory,
- staff leave,
- substitute management,
- helpdesk,
- surveys,
- consent.

---

## Phase 7 — Optimization

Priority: **P2**

Implement:

- PWA offline attendance,
- command palette,
- advanced search,
- dashboard personalization,
- analytics,
- AI cost optimization,
- performance tuning.

---

# 106. Feature Priority Matrix

| Feature | Priority | User | Business Value | Complexity |
|---|---|---|---|---|
| Tenant isolation hardening | P0 | Platform | Critical | Medium |
| Auth/session hardening | P0 | All | Critical | Medium |
| Audit logs | P0 | Admin | Critical | Medium |
| Resend email | P0 | All | Critical | Low |
| Background jobs | P0 | System | Critical | Medium |
| Parent portal | P0 | Parent | Very High | High |
| Documents | P0 | Admin/Student/Parent | High | Medium |
| Admissions | P0 | Admin | Very High | High |
| Notification center | P0 | All | High | Medium |
| AI foundation | P0 | System | Critical | High |
| AI admin copilot | P1 | Admin | Very High | High |
| AI principal insights | P1 | Principal | Very High | High |
| AI teacher studio | P1 | Teacher | Very High | High |
| AI student tutor | P1 | Student | Very High | High |
| Intervention system | P1 | Teacher/Principal | Very High | High |
| Workflow automation | P1 | Admin | Very High | High |
| Library | P2 | Admin/Student | Medium | Medium |
| Transport | P2 | Admin/Parent | High | High |
| Inventory | P2 | Admin | Medium | Medium |
| Staff leave | P2 | Staff/Admin | Medium | Medium |
| PWA offline | P2 | Teacher | High | Medium |
| Advanced search | P2 | All | High | Medium |

---

# 107. Definition of Done

A feature is not complete when the screen works.

A feature is complete only when:

- [ ] database migration exists,
- [ ] GraphQL/REST contract exists,
- [ ] backend service exists,
- [ ] authorization exists,
- [ ] tenant isolation exists,
- [ ] validation exists,
- [ ] frontend exists,
- [ ] loading state exists,
- [ ] empty state exists,
- [ ] error state exists,
- [ ] mobile layout exists,
- [ ] accessibility is considered,
- [ ] audit behavior exists where required,
- [ ] notification behavior exists where required,
- [ ] unit tests exist,
- [ ] integration tests exist,
- [ ] E2E test exists for critical flow,
- [ ] documentation exists,
- [ ] feature flag exists if risky,
- [ ] observability exists,
- [ ] migration is production safe.

---

# 108. Critical End-to-End User Journeys

## Journey A — New School

```text
Marketing site
 -> Start online
 -> Create school
 -> Provision tenant
 -> Send admin email through Resend
 -> Admin verifies email
 -> Login
 -> Setup checklist
 -> Import teachers/students
 -> Configure academic year
 -> Configure fees
 -> Invite parents
 -> Go live
```

## Journey B — Teacher

```text
Login
 -> Today's classes
 -> Mark attendance
 -> AI lesson plan
 -> Create assignment
 -> Publish
 -> Student submits
 -> Teacher reviews
 -> AI feedback draft
 -> Teacher approves
 -> Parent receives notification
```

## Journey C — Student

```text
Login
 -> Today's learning
 -> See assignment
 -> Study
 -> AI tutor
 -> Submit assignment
 -> Receive teacher feedback
 -> View progress
 -> Follow AI study plan
```

## Journey D — Parent

```text
Receive invitation
 -> Verify email
 -> Set password
 -> Login
 -> Select child
 -> View attendance
 -> View assignments
 -> View results
 -> Read weekly AI digest
 -> Message teacher
 -> Book meeting
```

## Journey E — Principal

```text
Login
 -> Daily brief
 -> Attendance trend
 -> Academic trend
 -> Identify support signal
 -> Review evidence
 -> Create intervention
 -> Assign teacher
 -> Track outcome
```

## Journey F — AI

```text
User asks question
 -> Authenticated request
 -> Tenant context
 -> Permission evaluation
 -> Tool selection
 -> Minimal data retrieval
 -> OpenAI
 -> Structured validation
 -> Response
 -> Evidence
 -> Audit metadata
```

---

# 109. AI Tool Permission Matrix

| Tool | Admin | Principal | Teacher | Student | Parent |
|---|---:|---:|---:|---:|---:|
| School attendance summary | ✓ | ✓ | Class only | Own | Child |
| School fee summary | ✓ | Configurable | No | Own status | Child |
| Generate announcement | ✓ | ✓ | Class | No | No |
| Generate lesson | ✓ | ✓ | ✓ | No | No |
| Generate worksheet | ✓ | ✓ | ✓ | Practice only | No |
| Student tutor | No | No | No | ✓ | No |
| Student performance analysis | ✓ | ✓ | Assigned | Own | Child |
| Create intervention | ✓ | ✓ | ✓ | No | No |
| Fee reminder draft | ✓ | Configurable | No | No | No |
| Mutate school records | Confirmed | Confirmed | Scoped | No | No |

---

# 110. Recommended AI Response Contract

For structured business insights:

```json
{
  "answer": "Attendance in Grade 8B declined over the last 30 days.",
  "evidence": [
    {
      "type": "attendance",
      "label": "Grade 8B attendance",
      "value": "82%"
    }
  ],
  "suggestedActions": [
    {
      "type": "create_task",
      "label": "Ask the class teacher to review attendance."
    }
  ],
  "requiresConfirmation": true
}
```

The server must validate:

- allowed action types,
- user permission,
- tenant ownership,
- referenced entity IDs.

---

# 111. AI Prompt Architecture

Use:

```text
System policy
+
Role policy
+
Feature policy
+
School configuration
+
Minimal structured context
+
User request
```

Do not construct giant prompts from raw database dumps.

Example:

```text
ROLE:
teacher

FEATURE:
lesson_planner

SCHOOL:
class = 8
subject = mathematics

CONSTRAINTS:
45 minutes
CBSE-compatible configuration if school selected it
student age appropriate

REQUEST:
Create a lesson plan for linear equations.
```

---

# 112. Prompt Versioning

Store prompt versions in code/config:

```text
teacher.lesson_plan.v1
teacher.lesson_plan.v2
student.tutor.v1
principal.daily_brief.v1
```

AI usage record should identify the prompt version.

This makes regressions diagnosable.

---

# 113. AI Safety Escalation

For a student saying:

> "I don't want to be alive."

The AI must not behave as a normal tutoring assistant.

It should:

- respond safely,
- encourage immediate support from a trusted adult,
- follow configured school safety escalation policy,
- avoid promising secrecy,
- avoid diagnosing.

The product should provide a school-configurable escalation mechanism rather than pretending the AI can handle emergencies independently.

---

# 114. Parent Communication Safety

Parent/teacher communication should support:

- school-defined availability,
- moderation/reporting,
- message retention policy,
- attachment restrictions,
- role-based communication boundaries.

---

# 115. Database Indexing Guidelines

At minimum, tenant-scoped indexes should be evaluated for:

```text
(tenant_id, created_at)
(tenant_id, status)
(tenant_id, user_id)
(tenant_id, student_id)
(tenant_id, class_id)
(tenant_id, academic_year_id)
```

Add composite indexes based on real query plans rather than guessing.

Use:

```sql
EXPLAIN ANALYZE
```

for slow production-like queries.

---

# 116. Caching

Safe cache candidates:

- school branding,
- feature flags,
- static configuration,
- subject lists,
- academic metadata.

Do not cache sensitive per-user data without explicit keying.

Cache key must include tenant and relevant user scope.

Example:

```text
tenant:{tenantId}:branding
tenant:{tenantId}:feature-flags
```

---

# 117. Database Connection Management

Production must:

- configure connection pool limits,
- avoid one connection per request,
- monitor pool exhaustion,
- use transaction boundaries intentionally,
- avoid long transactions.

---

# 118. Bulk Operations

Bulk operations should have:

- preview,
- validation,
- confirmation,
- background execution,
- progress,
- downloadable error report.

Example:

```text
Import 2,400 students

Valid: 2,320
Warnings: 50
Errors: 30

[Download errors]
[Start import]
```

---

# 119. School Data Ownership

Product documentation should clearly state:

- each tenant has isolated data,
- school controls school content,
- platform operates infrastructure,
- access is role-based,
- AI only receives authorized context,
- data deletion/export follows configured policies.

---

# 120. Production Launch Checklist

## Infrastructure

- [ ] Production DB configured.
- [ ] Backup configured.
- [ ] Restore test completed.
- [ ] HTTPS.
- [ ] DNS.
- [ ] Tenant subdomains.
- [ ] Health checks.
- [ ] Monitoring.
- [ ] Logs.
- [ ] Error tracking.

## Security

- [ ] JWT secrets rotated.
- [ ] Refresh token system.
- [ ] Password security.
- [ ] Rate limits.
- [ ] CORS.
- [ ] Security headers.
- [ ] GraphQL limits.
- [ ] File security.
- [ ] Audit logs.
- [ ] Admin MFA.

## Email

- [ ] Resend account.
- [ ] Domain verified.
- [ ] `info@maischool.ayushdixit.work`.
- [ ] SPF/DKIM configuration completed through Resend.
- [ ] Templates.
- [ ] Webhook.
- [ ] Webhook signature verification.
- [ ] Bounce handling.
- [ ] Delivery dashboard.

## AI

- [ ] OpenAI API key.
- [ ] Model environment variables.
- [ ] AI quotas.
- [ ] AI audit.
- [ ] AI timeout.
- [ ] AI fallback.
- [ ] Prompt versioning.
- [ ] Safety controls.
- [ ] Evaluation suite.

## Product

- [ ] Parent portal.
- [ ] Admissions.
- [ ] Documents.
- [ ] Notification center.
- [ ] Communication.
- [ ] Workflow automation.
- [ ] AI admin.
- [ ] AI teacher.
- [ ] AI student.

## UX

- [ ] Mobile.
- [ ] Tablet.
- [ ] Desktop.
- [ ] Accessibility.
- [ ] Empty states.
- [ ] Error states.
- [ ] Loading states.
- [ ] Reduced motion.

---

# 121. Recommended Implementation Order for an AI Coding Agent

The coding agent should follow this sequence.

## Step 1

Read:

- existing documentation,
- database schema,
- GraphQL schema,
- REST routes,
- auth code,
- tenant resolution,
- frontend routes,
- existing AI implementation,
- existing email implementation.

Do not modify anything before understanding existing behavior.

## Step 2

Create a gap report:

```text
Existing
Partial
Missing
Broken
Needs refactor
```

## Step 3

Implement production foundation:

- env validation,
- auth hardening,
- tenant isolation,
- audit,
- error handling,
- logging,
- health,
- rate limits,
- background jobs.

## Step 4

Implement Resend.

## Step 5

Implement notification abstraction.

## Step 6

Implement parent portal.

## Step 7

Implement documents/admissions/imports.

## Step 8

Implement AI abstraction.

## Step 9

Implement AI admin/principal.

## Step 10

Implement AI teacher.

## Step 11

Implement AI student.

## Step 12

Implement workflow automation/interventions.

## Step 13

Implement operational modules.

## Step 14

Polish UI.

## Step 15

Run:

```text
lint
typecheck
unit tests
integration tests
E2E tests
tenant isolation tests
security checks
production build
```

## Step 16

Deploy to staging.

## Step 17

Run smoke tests.

## Step 18

Deploy production.

---

# 122. Final Product Acceptance Standard

mAI-school is considered production-ready when a real school can:

1. Create its own tenant.
2. Receive a branded onboarding email.
3. Securely configure the school.
4. Add/import teachers.
5. Add/import students.
6. Invite parents.
7. Run daily attendance.
8. Manage assignments and assessments.
9. Manage fees.
10. Communicate with families.
11. Store documents.
12. Generate school documents.
13. Review operational reports.
14. Use AI safely.
15. Use AI as a teacher assistant.
16. Allow students to use a controlled AI tutor.
17. Track interventions.
18. Configure automated workflows.
19. Operate on mobile/tablet/desktop.
20. Recover from normal failures without losing data.
21. Audit sensitive actions.
22. Maintain strict tenant isolation.
23. Monitor email/AI/system health.
24. Export school data.
25. Back up and restore the database.

---

# 123. Product North Star

The product should move from:

> **"A school management system with AI features"**

to:

> **"An AI-native school operating system that manages school operations, reduces administrative work, helps teachers teach, helps students learn, and keeps parents informed — while keeping the school in control."**

The key design rule is:

**AI should make the existing school workflows substantially better, not create another disconnected chatbot.**

---

## References / Current Product Context

- Existing deployed product: `https://maischool.ayushdixit.work/`
- Repository: `https://github.com/dixitayush/mAI-school`
- Existing documentation: `https://github.com/dixitayush/mAI-school/tree/master/documentation`
- Resend Node.js integration: `https://resend.com/nodejs`
- Resend webhooks: `https://resend.com/features/webhooks`
- OpenAI model documentation: `https://developers.openai.com/api/docs/models`
- OpenAI pricing: `https://developers.openai.com/api/docs/pricing`

---

# Appendix A — Implementation Rules for Claude/Coding Agents

When implementing this PRD:

1. Do not delete working features.
2. Do not duplicate existing entities.
3. Inspect the existing schema before adding tables.
4. Prefer extending existing services.
5. Every new table must have tenant ownership where applicable.
6. Every new API must enforce authentication and authorization.
7. Every new UI page must support mobile/tablet/desktop.
8. Every mutation must validate input server-side.
9. Every sensitive mutation must be audited.
10. Never expose secrets to the browser.
11. Never send the OpenAI API key to the browser.
12. Never send the Resend API key to the browser.
13. Never allow an AI tool to bypass backend authorization.
14. Never allow an AI-generated mutation without server-side permission validation.
15. Never make core school operations depend on AI availability.
16. Never make email sending synchronous with critical CRUD.
17. Use background jobs for expensive work.
18. Add tests with every production feature.
19. Add loading, empty, error, and success states.
20. Use feature flags for risky new modules.
21. Keep model names configurable through environment variables.
22. Keep AI prompts versioned.
23. Keep AI usage observable.
24. Keep email delivery observable.
25. Treat uploaded documents and user-entered text as untrusted input.
26. Do not introduce microservices unless a demonstrated scaling/ownership requirement justifies them.
27. Optimize for reliability and simplicity before adding more infrastructure.
28. Do not mark a feature complete until the full end-to-end workflow works.

---

# Appendix B — Suggested Folder Direction

Adapt this to the existing repository rather than blindly replacing its structure.

```text
server/
  auth/
  tenants/
  permissions/
  audit/
  notifications/
  email/
  jobs/
  ai/
    providers/
    router/
    prompts/
    tools/
    safety/
    evaluations/
  admissions/
  documents/
  parents/
  interventions/
  workflows/
  library/
  transport/
  inventory/

client/
  app/
  components/
  features/
    ai/
      admin/
      principal/
      teacher/
      student/
    parents/
    admissions/
    documents/
    notifications/
    workflows/
    interventions/
  lib/
  hooks/

documentation/
  PRD/
  architecture/
  security/
  AI/
  API/
  operations/
```

---

# Appendix C — Minimum First Production Release

If development capacity is limited, ship this subset first:

### Must ship

- Production tenant isolation
- Secure auth/session management
- Audit logs
- Resend
- Background jobs
- Parent portal
- Notification center
- Documents
- Import/export
- AI provider abstraction
- AI admin/principal copilot
- AI teacher studio
- AI student tutor
- AI quotas
- AI safety controls
- Intervention system
- Mobile responsive redesign
- Monitoring
- Backup/restore
- Automated tests

### Ship later

- Transport
- Library
- Inventory
- Staff leave/substitutes
- Offline PWA
- Advanced analytics
- Billing automation
- Additional integrations

This ordering keeps the product commercially useful while preventing the platform from becoming an oversized collection of partially implemented modules.
