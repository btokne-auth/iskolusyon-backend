import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, entries: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}