/** Skeleton du journal : feedback immédiat pendant la navigation entre jours. */
export default function JournalLoading() {
  return (
    <div className="forge-bg h-full overflow-y-auto overscroll-contain">
      <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-2 py-1.5">
          <div className="size-11" />
          <div className="h-6 w-44 animate-pulse rounded-lg bg-zinc-800/80" />
          <div className="size-11" />
        </div>
      </header>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-[86px] animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50"
            />
          ))}
        </div>
        <div className="h-12 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
        <div className="h-32 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50" />
        <div className="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50" />
      </div>
    </div>
  );
}
