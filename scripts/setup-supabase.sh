#!/bin/bash

# Supabase Project Setup Script
# This script helps you set up a new Supabase project for the Papa Johns Dashboard

set -e

echo "🍕 Papa Johns Dashboard - Supabase Setup"
echo "=========================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo ""
    echo "Install it with:"
    echo "  npm install -g supabase"
    echo ""
    echo "Or visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

echo "✓ Supabase CLI found"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from .env.local.example..."
    cp .env.local.example .env.local
    echo "✓ Created .env.local"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env.local and add your Supabase credentials"
    echo ""
else
    echo "✓ .env.local already exists"
    echo ""
fi

# Check if user wants to link to existing project or create new
echo "Choose an option:"
echo "1) Link to existing Supabase project"
echo "2) Create new Supabase project (requires Supabase account)"
echo "3) Skip Supabase setup for now (use in-memory storage)"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo "Linking to existing project..."
        echo "You'll need:"
        echo "  - Project URL (e.g., https://xxxxx.supabase.co)"
        echo "  - Anon key"
        echo "  - Service role key"
        echo ""
        echo "Get these from: https://supabase.com/dashboard/project/_/settings/api"
        echo ""
        read -p "Press Enter to continue..."
        supabase link --project-ref your-project-ref
        echo ""
        echo "✓ Project linked"
        echo ""
        echo "Next steps:"
        echo "1. Run migrations: supabase db push"
        echo "2. Or manually run SQL from supabase/migrations/"
        ;;
    2)
        echo ""
        echo "Creating new Supabase project..."
        echo "This will open your browser to create a project."
        echo ""
        read -p "Press Enter to continue..."
        supabase init
        supabase start
        echo ""
        echo "✓ Local Supabase instance started"
        echo ""
        echo "To deploy to cloud:"
        echo "  supabase link --project-ref your-project-ref"
        echo "  supabase db push"
        ;;
    3)
        echo ""
        echo "✓ Skipping Supabase setup"
        echo ""
        echo "The dashboard will work with in-memory storage."
        echo "Uploaded PDFs will be parsed and displayed, but data won't persist after refresh."
        echo ""
        echo "To enable Supabase later:"
        echo "1. Set up a Supabase project"
        echo "2. Add credentials to .env.local"
        echo "3. Run migrations from supabase/migrations/"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. If you chose option 1 or 2, run the database migrations:"
echo "   supabase db push"
echo ""
echo "   Or manually run SQL from: supabase/migrations/"
echo ""
echo "2. Seed the database (optional):"
echo "   npm run seed"
echo ""
echo "3. Start the development server:"
echo "   npm run dev"
echo ""
echo "4. Visit http://localhost:3000"
echo ""

