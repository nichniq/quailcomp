# How to Set Up Your Development Environment

This guide walks you through setting up Quailcomp for local development.

## Prerequisites

- [Bun](https://bun.sh) 1.3.6 or higher
- PostgreSQL 16
- Git

### Installing Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

Verify installation:

```bash
bun --version  # Should be 1.3.6+
```

### Installing PostgreSQL

**macOS (Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux (apt):**

```bash
sudo apt install postgresql-16
sudo systemctl start postgresql
```

Verify PostgreSQL is running:

```bash
pg_isready
```

## Clone and Install

```bash
git clone https://github.com/yourusername/quailcomp.git
cd quailcomp
bun install
```

## Database Setup

### 1. Create the Database and Roles

Run the setup scripts to create the database, roles, and schema:

```bash
cd data/postgres/setup
cp .env.example .env
# Edit .env with your PostgreSQL admin credentials
./run.sh
```

This creates:

- `quailcomp` database
- `quailcomp_owner` role (for migrations)
- `quailcomp_app` role (for application connections)

See [Database Roles](../explanation/database-roles.md) for why this separation exists.

### 2. Run Migrations

```bash
bun run db:migrate
```

This applies all pending migrations from `data/postgres/migrations/`.

See [How to Run Migrations](run-migrations.md) for details.

## Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit with your configuration:

```bash
# Database (required)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=quailcomp
DB_USER=quailcomp_app
DB_PASSWORD=your_password

# Authentication (required for server)
JWT_SECRET=your_jwt_secret_key

# Server (optional)
PORT=3000
HOSTNAME=0.0.0.0
LOG_LEVEL=info

# Book Metadata Providers (optional)
GOOGLE_BOOKS_API_KEY=your_google_books_key
HARDCOVER_API_KEY=your_hardcover_key
```

See [Environment Variables Reference](../reference/environment-variables.md) for the complete list.

## Install Git Hooks

```bash
bash scripts/install-hooks.sh
```

This installs pre-commit hooks that:

- Run ESLint on staged files
- Auto-extract types from domain documentation

See [How to Manage Git Hooks](manage-git-hooks.md) for details.

## Verify Setup

Run the test suite to verify everything is configured correctly:

```bash
bun test
```

Tests automatically create and manage a separate `quailcomp_test` database.

See [How to Run Tests](run-tests.md) for more options.

## Running the Application

### Backend Server

```bash
cd server
bun run dev
```

The server starts at `http://localhost:3000`.

### Frontend (Vue 3)

```bash
cd frontend
bun run dev
```

The frontend starts at `http://localhost:5173`.

### CLI

```bash
bun run cli help
bun run cli books list
```

See [CLI Reference](../reference/cli.md) for available commands.

## Project Structure

```
quailcomp/
├── data/
│   ├── client/           # @quailcomp/data - TypeScript client library
│   └── postgres/         # SQL: setup/, teardown/, migrations/
├── server/               # Backend HTTP server
├── frontend/             # Vue 3 + Pinia frontend
├── cli/                  # Command-line interface
├── services/             # External integrations (book-metadata)
├── domains/              # Domain documentation with embedded types
├── docs/                 # Documentation (you are here)
└── CONTRIBUTING.md       # Development guidelines hub
```

## Next Steps

- [How to Run Tests](run-tests.md) - Verify your changes
- [How to Commit Changes](commit-changes.md) - Follow the commit protocol
- [Why Event Sourcing?](../explanation/event-sourcing.md) - Understand the architecture
