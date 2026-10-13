import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <ul className="space-y-2">
      {[...Array(5)].map((_, index) => (
        <li
          key={index}
          className="p-3 bg-gray-100 dark:bg-gray-900 rounded space-y-2"
        >
          <Skeleton className="h-4 w-1/3 dark:bg-gray-700" />
          <Skeleton className="h-3 w-full dark:bg-gray-700" />
          <Skeleton className="h-3 w-4/5 dark:bg-gray-700" />
        </li>
      ))}
    </ul>
  );
}
