#!/bin/bash
set -e

echo "📦 Installing dependencies..."
cd sveltekit-app
npm install

echo "🔨 Building SvelteKit app..."
npm run build

echo "✅ Build complete!"

