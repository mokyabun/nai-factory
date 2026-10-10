#!/usr/bin/env bash
# Builds the Docker image, starts it in NovelAI mock mode and generates one image end to end.
set -euo pipefail

IMAGE=${IMAGE:-nai-factory:smoke}
NAME=nai-factory-smoke
PORT=${PORT:-3123}
BASE="http://127.0.0.1:${PORT}"

cleanup() {
    docker logs "$NAME" > smoke-server.log 2>&1 || true
    docker rm -f "$NAME" > /dev/null 2>&1 || true
}
trap cleanup EXIT

docker build -t "$IMAGE" .
docker run -d --name "$NAME" -p "127.0.0.1:${PORT}:3000" -e NAI_FACTORY_NOVELAI_MODE=mock "$IMAGE"

for _ in $(seq 1 60); do
    curl -fsS "$BASE/healthz" > /dev/null 2>&1 && break
    sleep 1
done
curl -fsS "$BASE/healthz"
echo

api() {
    local method=$1 path=$2 body=${3:-}
    if [ -n "$body" ]; then
        curl -fsS -X "$method" -H 'content-type: application/json' -d "$body" "$BASE/api$path"
    else
        curl -fsS -X "$method" "$BASE/api$path"
    fi
}

project_id=$(api POST /projects '{"groupId":null,"name":"smoke"}' | jq -r .id)
scene_id=$(api POST /scenes "{\"projectId\":$project_id,\"name\":\"scene\"}" | jq -r .id)
api PATCH "/scenes/$scene_id" '{"variations":[{"variables":[{"key":"pose","value":"standing"}]}]}' > /dev/null
api POST /jobs/scene "{\"sceneIds\":[$scene_id]}" > /dev/null
api POST /jobs/start > /dev/null

asset_id=""
for _ in $(seq 1 60); do
    asset_id=$(api GET "/images?sceneId=$scene_id" | jq -r '.[0].assetId // empty')
    [ -n "$asset_id" ] && break
    sleep 1
done
if [ -z "$asset_id" ]; then
    echo "No image was generated" >&2
    exit 1
fi

status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/assets/$asset_id")
[ "$status" = 200 ] || { echo "Asset request failed: $status" >&2; exit 1; }

status=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: evil.example' "$BASE/api/settings")
[ "$status" = 403 ] || { echo "Unknown Host was not refused: $status" >&2; exit 1; }

echo "Smoke test passed"
