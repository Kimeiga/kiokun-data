#!/bin/bash
set -e

echo "🔧 Setting up Cloudflare R2 for kiokun-dict..."
echo ""

# Get account ID from wrangler
ACCOUNT_ID=$(wrangler whoami 2>/dev/null | grep "Account ID" | awk '{print $NF}')
echo "✅ Account ID: $ACCOUNT_ID"

# Get OAuth token from wrangler config
# Wrangler stores OAuth tokens in different locations depending on version
TOKEN=""
if [ -f ~/.wrangler/config/default.toml ]; then
  TOKEN=$(grep 'oauth_token' ~/.wrangler/config/default.toml | cut -d'"' -f2)
elif [ -f ~/.config/.wrangler/config/default.toml ]; then
  TOKEN=$(grep 'oauth_token' ~/.config/.wrangler/config/default.toml | cut -d'"' -f2)
fi

if [ -z "$TOKEN" ]; then
  echo "❌ Could not find OAuth token. Please run 'wrangler login' first."
  exit 1
fi

echo "✅ Found OAuth token"
echo ""

# Get zone ID for kiokun.dev
echo "🔍 Looking up zone ID for kiokun.dev..."
ZONE_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=kiokun.dev" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

ZONE_ID=$(echo "$ZONE_RESPONSE" | jq -r '.result[0].id')

if [ "$ZONE_ID" = "null" ] || [ -z "$ZONE_ID" ]; then
  echo "❌ Could not find zone ID for kiokun.dev"
  echo "Response: $ZONE_RESPONSE"
  exit 1
fi

echo "✅ Zone ID: $ZONE_ID"
echo ""

# Connect custom domain to R2 bucket
echo "🌐 Connecting dict.kiokun.dev to R2 bucket..."
wrangler r2 bucket domain add kiokun-dict --domain dict.kiokun.dev --zone-id "$ZONE_ID"
echo ""

# Create R2 API token
echo "🔑 Creating R2 API token..."
echo ""
echo "Please create an R2 API token manually:"
echo "1. Go to: https://dash.cloudflare.com/$ACCOUNT_ID/r2/api-tokens"
echo "2. Click 'Create API token'"
echo "3. Configure:"
echo "   - Token name: kiokun-dict-upload"
echo "   - Permissions: Object Read & Write"
echo "   - Bucket: kiokun-dict"
echo "4. Copy the Access Key ID and Secret Access Key"
echo ""
echo "Then add these secrets to GitHub:"
echo "https://github.com/Kimeiga/kiokun-data/settings/secrets/actions"
echo ""
echo "Required secrets:"
echo "  - R2_ACCESS_KEY_ID"
echo "  - R2_SECRET_ACCESS_KEY"
echo "  - CLOUDFLARE_ACCOUNT_ID = $ACCOUNT_ID"
echo ""
echo "✅ Setup complete!"

