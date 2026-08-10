/**
 * Minimal in-memory fake for the subset of the supabase-js chainable query
 * builder used by route handlers under test: .from().select().eq().single(),
 * .from().select(col, {count,head}).eq(), .from().insert().select().single(),
 * .from().select().eq().order() (awaited directly, no .single()).
 * Not a general-purpose mock — extend the chain surface only as new routes need it.
 */
type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | null; error: { message: string } | null };

export function createFakeSupabase(data: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const sorts: Array<[string, boolean]> = [];

      const rowsInScope = () => {
        const filtered = applyFilters(data[table] ?? [], filters);
        return applySorts(filtered, sorts);
      };

      const builder = {
        select(_cols?: string, opts?: { count?: string; head?: boolean }) {
          if (opts?.count) {
            return {
              eq(col: string, val: unknown) {
                filters.push([col, val]);
                const rows = rowsInScope();
                return Promise.resolve({ count: rows.length, data: null, error: null });
              },
            };
          }
          return builder;
        },
        eq(col: string, val: unknown) {
          filters.push([col, val]);
          return builder;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          sorts.push([col, opts?.ascending ?? true]);
          return builder;
        },
        single() {
          const rows = rowsInScope();
          if (rows.length === 0) {
            return Promise.resolve({ data: null, error: { message: "Not found" } });
          }
          return Promise.resolve({ data: rows[0], error: null });
        },
        insert(obj: Row) {
          // Mirrors Postgres defaults (uuid primary key, created_at timestamptz
          // default now()) so schema validation on the response behaves like it
          // would against the real database. Deliberately NOT `.toISOString()`
          // (which ends in "Z") — PostgREST returns a numeric offset
          // ("+00:00") with microsecond precision. A mock that used the JS
          // format masked a real bug (PHASE-0 Task 5, 2026-08-10): the
          // entities route 400'd on every insert against the live DB despite
          // the row being written, because `z.iso.datetime()` only accepted
          // "Z". Use `pgTimestamptz` (src/lib/schema/timestamp.ts) to validate.
          const inserted = {
            id: crypto.randomUUID(),
            created_at: new Date().toISOString().replace("Z", "000+00:00"),
            ...obj,
          };
          data[table] = [...(data[table] ?? []), inserted];
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: inserted, error: null });
                },
              };
            },
          };
        },
        // Makes `await supabase.from(t).select().eq(...).order(...)` resolve
        // without a trailing .single() — the list-query shape.
        then<TResult1 = QueryResult>(
          onFulfilled?: (value: QueryResult) => TResult1 | PromiseLike<TResult1>
        ) {
          const result: QueryResult = { data: rowsInScope(), error: null };
          return Promise.resolve(onFulfilled ? onFulfilled(result) : (result as unknown as TResult1));
        },
      };

      return builder;
    },
  };
}

function applyFilters(rows: Row[], filters: Array<[string, unknown]>) {
  return rows.filter((row) => filters.every(([key, value]) => row[key] === value));
}

function applySorts(rows: Row[], sorts: Array<[string, boolean]>) {
  if (sorts.length === 0) return rows;
  const [col, ascending] = sorts[0];
  return [...rows].sort((a, b) => {
    const av = a[col];
    const bv = b[col];
    if (av === bv) return 0;
    const cmp = (av as string | number) < (bv as string | number) ? -1 : 1;
    return ascending ? cmp : -cmp;
  });
}
