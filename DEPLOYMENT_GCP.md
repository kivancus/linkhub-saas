# GCP Deployment Guide for LinkHub SaaS

## Overview
This guide covers deploying LinkHub SaaS to Google Cloud Platform using multiple deployment options.

## Option 1: Google Cloud Run (Recommended - Easiest)

### Prerequisites
- Google Cloud SDK installed and configured
- Docker installed locally
- GCP project created

### Steps

1. **Enable required APIs**
```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable sql-component.googleapis.com
```

2. **Build and deploy with Cloud Build**
```bash
# Submit build to Cloud Build
gcloud builds submit --tag gcr.io/PROJECT_ID/linkhub-saas

# Deploy to Cloud Run
gcloud run deploy linkhub-saas \
  --image gcr.io/PROJECT_ID/linkhub-saas \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production
```

### Cloud Run Configuration (cloudbuild.yaml)
```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/linkhub-saas', '.']
  
  # Push the container image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/linkhub-saas']
  
  # Deploy container image to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
    - 'run'
    - 'deploy'
    - 'linkhub-saas'
    - '--image'
    - 'gcr.io/$PROJECT_ID/linkhub-saas'
    - '--region'
    - 'us-central1'
    - '--platform'
    - 'managed'
    - '--allow-unauthenticated'

images:
- gcr.io/$PROJECT_ID/linkhub-saas
```

## Option 2: Google Kubernetes Engine (GKE)

### 1. Create GKE Cluster
```bash
gcloud container clusters create linkhub-cluster \
  --zone us-central1-a \
  --num-nodes 2 \
  --machine-type e2-medium \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 5
```

### 2. Kubernetes Deployment
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: linkhub-saas
spec:
  replicas: 2
  selector:
    matchLabels:
      app: linkhub-saas
  template:
    metadata:
      labels:
        app: linkhub-saas
    spec:
      containers:
      - name: linkhub-saas
        image: gcr.io/PROJECT_ID/linkhub-saas:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: linkhub-secrets
              key: jwt-secret
        - name: STRIPE_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: linkhub-secrets
              key: stripe-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: linkhub-saas-service
spec:
  selector:
    app: linkhub-saas
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Option 3: Google App Engine

### Create app.yaml
```yaml
runtime: nodejs18

env_variables:
  NODE_ENV: production
  JWT_SECRET: your-jwt-secret-here
  STRIPE_SECRET_KEY: your-stripe-secret-here

automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.6

resources:
  cpu: 1
  memory_gb: 0.5
  disk_size_gb: 10
```

### Deploy to App Engine
```bash
gcloud app deploy
```

## Database Options

### Option A: Cloud SQL (PostgreSQL)
```bash
# Create Cloud SQL instance
gcloud sql instances create linkhub-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=secure-password

# Create database
gcloud sql databases create linkhub --instance=linkhub-db

# Create user
gcloud sql users create linkuser \
  --instance=linkhub-db \
  --password=user-password
```

### Option B: Cloud SQL Serverless (AlloyDB Omni)
```yaml
# Terraform configuration
resource "google_alloydb_cluster" "linkhub_cluster" {
  cluster_id = "linkhub-cluster"
  location   = "us-central1"
  network    = google_compute_network.default.id

  initial_user {
    user     = "linkuser"
    password = var.db_password
  }

  automated_backup_policy {
    location      = "us-central1"
    backup_window = "23:00-07:00"
    enabled       = true

    weekly_schedule {
      days_of_week = ["SUNDAY"]
      start_times {
        hours   = 23
        minutes = 0
      }
    }
  }
}
```

### Option C: Firestore (NoSQL Alternative)
```javascript
// Update Prisma schema for Firestore
// Note: This requires significant code changes
// Consider using Firebase Admin SDK instead of Prisma
```

## Environment Variables Setup

### Google Secret Manager
```bash
# Create secrets
gcloud secrets create jwt-secret --data-file=jwt-secret.txt
gcloud secrets create stripe-secret --data-file=stripe-secret.txt
gcloud secrets create database-url --data-file=database-url.txt

# Grant access to Cloud Run
gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Update Cloud Run with Secrets
```bash
gcloud run services update linkhub-saas \
  --update-secrets JWT_SECRET=jwt-secret:latest \
  --update-secrets STRIPE_SECRET_KEY=stripe-secret:latest \
  --update-secrets DATABASE_URL=database-url:latest \
  --region us-central1
```

## CDN and Static Assets

### Cloud CDN with Load Balancer
```yaml
# Terraform configuration
resource "google_compute_global_forwarding_rule" "linkhub_forwarding_rule" {
  name       = "linkhub-forwarding-rule"
  target     = google_compute_target_https_proxy.linkhub_https_proxy.id
  port_range = "443"
}

