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
      setOpen(false)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Er is een fout opgetreden')
    }
  }

  return (
    <div>
      {/* Thin strip */}
      <div className="bg-[#14532D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
          {status === 'success' ? (
            <span className="text-emerald-200 text-sm">✓ Alert ingesteld — je ontvangt een e-mail zodra er een deal is.</span>
          ) : (
            <>
              <span className="text-white/80 text-sm">
                Stel een prijsalert in{' '}
                <span className="hidden sm:inline text-white/40">
                  — ontvang een e-mail zodra een deal onder marktprijs verschijnt
                </span>
              </span>
              <button
                onClick={() => setOpen(v => !v)}
                className="shrink-0 text-sm text-white border border-white/30 px-4 py-1.5 hover:border-white/60 hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                {open ? 'Sluiten' : 'Alert instellen →'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded form — slides in below strip */}
      {open && status !== 'success' && (
        <div className="bg-[#0f3d20] border-b border-[#14532D]">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-white/50 uppercase tracking-widest font-medium">E-mail *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jouw@email.nl"
                  className="bg-white/10 border border-white/20 text-sm px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-white/50 w-52 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-white/50 uppercase tracking-widest font-medium">Merk *</label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="Rolex"
                  className="bg-white/10 border border-white/20 text-sm px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-white/50 w-32 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-white/50 uppercase tracking-widest font-medium">Referentie</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="126610LN"
                  className="bg-white/10 border border-white/20 text-sm px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-white/50 w-36 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-white/50 uppercase tracking-widest font-medium">Max. prijs</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm select-none">€</span>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)}
                    placeholder="15.000"
                    min="0"
                    className="bg-white/10 border border-white/20 text-sm pl-7 pr-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-white/50 w-32 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-6 py-2 font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {status === 'loading' ? 'Bezig...' : 'Alert instellen'}
              </button>

              {status === 'error' && (
                <p className="w-full text-xs text-red-300 -mt-2">{errorMsg}</p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
