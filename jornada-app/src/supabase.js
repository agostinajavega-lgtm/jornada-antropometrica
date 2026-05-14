import { createClient } from '@supabase/supabase-js'

// ⚠️ REEMPLAZÁ estos valores con los de tu proyecto en Supabase
// Los encontrás en: Settings → API
const SUPABASE_URL = https://dyhzqustiuwwnrhoxkut.supabase.co/rest/v1/
const SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5aHpxdXN0aXV3d25yaG94a3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODkzMjksImV4cCI6MjA5NDM2NTMyOX0.n3qYGmKbQJRDsZiP4M-voIMfaUc65IkMU8SYZBI0jSU

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
