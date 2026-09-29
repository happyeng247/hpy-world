#!/bin/zsh
set -eu

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
app_dir="${0:A:h}"
cd -- "$app_dir"
app_url='http://127.0.0.1:4173'

local_service_ready() {
  local reply
  reply=$(curl --noproxy '*' --silent --fail --max-time 2 "$app_url/api/session" 2>/dev/null) || return 1
  [[ "$reply" == '{"authenticated":false}' || "$reply" == '{"authenticated":true}' ]]
}

if local_service_ready; then
  print 'HPY is already running. Opening your space…'
  open "$app_url"
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  print -u2 'HPY needs Node.js 22 or later. Install Node, then open this launcher again.'
  exit 1
fi

node_major=$(node -p 'Number(process.versions.node.split(".")[0])')
if (( node_major < 22 )); then
  print -u2 'Please update Node.js to version 22 or later, then open this launcher again.'
  exit 1
fi

if [[ ! -f dist/index.html ]]; then
  if ! command -v npm >/dev/null 2>&1; then
    print -u2 'The app needs its first build, but npm was not found. Install Node.js with npm, then try again.'
    exit 1
  fi
  print 'Preparing HPY for its first visit…'
  npm ci --cache "$app_dir/node_modules/.cache/npm" --no-audit --no-fund
  npm run build
fi

private_data_dir="${DATA_DIR:-$app_dir/data}"
if [[ ! -f "$private_data_dir/config.json" ]]; then
  if [[ -z "${APP_PASSCODE:-}" ]]; then
    print 'Let’s give your new space a private passcode. Your typing will be hidden.'
    read -r -s 'APP_PASSCODE?Choose a passcode (8 or more characters): '
    print
    export APP_PASSCODE
  fi
  node server/setup.mjs
  unset APP_PASSCODE
fi

server_pid=''
cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 0' INT TERM

print 'Opening HPY. Keep this terminal open; press Control+C when you want to stop.'
env -u APP_ORIGIN NODE_ENV=development HOST=127.0.0.1 PORT=4173 node server/index.mjs &
server_pid=$!

for attempt in {1..50}; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    print -u2 'HPY could not start. The message above should explain what needs attention.'
    exit 1
  fi
  if local_service_ready; then
    open "$app_url"
    wait "$server_pid"
    exit 0
  fi
  sleep 0.1
done

print -u2 'HPY did not become ready. Check the messages above, then try the launcher again.'
exit 1
