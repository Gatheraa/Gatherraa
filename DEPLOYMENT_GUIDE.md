# Deployment Guide

This guide provides comprehensive instructions for deploying Gathera to various environments, including development, staging, and production setups.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Network Configurations](#network-configurations)
4. [Deployment Steps](#deployment-steps)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [Smart Contract Deployment](#smart-contract-deployment)
8. [Backend Deployment](#backend-deployment)
9. [Frontend Deployment](#frontend-deployment)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Rollback Procedures](#rollback-procedures)
12. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **Node.js**: 20.x or higher
- **Rust**: 1.74.0 or higher
- **Docker**: 20.x or higher
- **Kubernetes**: 1.25+ (for production)
- **PostgreSQL**: 14+ or higher
- **Redis**: 6+ or higher
- **Nginx**: 1.20+ (for reverse proxy)

### Stellar Network Requirements
- **Soroban CLI**: Latest version
- **Stellar Account**: Funded account for deployment
- **Network Access**: Testnet/Futurenet for testing, Mainnet for production

### Development Tools
```bash
# Install Node.js (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install Soroban CLI
cargo install --locked soroban-cli

# Install Docker
# Follow instructions at https://docs.docker.com/get-docker/
```

## Environment Setup

### 1. Clone and Prepare Repository
```bash
git clone https://github.com/Gatheraa/Gatherraa.git
cd Gatherraa
```

### 2. Environment Configuration
```bash
# Copy environment templates
cp app/backend/.env.example app/backend/.env
cp app/backend/.env.payments.example app/backend/.env.payments
cp contract/.env.example contract/.env

# Set up environment variables (see Environment Variables section)
```

### 3. Install Dependencies
```bash
# Contract dependencies
cd contract
npm install

# Backend dependencies
cd ../app/backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

## Network Configurations

### Development Environment
- **Stellar Network**: Futurenet
- **Database**: Local PostgreSQL
- **Redis**: Local Redis instance
- **API**: Local development server

### Staging Environment
- **Stellar Network**: Testnet
- **Database**: Cloud PostgreSQL (AWS RDS/Google Cloud SQL)
- **Redis**: Cloud Redis (ElastiCache/Memorystore)
- **API**: Staging server with load balancer

### Production Environment
- **Stellar Network**: Mainnet
- **Database**: High-availability PostgreSQL cluster
- **Redis**: Clustered Redis with replication
- **API**: Production-grade load balancer with auto-scaling

### Network Security
```yaml
# Example Kubernetes network policy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: gathera-network-policy
spec:
  podSelector:
    matchLabels:
      app: gathera
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx-ingress
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432
```

## Deployment Steps

### Step 1: Database Setup
```bash
# Create PostgreSQL database
createdb gathera_dev
createdb gathera_staging
createdb gathera_prod

# Run migrations
cd app/backend
npm run migration:run
```

### Step 2: Redis Setup
```bash
# Start Redis (development)
redis-server

# Configure Redis (production)
# Use cloud provider's Redis service
```

### Step 3: Smart Contract Deployment
```bash
cd contract

# Build contracts
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/gathera_event.wasm \
  --source $DEPLOYER_KEY \
  --network testnet

# Deploy to mainnet (production)
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/gathera_event.wasm \
  --source $DEPLOYER_KEY \
  --network mainnet
```

### Step 4: Backend Deployment
```bash
cd app/backend

# Development
npm run start:dev

# Production build
npm run build
npm run start:prod

# Docker deployment
docker build -t gathera-backend .
docker run -p 3000:3000 gathera-backend
```

### Step 5: Frontend Deployment
```bash
cd app/frontend

# Development
npm run dev

# Production build
npm run build
npm run start

# Docker deployment
docker build -t gathera-frontend .
docker run -p 3001:3000 gathera-frontend
```

## Environment Variables

### Backend Environment (.env)
```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/gathera_dev
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=gathera_dev
DATABASE_USER=username
DATABASE_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Stellar
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# API
PORT=3000
API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:3001

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json

# Monitoring
PROMETHEUS_PORT=9090
HEALTH_CHECK_PORT=3001
```

### Frontend Environment (.env.local)
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3000

# Stellar Configuration
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Analytics
NEXT_PUBLIC_GA_ID=your-google-analytics-id
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ERROR_REPORTING=true
```

## Database Setup

### PostgreSQL Configuration
```sql
-- Create databases
CREATE DATABASE gathera_dev;
CREATE DATABASE gathera_staging;
CREATE DATABASE gathera_prod;

-- Create users
CREATE USER gathera_dev WITH PASSWORD 'dev_password';
CREATE USER gathera_staging WITH PASSWORD 'staging_password';
CREATE USER gathera_prod WITH PASSWORD 'prod_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE gathera_dev TO gathera_dev;
GRANT ALL PRIVILEGES ON DATABASE gathera_staging TO gathera_staging;
GRANT ALL PRIVILEGES ON DATABASE gathera_prod TO gathera_prod;
```

### Database Migrations
```bash
cd app/backend

# Run migrations
npm run migration:run

# Create new migration
npm run migration:create -- MigrationName

# Revert migration
npm run migration:revert
```

### Database Backups
```bash
# Backup development database
pg_dump gathera_dev > backup_dev.sql

# Backup production database
pg_dump gathera_prod > backup_prod.sql

# Restore database
psql gathera_dev < backup_dev.sql
```

## Smart Contract Deployment

### Pre-deployment Checklist
- [ ] Contract tests passing
- [ ] Gas optimization completed
- [ ] Security audit passed
- [ ] Contract addresses documented
- [ ] Upgrade mechanism tested

### Deployment Commands
```bash
# Deploy Event Contract
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/gathera_event.wasm \
  --source $DEPLOYER_KEY \
  --network testnet \
  --contract-id event_contract_id

# Deploy Ticket Contract
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/gathera_ticket.wasm \
  --source $DEPLOYER_KEY \
  --network testnet \
  --contract-id ticket_contract_id

# Deploy Identity Contract
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/gathera_identity.wasm \
  --source $DEPLOYER_KEY \
  --network testnet \
  --contract-id identity_contract_id
```

### Contract Verification
```bash
# Verify contract deployment
soroban contract read \
  --id $CONTRACT_ID \
  --network testnet \
  --method get_admin
```

## Backend Deployment

### Docker Deployment
```bash
# Build Docker image
cd app/backend
docker build -t gathera-backend:latest .

# Run container
docker run -d \
  --name gathera-backend \
  -p 3000:3000 \
  --env-file .env \
  gathera-backend:latest
```

### Kubernetes Deployment
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gathera-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gathera-backend
  template:
    metadata:
      labels:
        app: gathera-backend
    spec:
      containers:
      - name: backend
        image: gathera-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: gathera-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: gathera-secrets
              key: redis-url
```

### Load Balancer Configuration
```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: gathera-backend-service
spec:
  selector:
    app: gathera-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Frontend Deployment

### Static Site Deployment
```bash
cd app/frontend

# Build for production
npm run build

# Deploy to Vercel
vercel --prod

# Deploy to Netlify
netlify deploy --prod --dir=.next
```

### Docker Deployment
```bash
# Build Docker image
docker build -t gathera-frontend:latest .

# Run container
docker run -d \
  --name gathera-frontend \
  -p 3001:3000 \
  --env-file .env.local \
  gathera-frontend:latest
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name gathera.io;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring and Logging

### Prometheus Metrics
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'gathera-backend'
    static_configs:
      - targets: ['localhost:9090']
```

### Grafana Dashboard
- API response times
- Database connection pool
- Redis memory usage
- Stellar transaction metrics
- Error rates

### Log Aggregation
```bash
# Setup ELK stack
docker-compose up -d elasticsearch logstash kibana

# Configure log shipping
# Add filebeat configuration
```

## Rollback Procedures

### Database Rollback
```bash
# Identify last good migration
npm run migration:show

# Rollback to specific migration
npm run migration:revert -- -t 20240101000000

# Restore from backup
psql gathera_prod < backup_prod_good.sql
```

### Application Rollback
```bash
# Kubernetes rollback
kubectl rollout undo deployment/gathera-backend

# Docker rollback
docker stop gathera-backend
docker run -d --name gathera-backend gathera-backend:previous-tag

# Frontend rollback
vercel rollback [deployment-id]
```

### Smart Contract Rollback
```bash
# Upgrade contract (if upgradeable)
soroban contract upgrade \
  --id $CONTRACT_ID \
  --wasm target/wasm32-unknown-unknown/release/gathera_event_v2.wasm \
  --source $ADMIN_KEY \
  --network testnet

# Migrate to new contract (if not upgradeable)
# Deploy new contract and migrate data
```

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check database status
pg_isready -h localhost -p 5432

# Check connection
psql -h localhost -p 5432 -U username -d gathera_dev

# Reset connection pool
npm run migration:run
```

#### Redis Connection Issues
```bash
# Check Redis status
redis-cli ping

# Monitor Redis
redis-cli monitor

# Clear cache
redis-cli flushall
```

#### Stellar Network Issues
```bash
# Check network status
soroban network info

# Check account balance
soroban account info --account $ACCOUNT_ID --network testnet

# Check transaction status
soroban transaction info --id $TRANSACTION_ID --network testnet
```

#### Application Errors
```bash
# Check logs
docker logs gathera-backend
kubectl logs deployment/gathera-backend

# Health check
curl http://localhost:3000/health

# Debug mode
DEBUG=* npm run start:dev
```

### Performance Issues
```bash
# Monitor database queries
npm run migration:run -- --debug

# Profile application
node --inspect dist/main.js

# Memory usage
node --max-old-space-size=4096 dist/main.js
```

### Security Issues
```bash
# Scan for vulnerabilities
npm audit
cargo audit

# Check dependencies
npm ls
cargo tree

# Update dependencies
npm update
cargo update
```

## Emergency Procedures

### Incident Response
1. **Identify the issue**: Check logs and metrics
2. **Assess impact**: Determine affected systems and users
3. **Communicate**: Notify team and stakeholders
4. **Implement fix**: Apply patch or rollback
5. **Verify**: Test the fix
6. **Monitor**: Watch for recurrence

### Disaster Recovery
1. **Activate backup systems**
2. **Restore from backups**
3. **Verify data integrity**
4. **Restart services**
5. **Test functionality**
6. **Update documentation`

## Support

For deployment issues:
- Check the [troubleshooting section](#troubleshooting)
- Review [GitHub Issues](https://github.com/Gatheraa/Gatherraa/issues)
- Contact the development team
- Join our [Discord community](https://discord.gg/gathera)

---

*This deployment guide is maintained by the Gathera development team. Last updated: $(date)*
