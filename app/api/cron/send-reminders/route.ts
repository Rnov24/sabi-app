import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Guard the endpoint: read Authorization header and verify it is Bearer ${process.env.CRON_SECRET}
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const currentDateStr = new Date().toISOString().split('T')[0]

  try {
    // Query all mastery_events where next_review_date <= CURRENT_DATE (due for review)
    // Join with profiles to get display names, and topics to get titles
    const { data: allDueEvents, error: queryError } = await adminClient
      .from('mastery_events')
      .select(`
        id,
        user_id,
        mastery_card_text,
        next_review_date,
        profiles (
          display_name
        ),
        topics (
          title
        )
      `)
      .lte('next_review_date', currentDateStr)

    if (queryError) {
      console.error('Database query failed for due mastery events:', queryError)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    const totalDue = allDueEvents?.length || 0
    // Limit the batch to max 50 emails per run
    const eventsToProcess = (allDueEvents || []).slice(0, 50)

    let emailsSent = 0
    let errors = 0

    if (eventsToProcess.length > 0) {
      // Collect unique user IDs to fetch their emails
      const uniqueUserIds = Array.from(new Set(eventsToProcess.map(event => event.user_id)))
      const emailMap = new Map<string, string>()

      // Fetch emails from auth.admin in parallel
      await Promise.all(
        uniqueUserIds.map(async (userId) => {
          try {
            const { data: userData, error } = await adminClient.auth.admin.getUserById(userId)
            if (!error && userData?.user?.email) {
              emailMap.set(userId, userData.user.email)
            }
          } catch (err) {
            console.error(`Error fetching user details for ${userId}:`, err)
          }
        })
      )

      // Send emails
      for (const event of eventsToProcess) {
        try {
          const email = emailMap.get(event.user_id)
          if (!email) {
            throw new Error(`No email address found for user ${event.user_id}`)
          }

          const displayName = (event.profiles as any)?.display_name || 'Teman Sabi'
          const topicTitle = (event.topics as any)?.title || 'Topik Sabi'
          
          // Use a preview (50 words) of the mastery card text
          const words = (event.mastery_card_text || '').trim().split(/\s+/)
          const previewText = words.slice(0, 50).join(' ') + (words.length > 50 ? '...' : '')
          const reviewLink = `https://sabi.id/review/${event.id}`

          const subject = `Waktunya review: ${topicTitle}`
          const htmlBody = `
            <p>Halo ${displayName},</p>
            <p>Saatnya mereview pemahamanmu tentang topik <strong>${topicTitle}</strong>.</p>
            <p>Berikut adalah ringkasan kartu mastery kamu sebelumnya:</p>
            <blockquote style="border-left: 4px solid #ccc; padding-left: 10px; margin: 10px 0; color: #555;">
              ${previewText}
            </blockquote>
            <p>Untuk memulai review Socratic blind, silakan klik tautan di bawah ini:</p>
            <p><a href="${reviewLink}" style="display: inline-block; padding: 10px 20px; color: #fff; background-color: #0070f3; text-decoration: none; border-radius: 5px;">Mulai Review</a></p>
            <p>Atau buka tautan berikut: <a href="${reviewLink}">${reviewLink}</a></p>
          `
          const textBody = `Halo ${displayName},\n\n` +
            `Saatnya mereview pemahamanmu tentang topik: ${topicTitle}\n\n` +
            `Berikut adalah ringkasan kartu mastery kamu sebelumnya:\n` +
            `"${previewText}"\n\n` +
            `Mulai review di sini: ${reviewLink}`

          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'SABI <onboarding@resend.dev>',
              to: email,
              subject,
              html: htmlBody,
              text: textBody,
            }),
          })

          if (!res.ok) {
            const errorText = await res.text()
            throw new Error(`Resend API error: ${res.status} - ${errorText}`)
          }

          emailsSent++
        } catch (err) {
          console.error(`Failed to send email for mastery event ${event.id}:`, err)
          errors++
        }
      }
    }

    // Log execution results into reminder_logs table
    const { error: logError } = await adminClient
      .from('reminder_logs')
      .insert({
        total_due: totalDue,
        emails_sent: emailsSent,
        errors: errors,
      })

    if (logError) {
      console.error('Failed to log reminder run in reminder_logs table:', logError)
    }

    return NextResponse.json({
      success: true,
      total_due: totalDue,
      emails_sent: emailsSent,
      errors: errors,
    })
  } catch (err) {
    console.error('Unexpected error in cron job:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
