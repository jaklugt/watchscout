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
  new: 'Ongedragen',
  'like new': 'Zeer goed',
  'very good': 'Zeer goed',
  good: 'Goed',
  fair: 'Gebruikt',
  used: 'Gebruikt',
  vintage: 'Gebruikt',
}

type AccessoriesFilter = '' | 'none' | 'box' | 'papers' | 'full'
type SortKey = 'deal' | 'new' | 'asc' | 'desc'

function fmt(price: number) {
  return '€ ' + price.toLocaleString('nl-NL')
}

function ChevronIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-stone-400 pointer-events-none shrink-0" fill="none"
      stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function FilterSelect({
  value, onChange, label, children,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="appearance-none border border-stone-200 bg-white text-sm pl-3 pr-8 py-2 text-stone-800 focus:outline-none focus:border-green-800 focus:ring-1 focus:ring-green-800/10 cursor-pointer min-w-[140px] transition-colors"
        >
          {children}
        </select>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          <ChevronIcon />
        </div>
      </div>
    </div>
  )
}

function WatchCard({ w }: { w: Watch }) {
  const conditionLabel = w.condition ? (CONDITION_NL[w.condition] ?? w.condition) : null
  const savings =
    w.market_avg_price && w.price && w.market_avg_price > w.price
      ? w.market_avg_price - w.price
      : null

  return (
    <article className="bg-white border border-stone-100 flex flex-col group hover:border-stone-300 hover:shadow-lg transition-all duration-200">
      <a href={w.url} target="_blank" rel="noopener noreferrer"
        className="block overflow-hidden aspect-square bg-stone-50 relative">
        {w.image_url ? (
          <img
            src={w.image_url}
            alt={w.title}
            className="w-full h-full object-contain p-6 group-hover:scale-[1.04] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-200 text-5xl select-none">◯</div>
        )}
      </a>

      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <p className="text-[9px] text-stone-400 tracking-[0.15em] uppercase mb-1.5 font-medium">{w.source}</p>
          <a
            href={w.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-stone-900 leading-snug hover:text-green-800 transition-colors line-clamp-2 text-[0.875rem]"
          >
            {w.title}
          </a>
          {w.reference_number && (
            <p className="text-[11px] text-stone-400 mt-1 font-mono">Ref. {w.reference_number}</p>
          )}
        </div>

        {(conditionLabel || w.has_papers || w.has_box || w.has_service_history) && (
          <div className="flex gap-1.5 flex-wrap">
            {conditionLabel && (
              <span className="text-[10px] border border-stone-200 text-stone-500 px-2 py-0.5 tracking-wide">
                {conditionLabel}
              </span>
            )}
            {w.has_papers && (
              <span className="text-[10px] border border-stone-200 text-stone-500 px-2 py-0.5">Papieren</span>
            )}
            {w.has_box && (
              <span className="text-[10px] border border-stone-200 text-stone-500 px-2 py-0.5">Doos</span>
            )}
            {w.has_service_history && (
              <span className="text-[10px] border border-stone-200 text-stone-500 px-2 py-0.5">Service</span>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-stone-100">
          {w.price ? (
            <p className="text-xl font-semibold text-stone-900 tracking-tight">{fmt(w.price)}</p>
          ) : (
            <p className="text-sm text-stone-400 italic">Prijs op aanvraag</p>
          )}
          {savings ? (
            <p className="text-[11px] text-green-700 font-semibold mt-0.5">
              ↓ {fmt(savings)} onder marktprijs
            </p>
          ) : w.market_avg_price ? (
            <p className="text-[11px] text-stone-400 mt-0.5">Marktgemiddelde: {fmt(w.market_avg_price)}</p>
          ) : null}
          {w.year && <p className="text-[11px] text-stone-400 mt-1">{w.year}</p>}
        </div>
      </div>
    </article>
  )
}

export default function WatchGrid({ watches }: { watches: Watch[] }) {
  const [brand, setBrand] = useState('')
  const [condition, setCondition] = useState('')
  const [accessories, setAccessories] = useState<AccessoriesFilter>('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [sort, setSort] = useState<SortKey>('deal')
  const [perPage, setPerPage] = useState(30)
  const [page, setPage] = useState(1)
  const [jumpInput, setJumpInput] = useState('')

  const hasYearData = watches.some(w => w.year !== null)

  const brands = [...new Set(watches.map(w => w.brand).filter(Boolean))].sort()
  const conditionGroups = [...new Set(
    watches
      .map(w => w.condition ? (CONDITION_NL[w.condition] ?? w.condition) : null)
      .filter((c): c is string => c !== null)
  )].sort()

  let filtered = watches.filter(w => {
    if (brand && w.brand !== brand) return false

    if (condition) {
      const label = w.condition ? (CONDITION_NL[w.condition] ?? w.condition) : null
      if (label !== condition) return false
    }

    if (accessories === 'none' && (w.has_box === true || w.has_papers === true)) return false
    if (accessories === 'box' && w.has_box !== true) return false
    if (accessories === 'papers' && w.has_papers !== true) return false
    if (accessories === 'full' && (w.has_box !== true || w.has_papers !== true)) return false

    if (minPrice && (w.price ?? 0) < Number(minPrice)) return false
    if (maxPrice && (w.price ?? Infinity) > Number(maxPrice)) return false

    if (yearFrom && w.year !== null && w.year < Number(yearFrom)) return false
    if (yearTo && w.year !== null && w.year > Number(yearTo)) return false

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

  function goTo(p: number) {
    setPage(Math.max(1, Math.min(p, totalPages)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetPage() { setPage(1) }

  const hasActiveFilters = brand || condition || accessories || minPrice || maxPrice || yearFrom || yearTo

  return (
    <div>
      {/* Filter bar */}
      <div className="border-b border-stone-100 bg-white py-4 sticky top-14 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-wrap gap-4 items-end">
            <FilterSelect value={brand} onChange={v => { setBrand(v); resetPage() }} label="Merk">
              <option value="">Alle merken</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </FilterSelect>

            <FilterSelect value={condition} onChange={v => { setCondition(v); resetPage() }} label="Conditie">
              <option value="">Alle condities</option>
              {conditionGroups.map(c => <option key={c} value={c}>{c}</option>)}
            </FilterSelect>

            <FilterSelect value={accessories} onChange={v => { setAccessories(v as AccessoriesFilter); resetPage() }} label="Accessoires">
              <option value="">Alle</option>
              <option value="none">Alleen horloge</option>
              <option value="box">Met doos</option>
              <option value="papers">Met papieren</option>
              <option value="full">Volledige set (doos + papieren)</option>
            </FilterSelect>

            {hasYearData && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Bouwjaar</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Van"
                    value={yearFrom}
                    onChange={e => { setYearFrom(e.target.value); resetPage() }}
                    className="border border-stone-200 bg-white text-sm px-3 py-2 w-20 text-stone-800 focus:outline-none focus:border-green-800 focus:ring-1 focus:ring-green-800/10 transition-colors"
                  />
                  <span className="text-stone-300 text-sm">–</span>
                  <input
                    type="number"
                    placeholder="Tot"
                    value={yearTo}
                    onChange={e => { setYearTo(e.target.value); resetPage() }}
                    className="border border-stone-200 bg-white text-sm px-3 py-2 w-20 text-stone-800 focus:outline-none focus:border-green-800 focus:ring-1 focus:ring-green-800/10 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Prijs</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min €"
                  value={minPrice}
                  onChange={e => { setMinPrice(e.target.value); resetPage() }}
                  className="border border-stone-200 bg-white text-sm px-3 py-2 w-24 text-stone-800 focus:outline-none focus:border-green-800 focus:ring-1 focus:ring-green-800/10 transition-colors"
                />
                <span className="text-stone-300 text-sm">–</span>
                <input
                  type="number"
                  placeholder="Max €"
                  value={maxPrice}
                  onChange={e => { setMaxPrice(e.target.value); resetPage() }}
                  className="border border-stone-200 bg-white text-sm px-3 py-2 w-24 text-stone-800 focus:outline-none focus:border-green-800 focus:ring-1 focus:ring-green-800/10 transition-colors"
                />
              </div>
            </div>

            <div className="ml-auto">
              <FilterSelect value={sort} onChange={v => { setSort(v as SortKey); resetPage() }} label="Sorteren">
                <option value="deal">Beste deal eerst</option>
                <option value="new">Nieuwste eerst</option>
                <option value="asc">Prijs: laag → hoog</option>
                <option value="desc">Prijs: hoog → laag</option>
              </FilterSelect>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setBrand(''); setCondition(''); setAccessories(''); setMinPrice('')
                setMaxPrice(''); setYearFrom(''); setYearTo(''); resetPage()
              }}
              className="mt-3 text-xs text-stone-400 hover:text-green-800 transition-colors underline"
            >
              Filters wissen
            </button>
          )}
        </div>
      </div>

      {/* Results summary */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
        <p className="text-sm text-stone-500">
          <span className="font-semibold text-stone-900">{filtered.length}</span> horloges gevonden
          {dealsCount > 0 && (
            <> ·{' '}
              <span className="text-green-700 font-semibold">{dealsCount} onder marktprijs</span>
            </>
          )}
        </p>
      </div>

      {/* Watch grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-12">
        {filtered.length === 0 ? (
          <div className="text-center py-28 text-stone-400">
            <p className="text-base">Geen horloges gevonden</p>
            <p className="text-sm mt-1">Pas de filters aan om meer resultaten te zien</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {pageItems.map(w => <WatchCard key={w.id} w={w} />)}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="border-t border-stone-100 bg-stone-50/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goTo(safePage - 1)}
                disabled={safePage <= 1}
                className="border border-stone-200 bg-white text-sm px-4 py-2 text-stone-600 hover:border-stone-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Vorige
              </button>
              <span className="text-sm text-stone-500 px-3 whitespace-nowrap">
                Pagina{' '}
                <span className="font-semibold text-stone-900">{safePage}</span>
                {' '}van{' '}
                <span className="font-semibold text-stone-900">{totalPages}</span>
              </span>
              <button
                onClick={() => goTo(safePage + 1)}
                disabled={safePage >= totalPages}
                className="border border-stone-200 bg-white text-sm px-4 py-2 text-stone-600 hover:border-stone-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Volgende →
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault()
                const n = parseInt(jumpInput)
                if (!isNaN(n)) goTo(n)
                setJumpInput('')
              }}
              className="flex items-center gap-2"
            >
              <label className="text-xs text-stone-400 whitespace-nowrap">Ga naar</label>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpInput}
                onChange={e => setJumpInput(e.target.value)}
                placeholder={String(safePage)}
                className="border border-stone-200 bg-white text-sm px-2 py-2 w-16 text-stone-800 focus:outline-none focus:border-green-800 text-center transition-colors"
              />
              <button
                type="submit"
                className="border border-stone-200 bg-white text-sm px-3 py-2 text-stone-600 hover:border-stone-400 transition-colors"
              >
                Ga
              </button>
            </form>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-stone-400 whitespace-nowrap">Per pagina</span>
              {[30, 50, 100].map(n => (
                <button
                  key={n}
                  onClick={() => { setPerPage(n); resetPage() }}
                  className={`text-sm px-3 py-2 border transition-colors ${
                    perPage === n
                      ? 'bg-green-800 text-white border-green-800'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                  }`}
                >
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
