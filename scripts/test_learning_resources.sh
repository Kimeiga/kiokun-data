#!/bin/bash
# Test script for Learning Resources setup
# Run this to verify everything is configured correctly

echo "🧪 Testing Learning Resources Setup"
echo "===================================="
echo ""

# Check if we're in the scripts directory
if [ ! -f "learning_resources_automation.py" ]; then
    echo "❌ Error: Run this script from the scripts/ directory"
    exit 1
fi

# Check Python dependencies
echo "1️⃣ Checking Python dependencies..."
python3 -c "import googleapiclient, youtube_transcript_api, google.generativeai, requests" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ All Python packages installed"
else
    echo "   ❌ Missing packages. Run: pip install -r requirements-learning-resources.txt"
    exit 1
fi

# Check environment variables
echo ""
echo "2️⃣ Checking environment variables..."
missing_vars=()

[ -z "$YOUTUBE_API_KEY" ] && missing_vars+=("YOUTUBE_API_KEY")
[ -z "$GEMINI_API_KEY" ] && missing_vars+=("GEMINI_API_KEY")
[ -z "$CLOUDFLARE_ACCOUNT_ID" ] && missing_vars+=("CLOUDFLARE_ACCOUNT_ID")
[ -z "$CLOUDFLARE_D1_DATABASE_ID" ] && missing_vars+=("CLOUDFLARE_D1_DATABASE_ID")
[ -z "$CLOUDFLARE_API_TOKEN" ] && missing_vars+=("CLOUDFLARE_API_TOKEN")

if [ ${#missing_vars[@]} -eq 0 ]; then
    echo "   ✅ All environment variables set"
else
    echo "   ❌ Missing environment variables: ${missing_vars[*]}"
    echo "   Create a .env file or export these variables"
    exit 1
fi

# Check database tables
echo ""
echo "3️⃣ Checking database tables..."
cd ../sveltekit-app
tables=$(wrangler d1 execute kiokun-dictionary --local --command="SELECT name FROM sqlite_master WHERE type='table' AND (name='language_categories' OR name='resource_sources' OR name='video_posts' OR name='extracted_words')" 2>/dev/null | grep -c "name")

if [ "$tables" -ge 4 ]; then
    echo "   ✅ All required tables exist"
else
    echo "   ❌ Missing tables. Run migration:"
    echo "   wrangler d1 execute kiokun-dictionary --local --file=migrations/0002_aberrant_spirit.sql"
    exit 1
fi

cd ../scripts

# Test API connectivity (optional - requires valid keys)
echo ""
echo "4️⃣ Testing API connectivity (optional)..."
echo "   Skipping API tests (would consume quota)"
echo "   Run the automation script manually to test APIs"

echo ""
echo "===================================="
echo "✅ All checks passed!"
echo ""
echo "Next steps:"
echo "1. Run: python3 learning_resources_automation.py"
echo "2. Check: http://localhost:5173/learning-resources"
echo "3. Deploy: See LEARNING_RESOURCES_DEPLOYMENT.md"

