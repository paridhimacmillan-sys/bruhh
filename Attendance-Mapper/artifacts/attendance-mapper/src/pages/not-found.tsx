import { Link } from "wouter";

export default function NotFound() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-zinc-50"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <div className="border-2 border-zinc-900 w-full max-w-sm mx-4 bg-white">
        {/* Header bar */}
        <div className="bg-zinc-900 px-5 py-3 flex items-center gap-3">
          <div className="flex gap-1">
            <div className="h-2.5 w-2.5 bg-red-500" />
            <div className="h-2.5 w-2.5 bg-amber-400" />
            <div className="h-2.5 w-2.5 bg-green-500" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-400 uppercase">Error</span>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          <div className="text-[10px] font-bold tracking-[0.3em] text-zinc-400 uppercase mb-2">Status Code</div>
          <div className="text-7xl font-bold text-zinc-900 tabular-nums leading-none mb-4">404</div>
          <div className="border-t-2 border-zinc-900 pt-4 mb-6">
            <div className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Page Not Found</div>
            <div className="text-xs text-zinc-500 mt-1">The requested route does not exist in the router.</div>
          </div>

          <Link href="/">
            <button className="w-full bg-zinc-900 text-white text-xs font-bold tracking-wider uppercase py-2.5 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
              ← Return to Dashboard
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