resource "google_compute_target_https_proxy" "linkhub_https_proxy" {
  name             = "linkhub-https-proxy"
  url_map          = google_compute_url_map.linkhub_url_map.id
  ssl_certificates = [google_compute_managed_ssl_certificate.linkhub_ssl_cert.id]
}

resource "google_compute_url_map" "linkhub_url_map" {
  name            = "linkhub-url-map"
  default_service = google_compute_backend_service.linkhub_backend.id
}

resource "google_compute_backend_service" "linkhub_backend" {
  name        = "linkhub-backend"
  protocol    = "HTTP"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.linkhub_neg.id
  }

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    signed_url_cache_max_age_sec = 7200
  }
}
```

## Domain and SSL

### Cloud DNS and Managed SSL
```bash
# Create DNS zone
gcloud dns managed-zones create linkhub-zone \
  --description="LinkHub DNS zone" \
  --dns-name=yourdomain.com

# Create managed SSL certificate
gcloud compute ssl-certificates create linkhub-ssl-cert \
  --domains=yourdomain.com,www.yourdomain.com \
  --global
```

## Monitoring and Logging

### Cloud Monitoring Setup
```yaml
# monitoring.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: linkhub-saas-monitor
spec:
  selector:
    matchLabels:
      app: linkhub-saas
  endpoints:
  - port: http
    path: /health
    interval: 30s
```

### Alerting Policy
```bash
gcloud alpha monitoring policies create \
  --policy-from-file=alerting-policy.yaml
```

## Cost Estimation

### Cloud Run (Recommended)
- **Compute**: ~$20-40/month for small traffic
- **Database**: Cloud SQL f1-micro ~$10/month
- **Total**: ~$30-50/month

### GKE
- **Cluster**: ~$75/month (cluster management fee)
- **Nodes**: 2x e2-medium ~$50/month
- **Database**: ~$10/month
- **Total**: ~$135/month

### App Engine
- **Compute**: ~$25-50/month
- **Database**: ~$10/month
- **Total**: ~$35-60/month

## Infrastructure as Code (Terraform)

### Create main.tf
```hcl
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Cloud Run service
resource "google_cloud_run_service" "linkhub_saas" {
  name     = "linkhub-saas"
  location = var.region

  template {
    spec {
      containers {
        image = "gcr.io/${var.project_id}/linkhub-saas"
        
        ports {
          container_port = 3000
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        env {
          name = "JWT_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.jwt_secret.secret_id
              key  = "latest"
            }
          }
        }

        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Cloud SQL instance
resource "google_sql_database_instance" "linkhub_db" {
  name             = "linkhub-db"
  database_version = "POSTGRES_14"
  region           = var.region

  settings {
    tier = "db-f1-micro"
    
    backup_configuration {
      enabled    = true
      start_time = "23:00"
    }
  }
}
```

## Quick Deploy Script

Create `deploy-gcp.sh`:
```bash
#!/bin/bash
set -e

PROJECT_ID=${1:-your-project-id}
REGION=${2:-us-central1}

echo "🚀 Deploying LinkHub SaaS to GCP..."

# Set project
gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# Build and deploy
gcloud builds submit --tag gcr.io/$PROJECT_ID/linkhub-saas

gcloud run deploy linkhub-saas \
  --image gcr.io/$PROJECT_ID/linkhub-saas \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --set-env-vars NODE_ENV=production

echo "✅ Deployment complete!"
echo "🌐 Your app is available at:"
gcloud run services describe linkhub-saas --region=$REGION --format='value(status.url)'
```

## CI/CD with Cloud Build

### Create cloudbuild.yaml
```yaml
steps:
  # Install dependencies
  - name: 'node:18'
    entrypoint: 'npm'
    args: ['install']

  # Run tests
  - name: 'node:18'
    entrypoint: 'npm'
    args: ['test']

  # Build application
  - name: 'node:18'
    entrypoint: 'npm'
    args: ['run', 'build']

  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/linkhub-saas:$COMMIT_SHA', '.']

  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/linkhub-saas:$COMMIT_SHA']

  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
    - 'run'
    - 'deploy'
    - 'linkhub-saas'
    - '--image'
    - 'gcr.io/$PROJECT_ID/linkhub-saas:$COMMIT_SHA'
    - '--region'
    - 'us-central1'
    - '--platform'
    - 'managed'

images:
- 'gcr.io/$PROJECT_ID/linkhub-saas:$COMMIT_SHA'
```

## Next Steps

1. Choose deployment option (Cloud Run recommended)
2. Set up database (Cloud SQL)
3. Configure secrets in Secret Manager
4. Set up custom domain and SSL
5. Configure monitoring and alerting
6. Set up CI/CD pipeline

## Support

For issues with GCP deployment:
- Check Cloud Logging
- Verify IAM permissions
- Check service quotas
- Review Cloud Run logs