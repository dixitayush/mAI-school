# Entity–Relationship diagram — mAI-school

> Source of truth: `server/db/schema.sql`. Cardinalities are approximate (one user can be one teacher row OR one student row depending on role).

## 1. ER diagram (Mermaid)

```mermaid
erDiagram
  institutions ||--o{ users : "has"
  institutions ||--o{ classes : "has"
  institutions ||--o{ reports : "has"
  institutions ||--o{ meetings : "has"
  institutions ||--o{ announcements : "has"

  users ||--o| profiles : "has"
  users ||--o| students : "optional if student"
  users ||--o| teachers : "optional if teacher"
  users ||--o{ attendance : "recorded_by"
  users ||--o{ reports : "generated_by"
  users ||--o{ meetings : "host or guest"
  users ||--o{ announcements : "created_by"

  classes ||--o{ students : "enrolled"
  classes ||--o{ exams : "scheduled"
  classes }o--|| users : "teacher_id"

  students ||--o{ attendance : ""
  students ||--o{ fees : ""
  students ||--o{ results : ""

  exams ||--o{ results : ""

  institutions {
    uuid id PK
    text name
    text slug UK
    text logo_url
    boolean is_active
    int estimated_students
    timestamptz created_at
  }

  users {
    uuid id PK
    text username
    text password_hash
    user_role role
    text full_name
    uuid institution_id FK
    boolean login_enabled
    timestamptz created_at
  }

  profiles {
    uuid user_id PK
    text bio
    text photo_url
    text email
    text phone
    text address
  }

  classes {
    uuid id PK
    uuid institution_id FK
    text name
    int grade_level
    uuid teacher_id FK
  }

  students {
    uuid id PK
    uuid user_id FK
    uuid class_id FK
    text parent_name
    text parent_email
    text parent_phone
    text parent_address
    date dob
    date enrollment_date
  }

  teachers {
    uuid id PK
    uuid user_id FK
    text subject_specialization
    text qualification
    date joining_date
  }

  attendance {
    uuid id PK
    uuid student_id FK
    date date
    text status
    text remarks
    uuid recorded_by FK
    timestamptz created_at
  }

  fees {
    uuid id PK
    uuid student_id FK
    decimal amount
    text description
    date due_date
    text status
    date payment_date
    text invoice_number
  }

  exams {
    uuid id PK
    uuid class_id FK
    text subject
    text title
    date exam_date
    int total_marks
    text description
  }

  results {
    uuid id PK
    uuid exam_id FK
    uuid student_id FK
    int marks_obtained
    text grade
    text feedback
  }

  reports {
    uuid id PK
    uuid institution_id FK
    text title
    jsonb content
    timestamptz generated_at
    text type
    uuid generated_by FK
  }

  meetings {
    uuid id PK
    uuid institution_id FK
    uuid host_id FK
    uuid guest_id FK
    timestamptz start_time
    timestamptz end_time
    text status
    text notes
    timestamptz created_at
  }

  announcements {
    uuid id PK
    uuid institution_id FK
    text title
    text content
    text priority
    text target_audience
    uuid created_by FK
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }
```

## 2. Constraints (selected)

| Entity | Rule |
|--------|------|
| `users` | `mai_admin` ⇒ `institution_id IS NULL`; other roles ⇒ `institution_id NOT NULL` |
| `users` | Unique `(institution_id, username)`; global unique username for `mai_admin` |
| `institutions.slug` | Regex `^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$` |
| `attendance` | Unique `(student_id, date)` |
| `fees.status` | `paid` / `pending` / `overdue` |
| `results` | FK to `exams`; cascade delete from exam |

## 3. Enum

**`user_role`:** `mai_admin`, `admin`, `principal`, `teacher`, `student`.

## 4. Derived / helper functions (not entities)

`register_user`, `register_student`, `register_teacher`, `upsert_profile`, `update_user_name`, announcement CRUD functions, `modify_class`, `remove_student`, etc. — see schema file.
