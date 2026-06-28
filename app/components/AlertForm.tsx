'use client'

import { useState } from 'react'

export default function AlertForm() {
  const [email, setEmail] = useState('')
  const [brand, setBrand] = useState('Rolex')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [open, setOpen] = useState(false)

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
          must_have_papers: false,
          must_have_box: false,
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
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Er is een fout opgetreden')
    }
  }

  return (
    <section className="bg-stone-50 border-b border-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        {/* Collapsed trigger */}
        {!open && status !== 'success' && (
          <div className="py-4 flex items-center justify-between">
            <div>
              <span className="text-sm text-stone-700 font-medium">Prijsalert instellen</span>
              <span className="hidden sm:inline text-sm text-stone-400 ml-2">
                — ontvang een e-mail zodra een deal onder marktprijs verschijnt
              </span>
            </div>
            <button
              onClick={() => setOpen(true)}
              className="text-sm bg-green-800 text-white px-4 py-1.5 font-medium hover:bg-green-900 transition-colors shrink-0"
            >
              Alert instellen
            </button>
          </div>
        )}

        {/* Success state */}
        {status === 'success' && (
          <div className="py-4 flex items-center gap-3">
            <span className="text-green-700 text-sm font-medium">✓ Alert ingesteld</span>
            <span className="text-stone-400 text-sm">We sturen je een bericht zodra er een deal is.</span>
          </div>
        )}

        {/* Expanded form */}
        {open && status !== 'success' && (
          <div className="py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-stone-900">Prijsalert instellen</p>
                <p className="text-xs text-stone-400 mt-0.5">Ontvang een e-mail zodra een deal onder marktprijs verschijnt</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm transition-colors"
              >
                Sluiten
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-stone-500 font-medium">E-mail *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jouw@email.nl"
                  className="border border-stone-200 bg-white text-sm px-3 py-2 text-stone-900 placeholder-stone-300 focus:outline-none focus:border-green-800 focus:ring-1 focus:ring-green-800/20 w-48 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-stone-500 font-medium">Merk *</label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="Rolex"
                  className="border border-stone-200 bg-white text-sm px-3 py-2 text-stone-900 placeholder-stone-300 focus:outline-none focus:border-green-800 focus:ring-1 focus:ring-green-800/20 w-32 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-stone-500 font-medium">Referentienummer</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="126610LN"
                  className="border border-stone-200 bg-white text-sm px-3 py-2 text-stone-900 placeholder-stone-300 focus:outline-none focus:border-green-800 focus:ring-1 focus:ring-green-800/20 w-36 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-stone-500 font-medium">Max. prijs</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm select-none">€</span>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)}
                    placeholder="15.000"
                    min="0"
                    className="border border-stone-200 bg-white text-sm pl-7 pr-3 py-2 text-stone-900 placeholder-stone-300 focus:outline-none focus:border-green-800 focus:ring-1 focus:ring-green-800/20 w-32 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="bg-green-800 hover:bg-green-900 text-white text-sm px-6 py-2 font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {status === 'loading' ? 'Bezig...' : 'Alert instellen'}
              </button>

              {status === 'error' && (
                <p className="w-full text-xs text-red-500 -mt-1">{errorMsg}</p>
              )}
            </form>
          </div>
        )}
      </div>
    </section>
  )
}
