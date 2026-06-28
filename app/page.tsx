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

  const totalWatches = allWatches?.length ?? 0
  const totalSources = new Set((allWatches ?? []).map(w => w.source)).size
  const dealsTotal = (allWatches ?? []).filter(w => (w.deal_score ?? 0) > 0).length

  return (
    <div className="min-h-screen">
      {/* Header — dark navy, sticky */}
      <header className="bg-[#0A1628] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-4">
            <span className="font-serif text-white text-xl tracking-tight">WatchScout</span>
            <span className="hidden sm:block text-[10px] text-white/40 tracking-[0.2em] uppercase border-l border-white/10 pl-4">
              Horloge Dealfinder
            </span>
          </a>
          <span className="text-[11px] text-white/40 tabular-nums">
            {totalWatches} horloges
          </span>
        </div>
      </header>

      {/* Hero — dark navy with full-bleed watch photo */}
      <section
        className="relative pb-10 pt-8 bg-[#0A1628]"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=1920&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#0A1628]/70 pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8">
          <h1 className="font-serif text-white text-2xl sm:text-3xl lg:text-4xl font-medium leading-tight mb-2">
            Vind de beste horloge deal<br className="hidden sm:block" /> in Nederland
          </h1>
          <p className="text-white/50 text-sm mb-8 tracking-wide">
            {totalWatches} horloges gescand bij {totalSources} dealers
            {dealsTotal > 0 && (
              <> · <span className="text-emerald-400">{dealsTotal} onder marktprijs</span></>
            )}
          </p>

          {/* Search bar */}
          <form method="GET" action="">
            <div className="relative max-w-2xl">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 pointer-events-none"
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
                className="w-full bg-white/10 border border-white/15 text-sm pl-11 pr-28 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-white/40 focus:bg-white/15 transition-colors"
                autoComplete="off"
              />
              <button
                type="submit"
                className="absolute right-0 top-0 bottom-0 px-5 bg-[#14532D] text-white text-sm font-medium hover:bg-[#166534] transition-colors"
              >
                Zoeken
              </button>
            </div>
            {q && (
              <div className="mt-3 flex items-center gap-3 max-w-2xl">
                <span className="text-sm text-white/60">
                  <span className="text-white font-medium">{watches.length}</span> resultaten voor{' '}
                  <span className="text-white">&ldquo;{search}&rdquo;</span>
                </span>
                <a href="/" className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors">
                  Wis zoekopdracht
                </a>
              </div>
            )}
          </form>
        </div>
      </section>

      <main>
        {/* Prijsalert strip */}
        <AlertForm />

        {/* Watch grid with filters */}
        <WatchGrid watches={watches} />
      </main>
    </div>
  )
}
