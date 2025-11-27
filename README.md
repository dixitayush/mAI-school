# mAI-school

mAI-school is a comprehensive school management system designed to streamline administrative tasks, manage student and teacher data, and provide insightful reports.

## Features

- **User Management**: Role-based access control for Admins, Principals, Teachers, and Students.
- **Student Information System**: Manage student profiles, class assignments, and parent contacts.
- **Teacher Management**: Track teacher qualifications, subject specializations, and joining dates.
- **Attendance Tracking**: Record and monitor student attendance.
- **Fee Management**: Track fee payments, generate invoices, and monitor outstanding balances.
- **Exam & Results**: Schedule exams, record marks, and generate student report cards.
- **Reports**: Generate performance, attendance, and financial reports.

## Project Architecture

The application follows a microservices-inspired architecture, containerized with Docker:

- **Client**: A Next.js frontend application providing a responsive and interactive user interface.
- **Server**: A Node.js/Express backend API handling business logic, authentication, and database interactions. It uses PostGraphile to instantly generate a GraphQL API from the PostgreSQL schema.
- **Database**: A PostgreSQL database storing all application data.

### Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS, Apollo Client
- **Backend**: Node.js, Express, PostGraphile
- **Database**: PostgreSQL
- **Containerization**: Docker, Docker Compose

## Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Deployment

### Windows

Run the `deploy.ps1` script in PowerShell:

```powershell
.\deploy.ps1
```

### macOS / Linux

Run the `deploy.sh` script:

```bash
chmod +x deploy.sh
./deploy.sh
```

## Accessing the Application

- **Client**: [http://localhost:3000](http://localhost:3000)
- **Server**: [http://localhost:5000](http://localhost:5000)
- **Database**: Port 5432

## Data Persistence

This setup uses **Docker Volumes** to ensure data persistence. The database data is stored in a named volume `postgres_data`, which persists even if the containers are stopped or removed.

- **Volume Name**: `postgres_data`
- **Mount Point**: `/var/lib/postgresql/data` inside the Postgres container.

## Database Initialization

The database is automatically initialized with the schema defined in `server/db/schema.sql` when the `postgres` container is created for the first time.
