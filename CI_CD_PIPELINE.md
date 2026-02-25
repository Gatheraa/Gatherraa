# Gatheraa CI/CD Pipeline

This document outlines the Continuous Integration and Continuous Deployment pipeline for Gatheraa, utilizing GitHub Actions for CI and ArgoCD for GitOps-based CD.

## Architecture

1.  **CI (GitHub Actions)**:
    *   **Test**: Runs unit and integration tests.
    *   **Security**: Performs SAST scanning using Trivy.
    *   **Build**: Builds Docker images and pushes to the registry.
    *   **Update**: Updates the Kubernetes manifests in the git repository with the new image tag.

2.  **CD (ArgoCD)**:
    *   **Sync**: Monitors the git repository for changes.
    *   **Deploy**: Applies changes to the Kubernetes cluster.
    *   **Rollout**: Uses Argo Rollouts for progressive delivery (Canary).

## Pipeline Stages

### 1. Automated Testing Gates
Triggered on Pull Requests and Pushes to `main`.
- Unit Tests (`npm test`)
- Linting

### 2. Security Scanning
Triggered on Pull Requests.
- **SAST**: Scans code for vulnerabilities.
- **Container Scan**: Scans the built image for CVEs.

### 3. Canary Deployment
Managed by Argo Rollouts controller.
- **Step 1**: Route 20% of traffic to the new version.
- **Analysis**: Check success rate (Prometheus metrics).
- **Step 2**: Pause for manual approval or auto-promote after duration.
- **Step 3**: Route 100% traffic.

## Rollback Mechanism

If the analysis step fails (e.g., error rate > 1%), Argo Rollouts automatically aborts the deployment and routes traffic back to the stable version.

Manual rollback can be triggered via:
```bash
kubectl argo rollouts undo gatheraa-backend -n gatheraa
```

## Configuration Files

- `.github/workflows/ci-cd.yaml`: Main pipeline definition.
- `infrastructure/k8s/rollout.yaml`: Canary deployment definition.
- `infrastructure/k8s/analysis.yaml`: Metric checks for auto-rollback.
- `infrastructure/argocd/application.yaml`: ArgoCD app definition.

## Setup

1.  **Secrets**: Configure `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` in GitHub Secrets.
2.  **ArgoCD**: Apply the application manifest:
    ```bash
    kubectl apply -f infrastructure/argocd/application.yaml
    ```
3.  **Argo Rollouts**: Ensure the controller is installed in the cluster.

## Notifications

Deployment status notifications are sent to the configured Slack channel via the GitHub Actions workflow.