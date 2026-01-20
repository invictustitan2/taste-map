#!/bin/bash
# Quick deployment script for Cloudflare Pages
# Usage: ./deploy-frontend.sh

set -e  # Exit on error

echo "========================================"
echo "TasteMap Frontend Deployment"
echo "========================================"
echo

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Check if logged in
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare. Running login..."
    wrangler login
fi

echo "✓ Authentication verified"
echo

# Confirm deployment
echo "About to deploy to Cloudflare Pages:"
echo "  Project: tastemap-frontend"
echo "  Directory: ."
echo
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 1
fi

# Deploy
echo
echo "Deploying frontend..."
wrangler pages deploy . --project-name=tastemap-frontend --branch=main

echo
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo
echo "Your site should be live at:"
echo "  https://tastemap-frontend.pages.dev"
echo
echo "Next steps:"
echo "  1. Visit the URL above to test"
echo "  2. Check API connectivity"
echo "  3. Set up custom domain (optional)"
echo
