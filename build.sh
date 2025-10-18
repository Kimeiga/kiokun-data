#!/bin/bash
set -e

echo "🔍 Current directory: $(pwd)"
echo "📁 Listing files:"
ls -la

echo "📁 Checking if sveltekit-app exists:"
if [ -d "sveltekit-app" ]; then
    echo "✅ sveltekit-app directory found"
    ls -la sveltekit-app/
else
    echo "❌ sveltekit-app directory NOT found"
    echo "Available directories:"
    ls -la
    exit 1
fi

echo "📦 Installing dependencies..."
cd sveltekit-app
npm install

echo "🔨 Building SvelteKit app..."
npm run build

echo "✅ Build complete!"

