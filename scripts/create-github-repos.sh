#!/bin/bash
# Create all 23 GitHub repositories for the dictionary shards

set -e

# List of all 23 shard repositories
REPOS=(
    "kiokun-dict-non-han-non-kana"
    "kiokun-dict-kana-only-1"
    "kiokun-dict-kana-only-2"
    "kiokun-dict-han1-len1-1"
    "kiokun-dict-han1-len1-2"
    "kiokun-dict-han1-len1-3"
    "kiokun-dict-han1-len1-4"
    "kiokun-dict-han1-len2"
    "kiokun-dict-han1-len3"
    "kiokun-dict-han1-len4plus"
    "kiokun-dict-han2-len2-4e5f-1"
    "kiokun-dict-han2-len2-4e5f-2"
    "kiokun-dict-han2-len2-607f-1"
    "kiokun-dict-han2-len2-607f-2"
    "kiokun-dict-han2-len2-809f-1"
    "kiokun-dict-han2-len2-809f-2"
    "kiokun-dict-han2-len3"
    "kiokun-dict-han2-len4"
    "kiokun-dict-han2-len5plus"
    "kiokun-dict-han3-len3-1"
    "kiokun-dict-han3-len3-2"
    "kiokun-dict-han3-len4"
    "kiokun-dict-han3-len5"
    "kiokun-dict-han3-len6plus"
    "kiokun-dict-han4plus-1"
    "kiokun-dict-han4plus-2"
    "kiokun-dict-han4plus-3"
)

echo "Creating 23 GitHub repositories for dictionary shards..."
echo ""

for repo in "${REPOS[@]}"; do
    echo "Creating repository: $repo"
    
    # Check if repo already exists
    if gh repo view "Kimeiga/$repo" &>/dev/null; then
        echo "  ✓ Repository already exists, skipping"
    else
        # Create public repository
        gh repo create "Kimeiga/$repo" \
            --public \
            --description "Dictionary shard for kiokun - Chinese/Japanese dictionary data" \
            --homepage "https://kiokun.pages.dev"
        
        echo "  ✓ Created successfully"
    fi
    
    echo ""
done

echo "✅ All repositories created!"
echo ""
echo "Next steps:"
echo "1. Run the build with --shard-output flag to generate all 23 shards"
echo "2. Run the GitHub Actions workflow to deploy to all repositories"

