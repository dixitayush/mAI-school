# mAI-school

mAI-school is a comprehensive school management system designed to streamline administrative tasks, manage student and teacher data, and provide insightful reports. Built with modern technologies and featuring AI-powered capabilities, this system offers a complete solution for educational institutions.

## 🚀 Key Features

### User Management & Authentication
- **Role-Based Access Control**: Admins, Principals, Teachers, and Students with specific permissions
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **User Profiles**: Comprehensive profile management with photos, contact information, and bio
- **Multi-Role Support**: Each user can have specialized features based on their role

### Student Information System
- **Complete Student Records**: Personal information, class assignments, and enrollment tracking
- **Parent Information**: Detailed parent/guardian contact details and communication
- **Student Profiles**: Academic history, attendance records, and performance tracking
- **Class Management**: Organized class structure with grade levels and assigned teachers

### Teacher Management
- **Teacher Profiles**: Qualifications, subject specializations, and employment history
- **Class Assignment**: Teachers can be assigned as class teachers or subject teachers
- **Performance Tracking**: Monitor teacher effectiveness and student outcomes
- **Professional Development**: Track qualifications and training

### Attendance Management
- **Daily Attendance Tracking**: Record present, absent, or late status with remarks
- **AI-Powered Attendance**: Face recognition capabilities for automated attendance
- **Attendance Reports**: Generate comprehensive attendance analytics
- **Parent Notifications**: Automated email notifications for attendance issues
- **Bulk Operations**: Mark attendance for entire classes at once

### Fee Management System
- **Fee Tracking**: Comprehensive fee structure with due dates and payment status
- **Invoice Generation**: Automatic invoice creation with unique numbers
- **Payment Status**: Track paid, pending, and overdue fees
- **Financial Reports**: Generate fee collection reports and outstanding balances
- **Parent Communication**: Send fee reminders and payment confirmations

### Examination & Results
- **Exam Creation**: Schedule exams with subjects, dates, and total marks
- **Result Management**: Record marks, grades, and feedback for each student
- **Report Cards**: Generate comprehensive student performance reports
- **Grade Analytics**: Track class and individual student performance over time
- **Exam Statistics**: Analyze exam results and identify trends

### Communication System
- **Email Notifications**: Automated emails for attendance, fees, and announcements
- **Announcement Board**: Create and manage school-wide announcements
- **Targeted Messaging**: Send messages to specific groups (students, teachers, or all)
- **Meeting Scheduler**: Schedule and manage meetings between staff and parents/students

### AI-Powered Features
- **Smart Attendance**: AI-based face recognition for automated attendance marking
- **Intelligent Reports**: AI-generated insights and performance analytics
- **Predictive Analytics**: Identify students who may need additional support
- **Automated Grading**: AI assistance in grading and feedback generation

### Reporting & Analytics
- **Performance Reports**: Student and class performance analytics
- **Attendance Reports**: Comprehensive attendance statistics and trends
- **Financial Reports**: Fee collection and outstanding balance reports
- **Custom Reports**: Generate reports with specific criteria and filters
- **Data Visualization**: Charts and graphs for better data understanding

### File Management
- **Document Upload**: Support for various file types (images, documents)
- **Profile Pictures**: Upload and manage user profile photos
- **Document Storage**: Secure file storage with organized structure
- **File Sharing**: Share documents with specific users or groups

## Project Architecture

The application follows a microservices-inspired architecture, containerized with Docker:

- **Client**: A Next.js frontend application providing a responsive and interactive user interface.
- **Server**: A Node.js/Express backend API handling business logic, authentication, and database interactions. It uses PostGraphile to instantly generate a GraphQL API from the PostgreSQL schema.
- **Database**: A PostgreSQL database storing all application data.

### Tech Stack

#### Frontend
- **Next.js 16**: React framework with server-side rendering and API routes
- **React 19**: Modern React with latest features and optimizations
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **Apollo Client**: GraphQL client for state management and API communication
- **Framer Motion**: Animation library for smooth transitions and interactions
- **Recharts**: Data visualization library for charts and graphs
- **React Hook Form**: Form management with validation
- **Lucide React**: Modern icon library
- **Headless UI**: Unstyled, accessible UI components

