#!/bin/bash
set -e

echo "Adding Istio Helm repo..."
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update

echo "Installing Istio Base..."
helm upgrade --install istio-base istio/base -n istio-system --create-namespace

echo "Installing Istiod..."
helm upgrade --install istiod istio/istiod -n istio-system --wait

echo "Installing Istio Ingress Gateway..."
helm upgrade --install istio-ingressgateway istio/gateway -n istio-system --wait

echo "Applying Mesh Configurations..."
kubectl apply -f manifests/

echo "Istio installation complete."