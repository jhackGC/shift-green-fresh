#!/bin/bash
set -euo pipefail

# Loads this app's sensitive env vars from Azure Key Vault and runs a command with them exported —
# same approach as shift-admin-v2's scripts/run-with-keyvault-env.sh, trimmed to this app's needs.
# Secrets are never written to disk (no .env file is created/edited); they only ever live in this
# process's environment, inherited by whatever command is exec'd at the end.
#
# Only the handful of genuinely sensitive vars go through this — non-secret config (SMTP_HOST,
# SMTP_PORT, ORDER_NOTIFY_TO, etc.) stays in .env.local as plain values, same as before.

STAGE="dev_javier"
KEYVAULT_NAME="shift-green-fresh"
AZURE_SUBSCRIPTION="82be16d1-e2fb-4be2-acc7-787d6f9e6b2f"
KEYVAULT_MAP_FILE=""
DEBUG_ENV_PREFIX="false"

ENV_KEYS=(
  "ADMIN_PASSWORD"
  "ADMIN_SESSION_SECRET"
  "SMTP_PASS"
  "MONGODB_URI"
)

to_kv_secret_name_default() {
  local key="$1"
  local lower
  lower="$(echo "$key" | tr '[:upper:]' '[:lower:]')"
  lower="$(echo "$lower" | tr '_' '-')"
  echo "shift-green-fresh-${STAGE}-${lower}"
}

parse_args() {
  local args=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --keyvault-name)
        KEYVAULT_NAME="$2"
        shift 2
        ;;
      --azure-subscription)
        AZURE_SUBSCRIPTION="$2"
        shift 2
        ;;
      --keyvault-map-file)
        KEYVAULT_MAP_FILE="$2"
        shift 2
        ;;
      --debug-env-prefix|--debug-sensitive-prefix)
        DEBUG_ENV_PREFIX="true"
        shift
        ;;
      --)
        shift
        args=("$@")
        break
        ;;
      dev_javier|test|prod)
        STAGE="$1"
        shift
        ;;
      *)
        echo "Unknown argument: $1" >&2
        exit 1
        ;;
    esac
  done

  if [[ ${#args[@]} -eq 0 ]]; then
    echo "No command provided." >&2
    exit 1
  fi

  if [[ -z "$KEYVAULT_MAP_FILE" ]]; then
    local default_map="./config/keyvault-map.${STAGE}.env"
    if [[ -f "$default_map" ]]; then
      KEYVAULT_MAP_FILE="$default_map"
    fi
  fi

  CMD=("${args[@]}")
}

require_az_cli() {
  if ! command -v az >/dev/null 2>&1; then
    echo "Azure CLI is required but was not found in PATH." >&2
    exit 1
  fi
}

apply_subscription_context() {
  if [[ -n "$AZURE_SUBSCRIPTION" ]]; then
    az account set --subscription "$AZURE_SUBSCRIPTION" >/dev/null
  fi
}

get_mapped_secret_name() {
  local key="$1"

  if [[ -z "$KEYVAULT_MAP_FILE" || ! -f "$KEYVAULT_MAP_FILE" ]]; then
    return 1
  fi

  local line
  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$KEYVAULT_MAP_FILE" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 1
  fi

  local mapped
  mapped="${line#*=}"
  mapped="${mapped%%#*}"
  mapped="$(echo "$mapped" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  mapped="${mapped%\"}"
  mapped="${mapped#\"}"
  mapped="${mapped%\'}"
  mapped="${mapped#\'}"

  [[ -n "$mapped" ]] || return 1
  echo "$mapped"
}

fetch_keyvault_secret_value() {
  local secret_name="$1"
  az keyvault secret show \
    --vault-name "$KEYVAULT_NAME" \
    --name "$secret_name" \
    --query value \
    --output tsv 2>/dev/null
}

load_env_from_keyvault() {
  local loaded=0

  for key in "${ENV_KEYS[@]}"; do
    local mapped_name
    local selected_name
    local value

    mapped_name="$(get_mapped_secret_name "$key" || true)"
    selected_name="${mapped_name:-$(to_kv_secret_name_default "$key")}"

    echo "[INFO] Loading env: ${key} <- ${selected_name}" >&2
    if value="$(fetch_keyvault_secret_value "$selected_name")"; then
      export "${key}=${value}"
      loaded=$((loaded + 1))
      continue
    fi

    echo "[ERROR] Missing required Azure Key Vault secret" >&2
    echo "  key: ${key}" >&2
    echo "  secret: ${selected_name}" >&2
    echo "  key vault: ${KEYVAULT_NAME}" >&2
    exit 1
  done

  echo "Loaded ${loaded} values from Azure Key Vault ${KEYVAULT_NAME}" >&2
}

print_env_debug() {
  [[ "$DEBUG_ENV_PREFIX" == "true" ]] || return 0

  echo "KeyVault map file: ${KEYVAULT_MAP_FILE:-<none>}" >&2
  echo "Env debug (prefix + length only):" >&2
  for key in "${ENV_KEYS[@]}"; do
    local value="${!key:-}"
    local length=${#value}
    local prefix="-"
    if [[ $length -gt 0 ]]; then
      prefix="${value:0:1}"
    fi
    echo "  ${key}: ${prefix}*** (len=${length})" >&2
  done
}

main() {
  parse_args "$@"
  require_az_cli
  apply_subscription_context
  load_env_from_keyvault
  print_env_debug

  echo "Running command with Key Vault env: ${CMD[*]}" >&2
  exec "${CMD[@]}"
}

main "$@"
