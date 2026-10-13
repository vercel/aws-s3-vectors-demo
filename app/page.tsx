import Explanation from "@/components/explanation";
import Loading from "@/components/loading";
import { Results } from "@/components/results";
import { SearchControls } from "@/components/search-controls";
import { search } from "@/lib/db/search";
import { Suspense } from "react";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const { q = "" } = await searchParams;

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <Explanation />
      <div className="space-y-4">
        <SearchControls query={q} />
        {/* Keyed so a new query re-suspends and shows the skeleton again,
            instead of holding the previous results on screen. */}
        <Suspense key={q} fallback={<Loading />}>
          <SearchResults query={q} />
        </Suspense>
      </div>
    </div>
  );
}

async function SearchResults({ query }: { query: string }) {
  const results = await search(query);
  return <Results query={query} {...results} />;
}
