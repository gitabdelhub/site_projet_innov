#!/usr/bin/env bash
# Tests of the online game functions on a local Postgres:  PGHOST=... PGPORT=... supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
dropdb --if-exists -U postgres chess_test && createdb -U postgres chess_test
psql -q -v ON_ERROR_STOP=1 -U postgres -d chess_test -f supabase/tests/stub.sql
psql -q -v ON_ERROR_STOP=1 -U postgres -d chess_test -f supabase-setup.sql
psql -q -v ON_ERROR_STOP=1 -U postgres -d chess_test -f supabase-setup.sql   # re-run must not fail
psql -q -v ON_ERROR_STOP=1 -U postgres -d chess_test -f supabase/tests/scenarios.sql
# Upgrade path: a project that already ran the first version of the schema.
dropdb --if-exists -U postgres chess_test_upgrade && createdb -U postgres chess_test_upgrade
psql -q -v ON_ERROR_STOP=1 -U postgres -d chess_test_upgrade -f supabase/tests/stub.sql
psql -q -v ON_ERROR_STOP=1 -U postgres -d chess_test_upgrade -f supabase/tests/old-schema.sql
psql -q -v ON_ERROR_STOP=1 -U postgres -d chess_test_upgrade -f supabase-setup.sql
psql -q -v ON_ERROR_STOP=1 -U postgres -d chess_test_upgrade -f supabase/tests/scenarios.sql
echo "ALL TESTS PASSED (new project and upgrade from the first schema)"
