#!/usr/bin/env sh
# Grafana startup guard for the local observability stack.
#
# Grafana's default admin credentials are development-only. This entrypoint
# aborts startup when the admin password is left at a weak/dev default while
# the deployment is not explicitly marked development-only, so the stack cannot
# silently come up with known credentials in a context it may be exposed beyond
# localhost.
#
# Environment (set by docker-compose; see observability/.env.example):
#   GRAFANA_DEV_ONLY         "true" (default) when this is a local-only stack.
#   GRAFANA_ADMIN_USER       admin user name (default "admin").
#   GRAFANA_ADMIN_PASSWORD   admin password (development default "admin").
#
# Production-like default passwords are never accepted unless GRAFANA_DEV_ONLY
# is explicitly "true". Even then the README warns never to expose the stack.

set -eu

is_dev_only="$(printf '%s' "${GRAFANA_DEV_ONLY:-false}" | tr '[:upper:]' '[:lower:]')"
effective_password="${GRAFANA_ADMIN_PASSWORD:-admin}"

weak_defaults="admin admin123 password grafana root"

is_weak_default() {
  # shellcheck disable=SC2086
  for candidate in $weak_defaults; do
    if [ "$1" = "$candidate" ]; then
      return 0
    fi
  done
  return 1
}

if [ "$is_dev_only" != "true" ] && [ "$is_dev_only" != "1" ]; then
  if is_weak_default "$effective_password"; then
    echo "ERROR: Grafana admin password is a weak/default value and this is" \
      "not marked development-only (GRAFANA_DEV_ONLY != true)." >&2
    echo "Set a strong GRAFANA_ADMIN_PASSWORD before starting the stack." >&2
    exit 1
  fi
fi

# Forward to the stock Grafana entrypoint (image default: /run.sh on PATH).
if [ -z "${GRAFANA_ENTRYPOINT:-}" ]; then
  command -v /run.sh >/dev/null 2>&1 || command -v run.sh >/dev/null 2>&1 \
    || { echo "ERROR: stock Grafana entrypoint not found." >&2; exit 1; }
  if [ -x /run.sh ]; then
    exec /run.sh "$@"
  fi
  exec run.sh "$@"
fi

exec "$GRAFANA_ENTRYPOINT" "$@"
