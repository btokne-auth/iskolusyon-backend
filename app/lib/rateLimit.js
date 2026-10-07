// Sept 30 2026: login rate-limiting.
//
// Counts recent attempts per "bucket" (a text key such as
// 'admin-login:email:someone@ccc.edu') in the Supabase table
// `login_attempts`. A table is used instead of server memory because on
// Vercel every request can run on a different server, so a plain in-memory
// counter would reset constantly and protect nothing.
//
// Table (created once in the Supabase SQL Editor):
//   create table login_attempts (
//     id bigserial primary key,
//     bucket text not null,
//     created_at timestamptz not null default now()
//   );
//   create index login_attempts_bucket_created_idx
//     on login_attempts (bucket, created_at);
//
// Fails OPEN on purpose: if the table is missing or Supabase hiccups, a
// real person must still be able to sign in. The failure is logged.
import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'

export const MINUTE = 60 * 1000

// Best-effort network address of the caller (Vercel sets x-forwarded-for).
export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  const first = forwarded.split(',')[0].trim()
  return first || request.headers.get('x-real-ip') || 'unknown'
}

export function normalizeKey(value) {
  return (value || '').toString().trim().toLowerCase()
}

// Returns { blocked: false } or { blocked: true, retryAfterSec }.
// Blocked once `max` or more attempts were recorded inside the window.
export async function checkLimit(bucket, max, windowMs) {
  try {
    const since = new Date(Date.now() - windowMs).toISOString()
    const { data, error } = await supabase
      .from('login_attempts')
      .select('created_at')
      .eq('bucket', bucket)
      .gte('created_at', since)
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!data || data.length < max) return { blocked: false, count: data ? data.length : 0 }

    // The block lifts when the attempt that is `max` places from the
    // newest one falls out of the window.
    const pivot = new Date(data[data.length - max].created_at).getTime()
    const retryAfterSec = Math.max(1, Math.ceil((pivot + windowMs - Date.now()) / 1000))
    return { blocked: true, retryAfterSec, count: data.length }
  } catch (err) {
    console.error('Rate limit check failed (allowing the request):', err)
    return { blocked: false, count: 0 }
  }
}

export async function recordAttempt(bucket) {
  try {
    await supabase.from('login_attempts').insert([{ bucket }])
    // Occasional housekeeping so the table never grows without bound.
    if (Math.random() < 0.05) {
      const cutoff = new Date(Date.now() - 24 * 60 * MINUTE).toISOString()
      await supabase.from('login_attempts').delete().lt('created_at', cutoff)
    }
  } catch (err) {
    console.error('Rate limit record failed (non-blocking):', err)
  }
}

export async function clearAttempts(bucket) {
  try {
    await supabase.from('login_attempts').delete().eq('bucket', bucket)
  } catch (err) {
    console.error('Rate limit clear failed (non-blocking):', err)
  }
}

export function waitMessage(retryAfterSec) {
  const minutes = Math.ceil(retryAfterSec / 60)
  return retryAfterSec > 60
    ? `Too many attempts. Please try again in about ${minutes} minutes.`
    : `Too many attempts. Please try again in ${retryAfterSec} seconds.`
}

// Oct 7 2026 (manuscript Ch. 3, Authentication and Brute-Force Testing):
// per-person limits on the busy write routes, not only on sign-in.
// Counts EVERY request (not just failures) in the same table under its own
// bucket name. Returns a ready 429 reply when over the limit, else null.
// Fails open like checkLimit(), so a database hiccup never blocks real use.

export async function limitRequest(bucket, max, windowMs, message) {
  const check = await checkLimit(bucket, max, windowMs)
  if (check.blocked) {
    return NextResponse.json(
      { error: message || waitMessage(check.retryAfterSec), rateLimited: true },
      { status: 429, headers: { 'Retry-After': String(check.retryAfterSec) } }
    )
  }
  await recordAttempt(bucket)
  return null
}
