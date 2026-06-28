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

  const terms = q ? q.split(/\s+/).filter(Boolean) : []
  const watches = (allWatches ?? []).filter(w => {
    if (terms.length === 0) return true
    const title = (w.title ?? '').toLowerCase()
    const ref = (w.reference_number ?? '').toLowerCase()
    return terms.every(t => title.includes(t) || ref.includes(t))
  })

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-stone-100 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-green-700 shrink-0" />
              <span className="font-semibold tracking-tight text-stone-900 text-[1.05rem]">WatchScout</span>
            </a>
            <span className="hidden sm:block text-xs text-stone-300 tracking-widest uppercase border-l border-stone-100 pl-3">
              Rolex dealfinder
            </span>
          </div>
          <p className="text-xs text-stone-400 tabular-nums">
            {allWatches?.length ?? 0} horloges gescand
          </p>
        </div>
      </header>

      <main>
        {/* Search */}
        <div className="border-b border-stone-100 bg-white py-5">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <form method="GET" action="">
              <div className="relative max-w-2xl">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 w-4 h-4 pointer-events-none"
                  fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  name="search"
                  defaultValue={search ?? ''}
                  placeholder="Zoek op model of referentienummer — bijv. Datejust, Submariner 126610LN"
                  className="w-full border border-stone-200 bg-white text-sm pl-11 pr-28 py-3 text-stone-900 placeholder-stone-300 focus:outline-none focus:border-green-800 focus:ring-1 focus:ring-green-800/10 transition-colors"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-0 bottom-0 px-5 bg-green-800 text-white text-sm font-medium hover:bg-green-900 transition-colors"
                >
                  Zoeken
                </button>
              </div>
              {q && (
                <div className="mt-2.5 flex items-center gap-3 max-w-2xl">
                  <span className="text-sm text-stone-600">
                    <span className="font-medium">{watches.length}</span> resultaten voor{' '}
                    <span className="font-medium">&ldquo;{search}&rdquo;</span>
                    <span className="text-stone-400"> van {allWatches?.length ?? 0} horloges</span>
                  </span>
                  <a
                    href="/"
                    className="text-xs text-stone-400 hover:text-green-800 underline underline-offset-2 transition-colors whitespace-nowrap"
                  >
                    Wis zoekopdracht
                  </a>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Prijsalert */}
        <AlertForm />

        {/* Watch grid with filters */}
        <WatchGrid watches={watches} />
      </main>
    </div>
  )
}
