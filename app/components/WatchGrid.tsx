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
  'pre-owned': 'Tweedehands',
}

type AccessoriesFilter = '' | 'none' | 'box' | 'papers' | 'full'
type SortKey = 'deal' | 'new' | 'asc' | 'desc'

function fmt(price: number) {
  return '€ ' + price.toLocaleString('nl-NL')
}

function ChevronIcon() {
  return (
    <svg className="w-3 h-3 text-stone-400 pointer-events-none shrink-0" fill="none"
      stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
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
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] text-stone-400 uppercase tracking-[0.18em] font-medium">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="appearance-none bg-white border border-stone-200 text-[13px] pl-3 pr-7 py-2 text-stone-700 focus:outline-none focus:border-stone-400 cursor-pointer min-w-[130px] transition-colors"
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
    <article className="bg-white flex flex-col group hover:shadow-xl transition-shadow duration-300">
      {/* Image */}
      <a href={w.url} target="_blank" rel="noopener noreferrer"
        className="block overflow-hidden aspect-square bg-[#F8F8F6] relative">
        {w.image_url ? (
          <img
            src={w.image_url}
            alt={w.title}
            className="w-full h-full object-contain p-7 group-hover:scale-[1.04] transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-200 text-5xl select-none">◯</div>
        )}
      </a>

      {/* Content */}
      <div className="px-5 pt-4 pb-5 flex flex-col flex-1">
        {/* Source */}
        <p className="text-[9px] text-stone-400 tracking-[0.18em] uppercase mb-2 font-medium">{w.source}</p>

        {/* Title */}
        <a
          href={w.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.875rem] font-medium text-stone-900 leading-snug hover:text-[#14532D] transition-colors line-clamp-2 mb-1"
        >
          {w.title}
        </a>

        {/* Reference */}
        {w.reference_number && (
          <p className="text-[11px] text-stone-400 font-mono mb-3">Ref. {w.reference_number}</p>
        )}

        {/* Badges */}
        {(conditionLabel || w.has_papers || w.has_box) && (
          <div className="flex gap-1 flex-wrap mb-3">
            {conditionLabel && (
              <span className="text-[9px] text-stone-400 border border-stone-200 px-1.5 py-0.5 tracking-wide">
                {conditionLabel}
              </span>
            )}
            {w.has_papers && (
              <span className="text-[9px] text-stone-400 border border-stone-200 px-1.5 py-0.5">Papieren</span>
            )}
            {w.has_box && (
              <span className="text-[9px] text-stone-400 border border-stone-200 px-1.5 py-0.5">Doos</span>
            )}
            {w.has_service_history && (
              <span className="text-[9px] text-stone-400 border border-stone-200 px-1.5 py-0.5">Service</span>
            )}
          </div>
        )}

        {/* Price block — pushed to bottom */}
        <div className="mt-auto pt-3 border-t border-stone-100">
          {w.price ? (
            <p className="text-lg font-semibold text-stone-900 tracking-tight leading-none">{fmt(w.price)}</p>
          ) : (
            <p className="text-sm text-stone-400 italic">Prijs op aanvraag</p>
          )}

          {savings ? (
            <p className="text-[11px] text-[#14532D] font-medium mt-1">
              ↓ {fmt(savings)} onder marktprijs
            </p>
          ) : w.market_avg_price ? (
            <p className="text-[11px] text-stone-400 mt-1">Marktgem. {fmt(w.market_avg_price)}</p>
          ) : null}

          {w.year && !savings && !w.market_avg_price && (
            <p className="text-[11px] text-stone-400 mt-1">{w.year}</p>
          )}

          <a
            href={w.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-[11px] text-stone-400 hover:text-[#14532D] transition-colors tracking-wide"
          >
            Bekijk →
          </a>
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

  const BRAND_ORDER = ['Rolex', 'Omega', 'Tudor', 'Patek Philippe', 'Audemars Piguet']
  const brands = [...new Set(watches.map(w => w.brand).filter(Boolean))].sort((a, b) => {
    const ia = BRAND_ORDER.indexOf(a), ib = BRAND_ORDER.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })
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

  const hasActiveFilters = !!(brand || condition || accessories || minPrice || maxPrice || yearFrom || yearTo)

  return (
    <div>
      {/* Filter bar */}
      <div className="bg-[#F8F8F6] border-b border-stone-200 sticky top-14 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
          <div className="flex flex-wrap gap-3 items-end">
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
              <option value="full">Volledige set</option>
            </FilterSelect>

            {hasYearData && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-stone-400 uppercase tracking-[0.18em] font-medium">Bouwjaar</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Van"
                    value={yearFrom}
                    onChange={e => { setYearFrom(e.target.value); resetPage() }}
                    className="bg-white border border-stone-200 text-[13px] px-3 py-2 w-20 text-stone-700 focus:outline-none focus:border-stone-400 transition-colors"
                  />
                  <span className="text-stone-300 text-xs">–</span>
                  <input
                    type="number"
                    placeholder="Tot"
                    value={yearTo}
                    onChange={e => { setYearTo(e.target.value); resetPage() }}
                    className="bg-white border border-stone-200 text-[13px] px-3 py-2 w-20 text-stone-700 focus:outline-none focus:border-stone-400 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] text-stone-400 uppercase tracking-[0.18em] font-medium">Prijs</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="Min €"
                  value={minPrice}
                  onChange={e => { setMinPrice(e.target.value); resetPage() }}
                  className="bg-white border border-stone-200 text-[13px] px-3 py-2 w-24 text-stone-700 focus:outline-none focus:border-stone-400 transition-colors"
                />
                <span className="text-stone-300 text-xs">–</span>
                <input
                  type="number"
                  placeholder="Max €"
                  value={maxPrice}
                  onChange={e => { setMaxPrice(e.target.value); resetPage() }}
                  className="bg-white border border-stone-200 text-[13px] px-3 py-2 w-24 text-stone-700 focus:outline-none focus:border-stone-400 transition-colors"
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

          {/* Results row */}
          <div className="mt-3 flex items-center gap-4">
            <p className="text-[12px] text-stone-500">
              <span className="font-medium text-stone-800">{filtered.length}</span> horloges
              {dealsCount > 0 && (
                <> · <span className="text-[#14532D] font-medium">{dealsCount} onder marktprijs</span></>
              )}
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setBrand(''); setCondition(''); setAccessories(''); setMinPrice('')
                  setMaxPrice(''); setYearFrom(''); setYearTo(''); resetPage()
                }}
                className="text-[11px] text-stone-400 hover:text-stone-700 underline underline-offset-2 transition-colors"
              >
                Filters wissen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Watch grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 pb-16">
        {filtered.length === 0 ? (
          <div className="text-center py-32 text-stone-400">
            <p className="font-serif text-xl mb-2">Geen horloges gevonden</p>
            <p className="text-sm">Pas de filters aan om meer resultaten te zien</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {pageItems.map(w => <WatchCard key={w.id} w={w} />)}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="border-t border-stone-200 bg-[#F8F8F6]">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goTo(safePage - 1)}
                disabled={safePage <= 1}
                className="bg-white border border-stone-200 text-[13px] px-4 py-2 text-stone-600 hover:border-stone-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Vorige
              </button>
              <span className="text-[13px] text-stone-500 px-3 whitespace-nowrap">
                <span className="font-medium text-stone-900">{safePage}</span>
                <span className="text-stone-300"> / </span>
                <span className="font-medium text-stone-900">{totalPages}</span>
              </span>
              <button
                onClick={() => goTo(safePage + 1)}
                disabled={safePage >= totalPages}
                className="bg-white border border-stone-200 text-[13px] px-4 py-2 text-stone-600 hover:border-stone-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
              <label className="text-[11px] text-stone-400 whitespace-nowrap">Ga naar</label>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpInput}
                onChange={e => setJumpInput(e.target.value)}
                placeholder={String(safePage)}
                className="bg-white border border-stone-200 text-[13px] px-2 py-2 w-16 text-stone-700 focus:outline-none focus:border-stone-400 text-center transition-colors"
              />
              <button
                type="submit"
                className="bg-white border border-stone-200 text-[13px] px-3 py-2 text-stone-600 hover:border-stone-400 transition-colors"
              >
                Ga
              </button>
            </form>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[11px] text-stone-400 whitespace-nowrap">Per pagina</span>
              {[30, 50, 100].map(n => (
                <button
                  key={n}
                  onClick={() => { setPerPage(n); resetPage() }}
                  className={`text-[13px] px-3 py-2 border transition-colors ${
                    perPage === n
                      ? 'bg-[#0A1628] text-white border-[#0A1628]'
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
