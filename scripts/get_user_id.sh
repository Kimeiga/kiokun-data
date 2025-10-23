#!/bin/bash
# Get your user ID from the D1 database
# Usage: ./scripts/get_user_id.sh [--remote]

if [[ "$1" == "--remote" ]]; then
    echo "🔍 Fetching users from REMOTE database..."
    cd sveltekit-app && npx wrangler d1 execute kiokun-notes-db --remote --command="SELECT id, name, email FROM user;"
else
    echo "🔍 Fetching users from LOCAL database..."
    cd sveltekit-app && npx wrangler d1 execute kiokun-notes-db --local --command="SELECT id, name, email FROM user;"
fi

