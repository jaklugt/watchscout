import { createClient } from '@supabase/supabase-js'
import WatchGrid from './components/WatchGrid'
import AlertForm from './components/AlertForm'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const { search } = await searchParams
  const q = search?.trim().toLowerCase() ?? ''

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: allWatches } = await supabase
    .from('watches')
    .select('id,source,title,brand,reference_number,price,image_url,url,condition,year,has_box,has_papers,has_service_history,deal_score,market_avg_price,created_at')
    .order('created_at', { ascending: false })

  // Server-side search: filter before passing to client
  const terms = q ? q.split(/\s+/).filter(Boolean) : []
  const watches = (allWatches ?? []).filter(w => {
    if (terms.length === 0) return true
    const title = (w.title ?? '').toLowerCase()
    const ref = (w.reference_number ?? '').toLowerCase()
    return terms.every(t => title.includes(t) || ref.includes(t))
  })

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-tight text-stone-900">WatchScout</span>
            <span className="hidden sm:block text-xs text-stone-400 tracking-widest uppercase border-l border-stone-200 pl-3">
              Rolex dealfinder
            </span>
          </div>
          <p className="text-xs text-stone-400">
            {allWatches?.length ?? 0} horloges gescand
          </p>
        </div>
      </header>

      <main>
        <AlertForm />

        {/* Search — plain HTML form, no JS required */}
        <div className="border-b border-stone-200 bg-white py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <form method="GET" action="">
              <div className="relative">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4 pointer-events-none"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  name="search"
                  defaultValue={search ?? ''}
                  placeholder="Zoek op model of referentienummer — bijv. Datejust, 116610 of Submariner 126610LN"
                  className="w-full border border-stone-300 bg-stone-50 text-sm pl-11 pr-24 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-600 focus:bg-white transition-colors"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-0 bottom-0 px-4 bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors"
                >
                  Zoeken
                </button>
              </div>
              {q && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-stone-600">
                    Resultaten voor <strong>&quot;{search}&quot;</strong> — {watches.length} van {allWatches?.length ?? 0} horloges
                  </span>
                  <a href="/" className="text-sm text-stone-400 hover:text-stone-700 underline">
                    Wis zoekopdracht
                  </a>
                </div>
              )}
            </form>
          </div>
        </div>

        <WatchGrid watches={watches} />
      </main>
    </div>
  )
}
