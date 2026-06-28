'use client'

import { useState } from 'react'

interface Watch {
  id: number
  source: string
  title: string
  brand: string
  reference_number: string | null
  price: number | null
  image_url: string | null
  url: string
  condition: string | null
  year: number | null
  has_box: boolean | null
  has_papers: boolean | null
  has_service_history: boolean | null
  deal_score: number | null
  market_avg_price: number | null
  created_at: string
}

const CONDITION_NL: Record<string, string> = {
  unworn: 'Ongedragen',
  'very good': 'Zeer goed',
  good: 'Goed',
  fair: 'Redelijk',
}

function fmt(price: number) {
  return '€ ' + price.toLocaleString('nl-NL')
}

function WatchCard({ w }: { w: Watch }) {
  const savings =
    w.market_avg_price && w.price && w.market_avg_price > w.price
      ? w.market_avg_price - w.price
      : null

  return (
    <article className="bg-white border border-stone-200 flex flex-col group hover:border-stone-400 transition-colors">
      <a href={w.url} target="_blank" rel="noopener noreferrer"
        className="block overflow-hidden aspect-square bg-stone-50 relative">
        {w.image_url ? (
          <img src={w.image_url} alt={w.title}
            className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 text-4xl">◯</div>
        )}
        {savings && (
          <div className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-medium px-2 py-1">
            Onder marktprijs: {fmt(savings)}
          </div>
        )}
      </a>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-xs text-stone-400 tracking-widest uppercase mb-1">{w.source}</p>
          <a href={w.url} target="_blank" rel="noopener noreferrer"
            className="font-medium text-stone-900 leading-snug hover:underline line-clamp-2">
            {w.title}
          </a>
          {w.reference_number && (
            <p className="text-xs text-stone-500 mt-0.5">Ref. {w.reference_number}</p>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {w.condition && (
            <span className="text-xs border border-stone-300 text-stone-600 px-2 py-0.5">
              {CONDITION_NL[w.condition] ?? w.condition}
            </span>
          )}
          {w.has_box && <span className="text-xs bg-stone-900 text-white px-2 py-0.5">Doos ✓</span>}
          {w.has_papers && <span className="text-xs bg-stone-900 text-white px-2 py-0.5">Papieren ✓</span>}
          {w.has_service_history && <span className="text-xs bg-stone-900 text-white px-2 py-0.5">Service ✓</span>}
        </div>

        <div className="mt-auto pt-2 border-t border-stone-100">
          <div className="flex items-end justify-between">
            <div>
              {w.price ? (
                <p className="text-lg font-semibold text-stone-900">{fmt(w.price)}</p>
              ) : (
                <p className="text-sm text-stone-400">Prijs op aanvraag</p>
              )}
              {w.market_avg_price && (
                <p className="text-xs text-stone-400">Marktgemiddelde: {fmt(w.market_avg_price)}</p>
              )}
            </div>
            {w.year && <p className="text-xs text-stone-400">{w.year}</p>}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function WatchGrid({ watches }: { watches: Watch[] }) {
  const [brand, setBrand] = useState('')
  const [condition, setCondition] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState<'deal' | 'new' | 'asc' | 'desc'>('deal')
  const [perPage, setPerPage] = useState(30)
  const [page, setPage] = useState(1)
  const [jumpInput, setJumpInput] = useState('')

  let filtered = watches.filter(w => {
    if (brand && w.brand !== brand) return false
    if (condition && w.condition !== condition) return false
    if (minPrice && (w.price ?? 0) < Number(minPrice)) return false
    if (maxPrice && (w.price ?? Infinity) > Number(maxPrice)) return false
    return true
  })

  filtered = [...filtered].sort((a, b) => {
    if (sort === 'deal') return (b.deal_score ?? -Infinity) - (a.deal_score ?? -Infinity)
    if (sort === 'new')  return b.created_at.localeCompare(a.created_at)
    if (sort === 'asc')  return (a.price ?? Infinity) - (b.price ?? Infinity)
    if (sort === 'desc') return (b.price ?? 0) - (a.price ?? 0)
    return 0
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const dealsCount = filtered.filter(w => w.deal_score && w.deal_score > 0).length

  const brands = [...new Set(watches.map(w => w.brand).filter(Boolean))].sort()
  const conditions = [...new Set(watches.map(w => w.condition).filter((c): c is string => c !== null))].sort()

  function goTo(p: number) {
    setPage(Math.max(1, Math.min(p, totalPages)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetPage() { setPage(1) }

  return (
    <div>
      {/* Filters */}
      <div className="border-b border-stone-200 bg-stone-50 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-wrap gap-3 items-center">
          <select value={brand} onChange={e => { setBrand(e.target.value); resetPage() }}
            className="border border-stone-300 bg-white text-sm px-3 py-1.5 text-stone-700 focus:outline-none focus:border-stone-500">
            <option value="">Alle merken</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select value={condition} onChange={e => { setCondition(e.target.value); resetPage() }}
            className="border border-stone-300 bg-white text-sm px-3 py-1.5 text-stone-700 focus:outline-none focus:border-stone-500">
            <option value="">Alle condities</option>
            {conditions.map(c => <option key={c} value={c}>{CONDITION_NL[c] ?? c}</option>)}
          </select>

          <div className="flex items-center gap-1.5">
            <input type="number" placeholder="Min €" value={minPrice}
              onChange={e => { setMinPrice(e.target.value); resetPage() }}
              className="border border-stone-300 bg-white text-sm px-3 py-1.5 w-24 text-stone-700 focus:outline-none focus:border-stone-500" />
            <span className="text-stone-400 text-sm">–</span>
            <input type="number" placeholder="Max €" value={maxPrice}
              onChange={e => { setMaxPrice(e.target.value); resetPage() }}
              className="border border-stone-300 bg-white text-sm px-3 py-1.5 w-24 text-stone-700 focus:outline-none focus:border-stone-500" />
          </div>

          <select value={sort} onChange={e => { setSort(e.target.value as typeof sort); resetPage() }}
            className="border border-stone-300 bg-white text-sm px-3 py-1.5 text-stone-700 focus:outline-none focus:border-stone-500 ml-auto">
            <option value="deal">Beste deal</option>
            <option value="new">Nieuwste</option>
            <option value="asc">Prijs: laag–hoog</option>
            <option value="desc">Prijs: hoog–laag</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3">
        <p className="text-sm text-stone-500">
          <span className="font-medium text-stone-900">{filtered.length}</span> horloges
          {dealsCount > 0 && (
            <> · <span className="text-emerald-600 font-medium">{dealsCount} onder marktprijs</span></>
          )}
        </p>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-8">
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-stone-400">Geen horloges gevonden</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-px bg-stone-200">
            {pageItems.map(w => <WatchCard key={w.id} w={w} />)}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="border-t border-stone-200 bg-stone-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <button onClick={() => goTo(safePage - 1)} disabled={safePage <= 1}
                className="border border-stone-300 bg-white text-sm px-3 py-1.5 text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                ← Vorige
              </button>
              <span className="text-sm text-stone-600 px-2 whitespace-nowrap">
                Pagina <span className="font-medium text-stone-900">{safePage}</span> van{' '}
                <span className="font-medium text-stone-900">{totalPages}</span>
              </span>
              <button onClick={() => goTo(safePage + 1)} disabled={safePage >= totalPages}
                className="border border-stone-300 bg-white text-sm px-3 py-1.5 text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Volgende →
              </button>
            </div>

            <form onSubmit={e => { e.preventDefault(); const n = parseInt(jumpInput); if (!isNaN(n)) goTo(n); setJumpInput('') }}
              className="flex items-center gap-2">
              <label className="text-xs text-stone-500 whitespace-nowrap">Ga naar pagina</label>
              <input type="number" min={1} max={totalPages} value={jumpInput}
                onChange={e => setJumpInput(e.target.value)}
                placeholder={String(safePage)}
                className="border border-stone-300 bg-white text-sm px-2 py-1.5 w-16 text-stone-700 focus:outline-none focus:border-stone-500 text-center" />
              <button type="submit"
                className="border border-stone-300 bg-white text-sm px-3 py-1.5 text-stone-700 hover:bg-stone-100 transition-colors">
                Ga
              </button>
            </form>

            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-stone-500 whitespace-nowrap">Per pagina</label>
              {[30, 50, 100].map(n => (
                <button key={n} onClick={() => { setPerPage(n); resetPage() }}
                  className={`text-sm px-3 py-1.5 border transition-colors ${perPage === n
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
