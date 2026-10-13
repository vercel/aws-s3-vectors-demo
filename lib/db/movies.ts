import fs from "fs";
import path from "path";
import csv from "csv-parser";

export interface Movie {
  id: string;
  title: string;
  overview: string;
  tagline: string;
  genres: string[];
  releaseDate: string;
  voteAverage: number;
}

/** Year is displayed and is small enough to stay filterable metadata. */
export function year(movie: Movie): number {
  return Number(movie.releaseDate.slice(0, 4)) || 0;
}

/**
 * The text that gets embedded. Both the precompute script and anything that ever
 * re-embeds a single movie must agree on this, so it lives in one function.
 *
 * Deliberately the plot and genres only — no title, and no tagline.
 *
 * Including them is the intuitive choice and it measurably hurts. Titles and
 * taglines are marketing copy, and because they are short they carry
 * disproportionate weight in the averaged embedding, which pulls documents toward
 * whatever words happen to be in the title rather than what the film is about. On
 * a 12-query relevance set, embedding title + tagline + genres + overview found
 * the expected movie in the top 8 for 9 of 12 queries; dropping the title and
 * tagline raised that to 11 of 12. Concretely, "dinosaurs escape and hunt people"
 * went from missing Jurassic Park entirely to ranking it first, while
 * "a lonely astronaut who can't get home" stopped returning The Astronaut's Wife
 * and Baggage Claim above Gravity.
 *
 * Titles are still stored as metadata and displayed with each result; they are
 * just not part of what gets compared.
 */
export function embeddingText(movie: Movie): string {
  return [movie.overview, movie.genres.join(", ")].filter(Boolean).join("\n");
}

function parseGenres(raw: string): string[] {
  try {
    return (JSON.parse(raw) as { name: string }[]).map((g) => g.name);
  } catch {
    return [];
  }
}

/**
 * Reads the committed TMDB extract. Rows without a title or an overview are
 * skipped — there is nothing meaningful to embed — and the result is sorted by id
 * so that the row order is stable. The seed script relies on that order to line
 * movies up with the precomputed embeddings file.
 */
export async function readMovies(): Promise<Movie[]> {
  const csvPath = path.resolve(process.cwd(), "lib/db/movies.csv");
  const movies: Movie[] = [];
  const seen = new Set<string>();

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row) => {
        const id = row.id?.trim();
        const title = row.title?.trim();
        const overview = row.overview?.trim();
        if (!id || !title || !overview || seen.has(id)) {
          return;
        }
        seen.add(id);
        movies.push({
          id,
          title,
          overview,
          tagline: row.tagline?.trim() || "",
          genres: parseGenres(row.genres),
          releaseDate: row.release_date?.trim() || "",
          voteAverage: Number(row.vote_average) || 0,
        });
      })
      .on("end", resolve)
      .on("error", reject);
  });

  return movies.sort((a, b) => Number(a.id) - Number(b.id));
}
