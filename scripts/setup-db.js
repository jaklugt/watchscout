import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, '../supabase/migrations/001_create_watches.sql'), 'utf8')

const { error } = await supabase.rpc('exec_sql', { query: sql }).catch(() => ({ error: 'rpc not available' }))

if (error) {
  console.log('Could not run via RPC. Run this SQL in the Supabase dashboard SQL editor:')
  console.log()
  console.log(sql)
} else {
  console.log('watches table created successfully.')
}
