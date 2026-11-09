import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { requireConsoleRole } from '@/app/lib/adminRoles'
import { DATE_RE, manilaToday, formatAccessDate } from '@/app/lib/adminAccounts'
import { sendResultEmail } from '@/app/lib/resultNotices'
import { resultsVisible } from '@/app/lib/resultVisibility'
import { serverError } from '@/app/lib/safeError'
import { dashboardCounts } from '@/app/lib/dashboardCounts'

// Oct 5 2026: Allowance Distribution (Progress Table row 78), Office of the
// Registrar only. Behavior follows Ivy's admin.html Registrar panel (Student
// ID, Date of Distribution no later than today, Type Wi-Fi or Other with a
// description, "Disseminate Allowance"), with Pau's changes: the Registrar
// picks the scholar from a list instead of typing an ID (the system has
// application numbers, not student IDs), only Passer and Qualified
// (Probationary) scholars can receive one, each post sends the scholar a
// portal message (plus an email if they opted in), and a post can be
// removed (kept in the table with removed_at for the record).
//
// GET                       -> scholars, posts, Dashboard counts
// POST { applicationId, distributionDate, type, description }
// DELETE { id }

const SCHOLAR_STATUSES = ['passer', 'qualified_probationary']
const STATUS_LABEL = { passer: 'Passer', qualified_probationary: 'Qualified (Probationary)' }
const TYPES = ['Wi-Fi', 'Other']

async function logAudit(actor, action, kind) {
  try {
    await supabase.from('audit_log').insert([{ actor, action, kind, category: 'Allowance' }])
  } catch (auditErr) {
    console.error('Audit log insert failed (non-blocking):', auditErr)
  }
}

