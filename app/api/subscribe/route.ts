import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, brand, reference_number, max_price, must_have_papers, must_have_box } = body

  if (!email || !brand) {
    return Response.json({ error: 'E-mailadres en merk zijn verplicht' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error } = await supabase.from('subscribers').insert({
    email,
    brand,
    reference_number: reference_number || null,
    max_price: max_price || null,
    must_have_papers: must_have_papers ?? false,
    must_have_box: must_have_box ?? false,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
