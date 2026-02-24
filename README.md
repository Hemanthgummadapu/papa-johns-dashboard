# Papa Johns Restaurant Reporting Dashboard

A full-stack dashboard for managing and analyzing Papa Johns restaurant daily operating reports.

## Features

- 📊 Multi-store dashboard with KPI cards and comparison charts
- 📤 PDF upload and parsing (Papa Johns Daily Operating Reports)
- 📈 Trend analysis and period comparisons
- 🎯 Target-based color coding for metrics
- 🔄 Real-time data updates

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: Supabase (Postgres) - optional, works with in-memory storage
- **PDF Parsing**: pdf-parse
- **Charts**: Recharts

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials (optional - see below).

### 3. Run Setup Script (Optional)

For Supabase setup:

```bash
npm run setup
```

Or manually:
- Create a Supabase project at https://supabase.com
- Get your project URL and API keys
- Add them to `.env.local`
- Run migrations from `supabase/migrations/`

### 4. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Working Without Supabase

The dashboard works **without Supabase** for testing PDF parsing:

1. **Skip Supabase setup** - Just start the dev server
2. **Upload PDFs** - The parse-pdf API will use in-memory storage
3. **View results** - Parsed data appears in the dashboard immediately
4. **Note**: Data is lost on page refresh (in-memory only)

To enable persistence:
- Set up Supabase (see above)
- Add credentials to `.env.local`
- Run database migrations

## Database Setup

### Option 1: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### Option 2: Manual SQL

Run the SQL files from `supabase/migrations/` in your Supabase SQL editor:

1. `001_initial_schema.sql` - Creates stores and daily_reports tables
2. `002_add_date_range_fields.sql` - Adds date range and delivery sales fields

### Option 3: Seed Sample Data

```bash
npm run seed
```

This populates the database with 6 sample stores and 35 days of fake data.

## PDF Parsing

The system extracts the following metrics from Papa Johns PDFs:

- Store number
- Date range (start and end dates)
- Net Sales
- Labor Cost %
- Food Cost %
- FLM %
- Cash Short
- DoorDash Sales
- Uber Eats Sales

### Supported PDF Format

The parser expects Papa Johns Daily Operating Report PDFs with:
- Store number in header: "RESTAURANT 2081"
- Date range: "01/08/2026 - 02/08/2026"
- Metrics on pages 1 and 9

## Project Structure

```
/app
  /dashboard          # Main dashboard page
  /api
    /parse-pdf        # PDF parsing endpoint
    /daily-reports    # Reports API
    /stores           # Stores API
/components
  ComparisonPanel.tsx      # Multi-store comparison
  SingleStoreDateCompare.tsx  # Single-store date comparison
/lib
  db.ts              # Supabase client
  pdf-parser.ts      # PDF extraction logic
  memory-store.ts    # In-memory storage (fallback)
  comparison.ts      # Comparison utilities
/scripts
  seed.ts            # Database seeding
  setup-supabase.sh  # Setup script
/supabase
  /migrations        # Database migrations
```

## Environment Variables

See `.env.local.example` for required variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Lint code
npm run lint

# Seed database
npm run seed
```

## License

MIT
