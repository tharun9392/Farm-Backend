#!/bin/bash

# Deployment script for Farmer Rice API server
# Usage: ./deploy.sh [production|staging]

# Check for environment parameter
if [ -z "$1" ]; then
  echo "Environment not specified. Using production as default."
  ENV="production"
else
  ENV=$1
fi

echo "Deploying Farmer Rice API server to $ENV environment..."

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Run tests before deployment
echo "Running tests..."
npm test

# Check if tests passed
if [ $? -ne 0 ]; then
  echo "Tests failed. Aborting deployment."
  exit 1
fi

# Build the app (if needed)
echo "Building application..."
npm run build

# Set environment variables
echo "Setting environment variables for $ENV..."
export NODE_ENV=$ENV

# Deploy to cloud service (Render/Railway)
echo "Deploying to cloud service..."
if [ "$ENV" == "production" ]; then
  # Replace with actual deployment command for your cloud service
  echo "Deploying to production environment..."
  # Examples:
  # railway up
  # render deploy
else
  echo "Deploying to staging environment..."
  # Examples:
  # railway up --environment staging
  # render deploy --staging
fi

echo "Deployment complete!" 