#!/bin/bash
# Installs Prometheus, Grafana, Jaeger, and Kiali for observability

kubectl apply -f https://raw.githubusercontent.com/istio/istio/master/samples/addons/prometheus.yaml
kubectl apply -f https://raw.githubusercontent.com/istio/istio/master/samples/addons/grafana.yaml
kubectl apply -f https://raw.githubusercontent.com/istio/istio/master/samples/addons/jaeger.yaml
kubectl apply -f https://raw.githubusercontent.com/istio/istio/master/samples/addons/kiali.yaml

echo "Observability addons installed."
echo "Access Kiali dashboard with: istioctl dashboard kiali"