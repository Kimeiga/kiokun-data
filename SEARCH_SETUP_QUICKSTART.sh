#!/bin/bash
# Quick setup script for the dictionary search feature
# Run this after pulling the search feature code

set -e  # Exit on error

echo "🔍 Dictionary Search Feature Setup"
echo "=================================="
echo ""

# Step 1: Run migrations
echo "📊 Step 1: Running D1 migrations..."
cd sveltekit-app

echo "  → Running migration locally..."
wrangler d1 execute kiokun-notes-db --local --file=migrations/0002_search_index.sql

echo "  → Running migration in production..."
wrangler d1 execute kiokun-notes-db --remote --file=migrations/0002_search_index.sql

echo "  ✅ Migrations complete!"
echo ""

# Step 2: Build search index
echo "📚 Step 2: Building search index from dictionaries..."
cd ..

echo "  → This will take a few minutes..."
cargo run --release --bin build_dictionary -- --build-search-index

echo "  ✅ Search index CSV created!"
echo ""

# Step 3: Import into D1
echo "💾 Step 3: Importing search index into D1..."
cd sveltekit-app

echo "  → Importing to local database..."
wrangler d1 execute kiokun-notes-db --local --command=".mode csv" --command=".import ../output_search_index.csv dictionary_search"

echo "  → Importing to production database..."
echo "  ⚠️  This may take several minutes..."
wrangler d1 execute kiokun-notes-db --remote --command=".mode csv" --command=".import ../output_search_index.csv dictionary_search"

echo "  ✅ Import complete!"
echo ""

# Step 4: Verify
echo "✅ Step 4: Verifying installation..."

echo "  → Checking local database..."
LOCAL_COUNT=$(wrangler d1 execute kiokun-notes-db --local --command="SELECT COUNT(*) as count FROM dictionary_search" --json | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
echo "  Local entries: $LOCAL_COUNT"

echo "  → Checking production database..."
REMOTE_COUNT=$(wrangler d1 execute kiokun-notes-db --remote --command="SELECT COUNT(*) as count FROM dictionary_search" --json | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
echo "  Production entries: $REMOTE_COUNT"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Start dev server: cd sveltekit-app && npm run dev"
echo "  2. Try searching for English words like 'hello', 'map', 'good'"
echo "  3. Search box will redirect to /search?q=query if word not found"
echo ""
echo "📖 Documentation:"
echo "  - Full docs: sveltekit-app/SEARCH_FEATURE.md"
echo "  - Summary: SEARCH_IMPLEMENTATION_SUMMARY.md"

