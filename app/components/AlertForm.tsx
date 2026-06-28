'use client'

import { useState } from 'react'

export default function AlertForm() {
  const [email, setEmail] = useState('')
  const [brand, setBrand] = useState('Rolex')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [mustHavePapers, setMustHavePapers] = useState(false)
  const [mustHaveBox, setMustHaveBox] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          brand,
          reference_number: referenceNumber || null,
          max_price: maxPrice ? Number(maxPrice) : null,
          must_have_papers: mustHavePapers,
          must_have_box: mustHaveBox,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Er is een fout opgetreden')
      }
      setStatus('success')
      setEmail('')
      setReferenceNumber('')
      setMaxPrice('')
      setMustHavePapers(false)
      setMustHaveBox(false)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Er is een fout opgetreden')
    }
  }

  return (
    <section className="bg-stone-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="shrink-0">
            <p className="font-semibold text-sm tracking-wide">Prijsalert instellen</p>
            <p className="text-xs text-stone-400 mt-0.5">Ontvang een e-mail zodra een deal onder marktprijs verschijnt</p>
          </div>

          {status === 'success' ? (
            <div className="sm:ml-6 text-sm text-emerald-400 font-medium">
              ✓ Alert ingesteld — we sturen je een bericht zodra er een deal is.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="sm:ml-6 flex flex-wrap gap-2 items-end flex-1">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-400">E-mail *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jouw@email.nl"
                  className="bg-stone-800 border border-stone-700 text-sm px-3 py-1.5 text-white placeholder-stone-500 focus:outline-none focus:border-stone-400 w-44"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-400">Merk *</label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="Rolex"
                  className="bg-stone-800 border border-stone-700 text-sm px-3 py-1.5 text-white placeholder-stone-500 focus:outline-none focus:border-stone-400 w-28"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-400">Referentie</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="126610LN"
                  className="bg-stone-800 border border-stone-700 text-sm px-3 py-1.5 text-white placeholder-stone-500 focus:outline-none focus:border-stone-400 w-28"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-400">Max prijs</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500 text-sm">€</span>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)}
                    placeholder="15000"
                    min="0"
                    className="bg-stone-800 border border-stone-700 text-sm pl-6 pr-3 py-1.5 text-white placeholder-stone-500 focus:outline-none focus:border-stone-400 w-28"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pb-1.5">
                <input
                  type="checkbox"
                  checked={mustHavePapers}
                  onChange={e => setMustHavePapers(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-500"
                />
                <span className="text-xs text-stone-300 whitespace-nowrap">Alleen met papieren</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer pb-1.5">
                <input
                  type="checkbox"
                  checked={mustHaveBox}
                  onChange={e => setMustHaveBox(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-500"
                />
                <span className="text-xs text-stone-300 whitespace-nowrap">Alleen met doos</span>
              </label>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-5 py-1.5 font-medium transition-colors disabled:opacity-50 whitespace-nowrap pb-1.5"
              >
                {status === 'loading' ? 'Bezig...' : 'Instellen'}
              </button>

              {status === 'error' && (
                <p className="w-full text-xs text-red-400 -mt-1">{errorMsg}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
