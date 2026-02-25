# Gatheraa Service Mesh (Istio)

This directory contains the configuration and installation scripts for the Istio Service Mesh implementation for Gatheraa.

## Features Implemented
- **mTLS**: Strict mutual TLS between all services in the mesh.
- **Traffic Management**: Ingress Gateway, Virtual Services for routing.
- **Resilience**: Circuit breaking and outlier detection.
- **Deployment Strategies**: Canary deployment support.
- **Security**: Authorization policies for service-to-service access.
- **Observability**: Integration with Kiali, Prometheus, Grafana, and Jaeger.

## Prerequisites
- Kubernetes Cluster (v1.25+)
- Helm (v3.0+)
- `kubectl` configured

## Installation

1. Run the installation script:
   ```bash
   ./install.sh
   ```

2. Install Observability Addons (Kiali, Prometheus, Jaeger, Grafana):
   ```bash
   ./install-addons.sh
   ```

3. Enable sidecar injection for the application namespace:
   ```bash
   kubectl label namespace gatheraa istio-injection=enabled
   ```

## Configuration Files
- `manifests/01-peer-authentication.yaml`: Enforces mTLS.
- `manifests/02-ingress-gateway.yaml`: Configures external access.
- `manifests/03-circuit-breaking.yaml`: Defines connection limits and outlier detection.
- `manifests/04-canary-rollout.yaml`: Defines traffic splitting for canary releases.
- `manifests/05-authorization-policy.yaml`: Defines access control rules.