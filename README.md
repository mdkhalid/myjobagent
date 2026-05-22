# Job Agent - AI-Powered Job Search & Application Automation

A full-stack application that intelligently matches your resume to job openings, automates job applications, and tracks your job search progress.

## Features

- **Resume Management**: Upload and parse resumes (PDF, DOCX)
- **AI-Powered Job Matching**: Match jobs to your resume based on skills and experience
- **Job Search**: Search and filter job listings from multiple sources
- **Auto-Apply**: Automatically apply to matching jobs with your approval
- **Application Tracking**: Track application status, interviews, and outcomes
- **Dashboard**: Visualize your job search progress with statistics

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Task Queue**: Celery with Redis
- **Authentication**: JWT tokens

### Frontend
- **Framework**: Angular 17+
- **UI Library**: Angular Material
- **HTTP Client**: Angular HttpClient

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx

## Quick Start

### Prerequisites
- Docker Desktop installed and running
- Git (optional, for cloning)

### Running the Application

1. **Clone or navigate to the project directory**:
```bash
cd myjobagent
```

2. **Start all services**:
```bash
docker-compose up --build
```

This will start:
- Backend API at http://localhost:8000
- Frontend at http://localhost:4200
- PostgreSQL database at localhost:5432
- Redis at localhost:6379

3. **Access the application**:
- Open http://localhost:4200 in your browser
- Register a new account
- Upload your resume
- Start searching and applying for jobs!

### API Documentation

Once the backend is running, access the interactive API docs at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development

### Backend Development

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the development server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
ng serve
```

The frontend will be available at http://localhost:4200

## Project Structure

```
myjobagent/
├── backend/               # FastAPI application
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── core/         # Security, config
│   │   ├── db/           # Database session
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic
│   │   └── tasks/        # Celery tasks
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/             # Angular application
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/     # Services, guards, interceptors
│   │   │   └── features/ # Page components
│   │   └── assets/
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml    # Docker orchestration
└── uploads/              # Resume storage
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user

### Resumes
- `GET /api/v1/resumes` - List resumes
- `POST /api/v1/resumes/upload` - Upload resume
- `GET /api/v1/resumes/{id}/parsed` - Get parsed resume data
- `POST /api/v1/resumes/{id}/set-active` - Set active resume

### Jobs
- `GET /api/v1/jobs` - List jobs
- `GET /api/v1/jobs/search` - Search jobs
- `POST /api/v1/jobs/match` - Match jobs to resume

### Applications
- `GET /api/v1/applications` - List applications
- `POST /api/v1/applications` - Create application
- `PUT /api/v1/applications/{id}/status` - Update status

### Automation
- `GET /api/v1/automation/status` - Get automation status
- `POST /api/v1/automation/start` - Start auto-apply
- `POST /api/v1/automation/stop` - Stop auto-apply
- `GET /api/v1/automation/queue` - Get approval queue

## Configuration

Environment variables (set in docker-compose.yml or .env file):

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/jobagent

# Redis
REDIS_URL=redis://redis:6379/0

# Security
SECRET_KEY=your-secret-key-change-in-production

# OpenAI (for resume parsing)
OPENAI_API_KEY=your-openai-api-key
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License
