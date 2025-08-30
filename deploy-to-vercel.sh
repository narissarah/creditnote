#!/bin/bash

echo "🚀 Deploying CreditNote to Vercel..."
echo ""
echo "This script will help you deploy your Shopify Credit Note app to Vercel."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Setting up Vercel project${NC}"
echo "If this is your first deployment, Vercel will ask you to:"
echo "1. Set up and deploy: Yes"
echo "2. Which scope: Select your account"
echo "3. Link to existing project? No (create new)"
echo "4. Project name: creditnote (or press enter for default)"
echo "5. In which directory is your code? ./ (current directory)"
echo ""

echo -e "${YELLOW}Step 2: Environment Variables${NC}"
echo "You'll need to set these environment variables in Vercel dashboard:"
echo ""
echo "DATABASE_URL=$(grep DATABASE_URL .env | cut -d '=' -f2)"
echo "DIRECT_DATABASE_URL=$(grep DIRECT_DATABASE_URL .env | cut -d '=' -f2)"
echo "SHOPIFY_API_KEY=$(grep SHOPIFY_API_KEY .env | cut -d '=' -f2)"
echo "SHOPIFY_API_SECRET=$(grep SHOPIFY_API_SECRET .env | cut -d '=' -f2)"
echo "SESSION_SECRET=$(grep SESSION_SECRET .env | cut -d '=' -f2)"
echo "SHOPIFY_APP_URL=<your-vercel-url>"
echo "QR_SECRET_KEY=$(grep QR_SECRET_KEY .env | cut -d '=' -f2)"
echo "SCOPES=$(grep SCOPES .env | cut -d '=' -f2)"
echo ""

echo -e "${YELLOW}Starting deployment...${NC}"
echo ""

# Deploy to Vercel
vercel --prod

echo ""
echo -e "${GREEN}✅ Deployment initiated!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Go to https://vercel.com/dashboard to see your deployment"
echo "2. Click on your project and go to Settings > Environment Variables"
echo "3. Add all the environment variables listed above"
echo "4. Redeploy from Vercel dashboard after adding env variables"
echo "5. Update SHOPIFY_APP_URL in .env and Shopify app settings with your Vercel URL"
echo ""
echo -e "${GREEN}Your app will be available at: https://creditnote.vercel.app (or your custom domain)${NC}"