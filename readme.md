# LexAssist

LexAssist is a comprehensive, AI-powered legal application built to streamline legal workflows and provide an intuitive interface backed by robust capabilities, acting as a smart assistant for legal professionals.

## Description

LexAssist provides a complete platform for managing legal cases, providing a rich user experience with a responsive user interface and a powerful backend. Built on a modern stack, the system comprises a React-based Next.js frontend and a versatile Django backend. This foundation sets the stage for advanced AI integrations, complex business logic, and high-performance legal operations.

## Tech Stack

### Frontend
- **Framework:** Next.js (React 19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS & Radix UI (shadcn/ui)
- **State Management:** Zustand & React Query (@tanstack/react-query)
- **Data Visualization:** Recharts
- **Form Handling:** React Hook Form & Zod

### Backend
- **Framework:** Django (REST API)
- **Database:** SQLite3

## Upcoming Features

We are actively evolving LexAssist into a cutting-edge legal tech platform. The following features are currently on our immediate roadmap:

- **AI-Powered Application:** Deep integration of artificial intelligence across all modules to assist with legal research, automated drafting, intelligent analysis, and data extraction.
- **The Documents:** Advanced document management, including robust parsing, intelligent search over legal documents, automatic categorization, and summarization.
- **Case Optimization:** AI-driven insights to optimize case strategies, predict potential outcomes, and manage case timelines and resources effectively.

## Getting Started

### Prerequisites
- Node.js (v20+)
- Python (v3.10+)

### Setup

#### Backend API
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Set up the virtual environment:
   ```bash
   python -m venv .venv
   ```
3. Activate the environment:
   ```bash
   # On Windows
   .venv\Scripts\activate
   ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Apply database migrations:
   ```bash
   python manage.py migrate
   ```
6. Start the server:
   ```bash
   python manage.py runserver
   ```

#### Frontend Client
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at [http://localhost:3000](http://localhost:3000).