#### Backend
- **Node.js**: JavaScript runtime for server-side development
- **Express.js**: Web application framework for REST APIs
- **PostGraphile**: Instantly generates a GraphQL API from PostgreSQL schema
- **PostgreSQL**: Robust relational database with advanced features
- **JWT**: JSON Web Tokens for secure authentication
- **bcrypt**: Password hashing for security
- **Nodemailer**: Email sending functionality
- **Multer**: File upload handling
- **Twilio**: SMS and communication services (optional)

#### Additional Services
- **AI Integration**: Face recognition for automated attendance
- **Email Service**: SMTP support with fallback to Ethereal for testing
- **File Storage**: Local file upload and management system
- **Database Functions**: Custom PostgreSQL functions for complex operations

## 🏗️ System Architecture

### Database Schema
The system uses a comprehensive PostgreSQL schema with the following key entities:

- **Users & Profiles**: Central user management with role-based access
- **Classes**: Grade levels and class assignments
- **Students & Teachers**: Role-specific user data and relationships
- **Attendance**: Daily attendance tracking with AI integration
- **Fees**: Financial management and payment tracking
- **Exams & Results**: Academic assessment and performance tracking
- **Reports**: Generated reports and analytics
- **Meetings**: Scheduled meetings and communication logs
- **Announcements**: School-wide communication system

### API Architecture
- **GraphQL API**: Auto-generated via PostGraphile for database operations
- **REST API**: Custom endpoints for specialized functionality
- **AI Services**: Dedicated routes for AI-powered features
- **Email Services**: Automated notification system
- **File Upload**: Secure file handling and storage

### Frontend Architecture
- **Role-Based Dashboards**: Different interfaces for admin, principal, teacher, and student roles
- **Component-Based Design**: Reusable React components with modern hooks
- **State Management**: Apollo Client for GraphQL data and local state
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Real-Time Updates**: Optimistic UI updates and cache management

## 🚀 Quick Start

