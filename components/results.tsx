import type { SearchResults } from "@/lib/db/search";

export function Results({
  query,
  results,
  queryTimeMs,
  embedTimeMs,
}: SearchResults & { query: string }) {
  if (!query.trim()) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        Describe a plot, a mood, or a premise. Vector search does not need your
        words to appear in the movie.
      </p>
    );
  }

  if (results.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {results.map((result) => (
          <li
            key={result.id}
            className="text-black dark:text-white p-3 bg-gray-100 dark:bg-gray-900 rounded"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold">
                {result.title}
                {result.year ? (
                  <span className="text-gray-500 font-normal">
                    {" "}
                    ({result.year})
                  </span>
                ) : null}
              </span>
              {result.distance !== undefined ? (
                <span
                  className="text-xs text-gray-400 shrink-0"
                  title="Cosine distance — lower is a closer match"
                >
                  {result.distance.toFixed(4)}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {result.overview}
            </p>
            {result.genres.length > 0 ? (
              <p className="text-xs text-gray-500 mt-2">
                {result.genres.join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs italic text-gray-500">
        Fetched {results.length} movie{results.length === 1 ? "" : "s"} in{" "}
        {queryTimeMs} ms
        {embedTimeMs ? `, after ${embedTimeMs} ms embedding the query` : ""}
      </p>
    </div>
  );
}

/**
 * A vector query returns the nearest neighbours of whatever you typed, so with a
 * seeded index it always returns something. Zero results therefore points at an
 * empty index rather than an unlucky query.
 */
function EmptyState() {
  return (
    <p className="text-sm text-gray-500 py-8 text-center">
      No results. The index may not be seeded yet — run{" "}
      <code className="text-gray-700 dark:text-gray-300">pnpm db:seed</code>.
    </p>
  );
}
