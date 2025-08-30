#!/bin/bash

echo "Deploying database schema to production..."
echo ""
echo "This script will push the Prisma schema to your production database."
echo "Make sure you have set the DATABASE_URL environment variable."
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    echo "Please set it in your .env file or export it"
    exit 1
fi

echo "Using database: ${DATABASE_URL%@*}@..."
echo ""

# Generate Prisma client
echo "1. Generating Prisma client..."
npx prisma generate

# Push schema to database
echo ""
echo "2. Pushing schema to database..."
npx prisma db push --skip-generate

echo ""
echo "Database deployment complete!"
echo ""
echo "You can verify the tables were created by running:"
echo "  npx prisma studio"
echo ""
echo "Next steps:"
echo "1. Push the code to GitHub: git push origin main --force"
echo "2. Vercel will auto-deploy with the new database schema"