#!/bin/bash
set -euo pipefail

native="$1"
data=$(mktemp -d /tmp/anvil-repository-qa.XXXXXX)
redis_pid=
postgres_started=false
cleanup() {
  if [[ -n "$redis_pid" ]]; then
    kill "$redis_pid" 2>/dev/null || true
    wait "$redis_pid" 2>/dev/null || true
  fi
  if [[ "$postgres_started" == true ]]; then
    "$native/pg_ctl" -D "$data/db" -m fast stop
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
pg_port=5432
redis_port=$(node -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()});')
secret=$(node -e 'console.log(require("node:crypto").randomBytes(24).toString("hex"))')
umask 077
printf 'bind 127.0.0.1\nport %s\nrequirepass %s\nsave ""\n' "$redis_port" "$secret" > "$data/redis.conf"

LC_ALL=C.UTF-8 "$native/initdb" -D "$data/db" -U searchanvil --auth-local=trust --auth-host=scram-sha-256 > "$data/initdb.log"
"$native/pg_ctl" -D "$data/db" -l "$data/postgres.log" -o "-k $data -p $pg_port -c listen_addresses=''" -w start
postgres_started=true
"$native/redis-server" "$data/redis.conf" --dir "$data" > "$data/redis.log" 2>&1 &
redis_pid=$!
export DATABASE_URL="postgresql://searchanvil@localhost:$pg_port/postgres?host=$data"
export REDIS_URL="redis://:$secret@127.0.0.1:$redis_port"

pnpm db:generate
pnpm --filter @searchanvil/database migrate:deploy
pnpm test
pnpm build
pnpm test:e2e