### Prerequisites
- [Docker](https://www.docker.com/get-started) (version 20.10 or higher)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0 or higher)
- At least 4GB RAM available for Docker
- 10GB free disk space

### One-Click Deployment

#### Windows
Run the deployment script in PowerShell:

```powershell
.\deploy.ps1
```

#### macOS / Linux
Run the deployment script:

```bash
chmod +x deploy.sh
./deploy.sh
```

Both scripts will:
1. Build and start all Docker containers
2. Initialize the database with required schema
3. Create default admin user
4. Start the application services

### Manual Setup

If you prefer manual setup or need to customize the configuration:

1. **Clone the repository**
```bash
git clone <repository-url>
cd mAI-school
```

2. **Configure environment variables**
```bash
# Copy environment files
cp server/.env.example server/.env
cp client/.env.local.example client/.env.local

# Edit the files with your configuration
nano server/.env
nano client/.env.local
```

3. **Start with Docker Compose**
```bash
docker-compose up --build
```

4. **Initialize the database** (first time only)
```bash
# The database will be automatically initialized with schema.sql
# Default admin user: username=admin, password=admin123
```

## 🔧 Configuration

### Environment Variables

#### Server Configuration (`server/.env`)
```env
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mai_school

# Server
PORT=5001
JWT_SECRET=your-super-secret-jwt-key

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Twilio Configuration (Optional for SMS)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
```

#### Client Configuration (`client/.env.local`)
```env
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:5001/graphql
NEXT_PUBLIC_API_URL=http://localhost:5001
```

### Database Setup

The system uses PostgreSQL with automatic schema initialization. The database schema includes:

- **User Management**: Roles, authentication, and profiles
- **Academic Structure**: Classes, students, and teachers
- **Attendance System**: Daily tracking with AI integration
- **Financial Management**: Fees and payments
- **Assessment System**: Exams and results
- **Communication**: Announcements and meetings
- **Reporting**: Analytics and insights

### Default Credentials

After initial setup, you can access the system with:

- **Admin User**: 
  - Username: `admin`
  - Password: `admin123`
  - Role: System Administrator

- **Default Classes**: 
  - 10-A, 10-B (Grade 10)
  - 11-A, 11-B (Grade 11)
  - 12-A (Grade 12)

## 🌐 Accessing the Application

Once deployed, access the application at:

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **GraphQL Playground**: [http://localhost:5001/graphiql](http://localhost:5001/graphiql)
- **REST API Base**: [http://localhost:5001/api](http://localhost:5001/api)
- **Database**: Port 5432 (for direct access with tools like pgAdmin)

### Role-Based Access

- **Admin**: Complete system access and user management
- **Principal**: Oversight of all academic and administrative functions
- **Teacher**: Class management, attendance, exams, and student tracking
- **Student**: View personal information, attendance, and results

## 📚 API Documentation

### GraphQL API

The system uses PostGraphile to automatically generate a comprehensive GraphQL API from the PostgreSQL schema. Access the GraphQL Playground at [http://localhost:5001/graphiql](http://localhost:5001/graphiql) to explore and test queries.

#### Key GraphQL Mutations
- `registerStudent`: Register a new student with parent information
- `registerTeacher`: Register a new teacher with qualifications
- `createExam`: Create new exams for specific classes
- `createClass`: Create new classes and sections
- `createAnnouncement`: Create school-wide announcements
- `upsertProfile`: Update user profile information

#### Key GraphQL Queries
- All database tables are automatically queryable
- Relationships between data are resolved automatically
- Filtering, sorting, and pagination are supported

### REST API Endpoints

#### Authentication
- `POST /api/auth/login` - User login and JWT token generation
- `POST /api/auth/register` - User registration (if enabled)

#### AI Services
- `POST /api/ai/attendance` - AI-powered attendance processing
- `POST /api/ai/reports` - Generate intelligent reports with insights

#### Email Services
- `POST /api/email/send` - Send emails with HTML templates
- Supports SMTP configuration and Ethereal testing

#### File Management
- `POST /api/upload` - Upload files (images, documents)
- `GET /uploads/:filename` - Serve uploaded files

#### Attendance System
- `GET /api/attendance/class/:classId` - Get class attendance
- `POST /api/attendance/mark` - Mark attendance for students
- `GET /api/attendance/reports` - Generate attendance reports

### Database Functions

The system includes custom PostgreSQL functions for complex operations:

#### User Management
- `register_user()` - Register users with automatic profile creation
- `update_user_name()` - Update user full names
- `upsert_profile()` - Create or update user profiles

#### Academic Management
- `create_class()` - Create new classes
- `update_class()` - Update class information
- `delete_class()` - Remove classes (with safety checks)
- `delete_student()` - Remove student records

#### Assessment Management
- `create_exam()` - Create exams for classes
- `register_exam()` - Alternative exam creation function

#### Communication
- `create_announcement()` - Create announcements
- `update_announcement()` - Update existing announcements
- `delete_announcement()` - Remove announcements
- `toggle_announcement()` - Toggle announcement visibility

## 🛠️ Development Guide

### Local Development Setup

1. **Install Dependencies**
```bash
# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

2. **Database Setup**
```bash
# Start PostgreSQL (if not using Docker)
# Update DATABASE_URL in server/.env
cd server
npm run db:init  # Initialize database schema
```

3. **Run Development Servers**
```bash
# Terminal 1 - Server
cd server
npm run dev

# Terminal 2 - Client
cd client
npm run dev
```

### Code Structure

#### Backend (`/server`)
- `index.js` - Main server file with Express setup and PostGraphile
- `routes/` - Custom REST API routes
  - `ai.js` - AI-powered features
  - `attendance.js` - Attendance management with email notifications
  - `email.js` - Email sending functionality
  - `upload.js` - File upload handling
- `db/` - Database schema and initialization
  - `schema.sql` - Complete database schema with functions
  - `init.js` - Database initialization script
- `services/` - Business logic services
- `scripts/` - Utility scripts

#### Frontend (`/client`)
- `app/` - Next.js app router pages
  - `admin/` - Admin dashboard and management
  - `principal/` - Principal oversight features
  - `teacher/` - Teacher-specific functionality
  - `student/` - Student portal
  - `profile/` - User profile management
- `components/` - Reusable React components
- `lib/` - Utilities and configuration
  - Apollo Client setup
  - GraphQL queries/mutations
- `public/` - Static assets

### Testing

#### Backend Testing
```bash
cd server
npm test  # Run backend tests
```

#### Frontend Testing
```bash
cd client
npm test  # Run frontend tests
npm run lint  # Code quality checks
```

### Database Migrations

When updating the database schema:

1. Create migration files in `server/db/migrations/`
2. Test migrations on development environment
3. Update `schema.sql` with final schema
4. Rebuild containers for deployment

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication with secure token handling
- Role-based access control (RBAC) for all endpoints
- Password hashing with bcrypt
- Session management with token expiration

### Data Protection
- SQL injection prevention through parameterized queries
- XSS protection in React components
- CORS configuration for API security
- File upload validation and security

### Environment Security
- Environment variable configuration
- Secure database connections
- SMTP authentication for emails
- Optional Twilio integration for SMS

## 📊 Monitoring & Logging

### Application Monitoring
- Comprehensive error logging
- Database query monitoring
- API request/response logging
- Performance metrics tracking

### Database Monitoring
- Query performance analysis
- Connection pool monitoring
- Database health checks
- Automated backup recommendations

## 🚀 Production Deployment

### Docker Production Setup
```bash
# Production environment variables
export NODE_ENV=production
export JWT_SECRET=your-production-secret

# Build and deploy
docker-compose -f docker-compose.prod.yml up --build -d
```

### Environment-Specific Configurations
- Development: Hot reload, detailed logs, test database
- Staging: Production-like setup, reduced logging
- Production: Optimized builds, minimal logs, monitoring

### Backup Strategy
- Automated database backups
- File storage backup procedures
- Configuration backup recommendations
- Disaster recovery planning

## 💾 Data Persistence

This setup uses **Docker Volumes** to ensure data persistence. The database data is stored in a named volume `postgres_data`, which persists even if the containers are stopped or removed.

- **Volume Name**: `postgres_data`
- **Mount Point**: `/var/lib/postgresql/data` inside the Postgres container
- **Backup Location**: All user data, uploads, and database records are persisted
- **File Storage**: Uploaded files are stored in `server/uploads/` with volume persistence

## 🗄️ Database Initialization

The database is automatically initialized with the schema defined in `server/db/schema.sql` when the `postgres` container is created for the first time. This includes:

- **Schema Creation**: All tables, indexes, and constraints
- **Custom Functions**: Database functions for complex operations
- **Seed Data**: Default admin user and sample classes
- **Permissions**: Proper database permissions for PostGraphile

## 🤝 Contributing

We welcome contributions to the mAI-school project! Please follow these guidelines:

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Standards
- Use ESLint for JavaScript/React code
- Follow Prettier formatting rules
- Write meaningful commit messages
- Update documentation for new features

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Troubleshooting

### Common Issues

#### Database Connection Errors
- Check if PostgreSQL is running on port 5432
- Verify DATABASE_URL in server/.env
- Ensure Docker containers are running

#### Authentication Issues
- Clear browser cookies and localStorage
- Check JWT_SECRET configuration
- Verify user role permissions

#### File Upload Problems
- Check file size limits in server configuration
- Verify uploads directory permissions
- Ensure proper file type validation

### Getting Help

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs via GitHub Issues
- **Community**: Join our development discussions
- **Email**: Contact the development team for support

## 🔄 Version History

### v1.0.0 (Current)
- Complete school management system
- AI-powered attendance features
- Comprehensive reporting system
- Role-based access control
- Email notifications
- File management system

### Future Roadmap
- **Mobile App**: Native iOS and Android applications
- **Advanced AI**: Machine learning for predictive analytics
- **Video Conferencing**: Integrated online classroom features
- **Payment Gateway**: Online fee payment processing
- **Biometric Integration**: Fingerprint/facial recognition
- **Advanced Analytics**: More sophisticated reporting and insights

---

**Built with ❤️ for modern educational institutions**
