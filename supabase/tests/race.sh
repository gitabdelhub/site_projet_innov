#!/usr/bin/env bash
# Concurrency test: 12 players poll find_match at the same time. Each must end in exactly one game,
# with no player in two games. Run after run.sh (uses the chess_test database).
set -euo pipefail
N=12
psql -q -U postgres -d chess_test -c "update online_games set status = 'aborted' where status in ('active', 'waiting'); delete from online_seeks;"
psql -q -U postgres -d chess_test -c "insert into auth.users (id, email, raw_user_meta_data)
  select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid, 'r' || i || '@test.local', jsonb_build_object('username', 'racer' || i)
  from generate_series(1, $N) i on conflict do nothing;"
for i in $(seq 1 $N); do
  uid="00000000-0000-0000-0001-$(printf '%012d' "$i")"
  (
    for k in $(seq 1 15); do
      r=$(psql -qtA -U postgres -d chess_test -c "select set_config('test.uid', '$uid', false); set role authenticated; select coalesce(find_match(60000, 0)::text, '-');" | tail -1)
      if [ "$r" != "-" ]; then echo "$uid $r"; break; fi
      sleep 0.$((RANDOM % 4 + 1))
    done
  ) &
done > /tmp/race_out.txt
wait
games=$(psql -qtA -U postgres -d chess_test -c "select count(*) from online_games where status = 'active'")
double=$(psql -qtA -U postgres -d chess_test -c "select count(*) from (select u from online_games, unnest(array[white_id, black_id]) u where status = 'active' group by u having count(*) > 1) x")
paired=$(wc -l < /tmp/race_out.txt)
consistent=$(sort -k2 /tmp/race_out.txt | awk '{print $2}' | uniq -c | awk '$1 != 2' | wc -l)
echo "players paired: $paired / $N, active games: $games, players in two games: $double, games not seen by both players: $consistent"
[ "$paired" = "$N" ] && [ "$games" = "$((N / 2))" ] && [ "$double" = 0 ] && [ "$consistent" = 0 ] && echo "RACE TEST PASSED"