export async function GET(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['registrar'])
    if (!session) return response

    const { data: apps, error: appsError } = await supabase
      .from('applications')
      .select(
        'id, applicant_user_id, applicant_name, application_number, program_choice_1, admitted_program, scholar_status, eligibility_status, eligibility_override, result_notified_at'
      )
      .is('archived_at', null)
    if (appsError) return serverError(appsError, 'api/registrar-allowance')

    // Dashboard counts: the same six cards the Admin Dashboard shows,
    // view-only for the Registrar.
    // Nov 2026: same counting rule as the Guidance Dashboard (after-exam
    // status first); see app/lib/dashboardCounts.js.
    const { data: requests } = await supabase.from('reschedule_requests').select('request_type, applicant_user_id, applicant_email, applicant_name')
    const counts = dashboardCounts(apps, requests)

    // Scholars: Passer or Qualified (Probationary) whose result was already
    // sent to them (so an allowance never reveals a result early).
    const scholars = (apps || [])
      .filter((app) => SCHOLAR_STATUSES.includes(app.scholar_status) && app.result_notified_at)
      .map((app) => ({
        id: app.id,
        name: app.applicant_name || 'Unnamed applicant',
        applicationNumber: app.application_number || '',
        program: app.admitted_program || app.program_choice_1 || '',
        status: app.scholar_status,
        statusLabel: STATUS_LABEL[app.scholar_status],
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const appById = new Map((apps || []).map((app) => [app.id, app]))
    const { data: posts, error: postsError } = await supabase
      .from('allowance_posts')
      .select('id, application_id, distribution_date, allowance_type, description, posted_by, posted_at')
      .is('removed_at', null)
      .order('distribution_date', { ascending: false })
      .order('posted_at', { ascending: false })
    if (postsError) return serverError(postsError, 'api/registrar-allowance')

    const visiblePosts = (posts || [])
      .filter((p) => appById.has(p.application_id))
      .map((p) => {
        const app = appById.get(p.application_id)
        return {
          ...p,
          applicant_name: app.applicant_name || 'Unnamed applicant',
          application_number: app.application_number || '',
        }
      })

    const postedIds = new Set(visiblePosts.map((p) => p.application_id))
    return NextResponse.json({
      success: true,
      today: manilaToday(),
      counts,
      scholars,
      posts: visiblePosts,
      scholarsWithoutPost: scholars.filter((s) => !postedIds.has(s.id)).length,
    })
  } catch (err) {
    return serverError(err, 'api/registrar-allowance')
  }
}

export async function POST(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['registrar'])
    if (!session) return response

    const body = await request.json()
    const applicationId = Number(body.applicationId)
    const distributionDate = String(body.distributionDate || '')
    const type = String(body.type || '')
    const description = String(body.description || '').trim()

    if (!applicationId) return NextResponse.json({ error: 'Please choose a scholar.' }, { status: 400 })
    if (!DATE_RE.test(distributionDate)) return NextResponse.json({ error: 'Please set the date of distribution.' }, { status: 400 })
    if (distributionDate > manilaToday()) {
      return NextResponse.json({ error: 'The date of distribution can be today or an earlier date.' }, { status: 400 })
    }
    if (!TYPES.includes(type)) return NextResponse.json({ error: 'Please choose Wi-Fi or Other.' }, { status: 400 })
    if (type === 'Other' && !description) {
      return NextResponse.json({ error: 'Please describe the allowance.' }, { status: 400 })
    }
    if (description.length > 200) return NextResponse.json({ error: 'The description is too long (200 characters at most).' }, { status: 400 })

    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id, applicant_name, first_name, applicant_email, application_number, scholar_status, email_updates_opt_in, result_notified_at, archived_at')
      .eq('id', applicationId)
      .maybeSingle()
    if (appError) return serverError(appError, 'api/registrar-allowance')
    if (!app || app.archived_at) return NextResponse.json({ error: 'That scholar could not be found.' }, { status: 404 })
    if (!SCHOLAR_STATUSES.includes(app.scholar_status)) {
      return NextResponse.json({ error: 'Only Passer and Qualified (Probationary) scholars can receive an allowance.' }, { status: 400 })
    }
    if (!app.result_notified_at || !(await resultsVisible())) {
      return NextResponse.json({ error: "This scholar's result hasn't been released to them yet." }, { status: 409 })
    }

    const { data: post, error: postError } = await supabase
      .from('allowance_posts')
      .insert([
        {
          application_id: app.id,
          distribution_date: distributionDate,
          allowance_type: type,
          description: type === 'Other' ? description : description || null,
          posted_by: session.name,
          posted_by_email: session.email,
        },
      ])
      .select('id, application_id, distribution_date, allowance_type, description, posted_by, posted_at')
      .single()
    if (postError) return serverError(postError, 'api/registrar-allowance')

    // Tell the scholar: a private portal message always, an email only if
    // they opted in to email updates.
    const what = type === 'Other' ? description : 'Wi-Fi'
    const when = formatAccessDate(distributionDate)
    const who = (app.first_name || app.applicant_name || 'Scholar').trim()
    const subject = 'CCC Scholarship: Allowance Distribution'
    const message = [
      `Good day, ${who}. The Office of the College Registrar posted an allowance distribution for you: ${what}, dated ${when}.`,
      'You can see all your allowance distributions on the Allowance page of the Iskolusyon portal.',
      'For questions about your allowance, please contact the Office of the College Registrar.',
    ].join('\n\n')

    let messageSent = true
    const { error: msgError } = await supabase.from('announcements').insert([
      {
        author: session.name,
        title: subject,
        body: message,
        category: 'Allowance',
        type: 'message',
        target_type: 'specific',
        target_application_id: app.id,
        target_category: null,
      },
    ])
    if (msgError) {
      messageSent = false
      console.error('Allowance portal message failed (non-blocking):', msgError.message)
    }

    let emailSent = false
    if (app.email_updates_opt_in && app.applicant_email) {
      const mail = await sendResultEmail({ to: app.applicant_email, subject, message })
      emailSent = !mail.error
      if (mail.error) console.error('Allowance email failed (non-blocking):', mail.error)
    }

    await logAudit(
      session.name,
      `Posted ${type === 'Other' ? `an allowance (${description})` : 'a Wi-Fi allowance'} dated ${when} to ${app.applicant_name || 'an applicant'}${
        app.application_number ? ` (${app.application_number})` : ''
      }${emailSent ? '. Email sent' : app.email_updates_opt_in ? '. Email failed to send' : ''}`,
      'done'
    )

    return NextResponse.json({
      success: true,
      post: { ...post, applicant_name: app.applicant_name, application_number: app.application_number || '' },
      messageSent,
      emailSent,
      emailOptIn: !!app.email_updates_opt_in,
    })
  } catch (err) {
    return serverError(err, 'api/registrar-allowance')
  }
}

export async function DELETE(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['registrar'])
    if (!session) return response

    const body = await request.json().catch(() => ({}))
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: 'Missing post.' }, { status: 400 })

    const { data: post, error } = await supabase
      .from('allowance_posts')
      .update({ removed_at: new Date().toISOString(), removed_by: session.name })
      .eq('id', id)
      .is('removed_at', null)
      .select('id, application_id, distribution_date, allowance_type, description')
      .maybeSingle()
    if (error) return serverError(error, 'api/registrar-allowance')
    if (!post) return NextResponse.json({ error: 'That post was already removed.' }, { status: 404 })

    const { data: app } = await supabase
      .from('applications')
      .select('applicant_name, application_number')
      .eq('id', post.application_id)
      .maybeSingle()
    await logAudit(
      session.name,
      `Removed ${post.allowance_type === 'Other' ? `an allowance post (${post.description})` : 'a Wi-Fi allowance post'} dated ${formatAccessDate(
        post.distribution_date
      )} from ${app?.applicant_name || 'an applicant'}${app?.application_number ? ` (${app.application_number})` : ''}`,
      'warn'
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError(err, 'api/registrar-allowance')
  }
}
