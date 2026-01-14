#!/bin/bash
set -e

# GCP Deployment Script for LinkHub SaaS
# Usage: ./deploy-scripts/gcp-deploy.sh [project-id] [region]

PROJECT_ID=${1:-your-project-id}
REGION=${2:-us-central1}
SERVICE_NAME="linkhub-saas"

echo "🚀 Deploying LinkHub SaaS to Google Cloud Platform..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK is not installed. Please install it first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install it first."
    exit 1
fi

# Set the project
echo "📋 Setting GCP project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable sql-component.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Build and submit to Cloud Build
echo "🏗️ Building application with Cloud Build..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME .

# Create secrets if they don't exist
echo "🔐 Setting up secrets..."

# Check if secrets exist, create if they don't
if ! gcloud secrets describe jwt-secret --quiet 2>/dev/null; then
    echo "Creating JWT secret..."
    echo -n "$(openssl rand -base64 32)" | gcloud secrets create jwt-secret --data-file=-
fi

if ! gcloud secrets describe stripe-secret --quiet 2>/dev/null; then
    echo "Creating Stripe secret placeholder..."
    echo -n "sk_test_placeholder" | gcloud secrets create stripe-secret --data-file=-
    echo "⚠️  Please update the Stripe secret with your actual key:"
    echo "   echo -n 'sk_live_your_actual_key' | gcloud secrets versions add stripe-secret --data-file=-"
fi

if ! gcloud secrets describe database-url --quiet 2>/dev/null; then
    echo "Creating database URL placeholder..."
    echo -n "file:./prod.db" | gcloud secrets create database-url --data-file=-
fi

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production \
  --set-secrets JWT_SECRET=jwt-secret:latest \
  --set-secrets STRIPE_SECRET_KEY=stripe-secret:latest \
  --set-secrets DATABASE_URL=database-url:latest \
  --max-instances 10 \
  --min-instances 1

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

echo ""
echo "🎉 Deployment completed successfully!"
echo "🌐 Your LinkHub SaaS is available at: $SERVICE_URL"
echo ""
echo "📋 Next steps:"
echo "1. Update secrets with actual values:"
echo "   - Stripe secret key: gcloud secrets versions add stripe-secret --data-file=-"
echo "   - Database URL (if using Cloud SQL): gcloud secrets versions add database-url --data-file=-"
echo ""
echo "2. Set up Cloud SQL database (optional):"
echo "   gcloud sql instances create linkhub-db --database-version=POSTGRES_14 --tier=db-f1-micro --region=$REGION"
echo ""
echo "3. Configure custom domain:"
echo "   gcloud run domain-mappings create --service=$SERVICE_NAME --domain=yourdomain.com --region=$REGION"
echo ""
echo "4. Set up monitoring:"
echo "   - Enable Cloud Monitoring"
echo "   - Set up alerting policies"
echo ""
echo "💡 To update the service, run this script again."

# Optional: Set up Cloud SQL
read -p "🗄️  Do you want to set up Cloud SQL database? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️  Setting up Cloud SQL..."
    
    DB_INSTANCE_NAME="linkhub-db"
    DB_NAME="linkhub"
    DB_USER="linkuser"
    DB_PASSWORD=$(openssl rand -base64 12)
    
    # Create Cloud SQL instance
    gcloud sql instances create $DB_INSTANCE_NAME \
      --database-version=POSTGRES_14 \
      --tier=db-f1-micro \
      --region=$REGION \
      --root-password=$DB_PASSWORD
    
    # Create database
    gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE_NAME
    
    # Create user
    gcloud sql users create $DB_USER \
      --instance=$DB_INSTANCE_NAME \
      --password=$DB_PASSWORD
    
    # Get connection name
    CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME --format='value(connectionName)')
    
    # Update database URL secret
    DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?host=/cloudsql/$CONNECTION_NAME"
    echo -n "$DATABASE_URL" | gcloud secrets versions add database-url --data-file=-
    
    # Update Cloud Run service to use Cloud SQL
    gcloud run services update $SERVICE_NAME \
      --add-cloudsql-instances $CONNECTION_NAME \
      --region $REGION
    
    echo "✅ Cloud SQL database set up successfully!"
    echo "📋 Database details:"
    echo "   Instance: $DB_INSTANCE_NAME"
    echo "   Database: $DB_NAME"
    echo "   User: $DB_USER"
    echo "   Password: $DB_PASSWORD"
    echo "   Connection: $CONNECTION_NAME"
fi

echo ""
echo "🔗 Useful commands:"
echo "   View logs: gcloud run services logs tail $SERVICE_NAME --region=$REGION"
echo "   Update service: gcloud run services update $SERVICE_NAME --region=$REGION"
echo "   Delete service: gcloud run services delete $SERVICE_NAME --region=$REGION"