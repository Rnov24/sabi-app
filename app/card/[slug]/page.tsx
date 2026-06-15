import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Helper to fetch card data
async function getCardData(slug: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('mastery_events')
    .select(`
      mastery_card_text,
      created_at,
      topics (
        title,
        courses (
          name
        )
      ),
      profiles (
        display_name
      )
    `)
    .eq('public_slug', slug)
    .single()

  if (error || !data) {
    return null
  }

  // Privacy: show only first name + last initial
  const fullName = (data as any).profiles?.display_name || 'Anonymous'
  const nameParts = fullName.split(' ')
  const authorName = nameParts.length > 1
    ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
    : nameParts[0]

  return {
    topic_title: (data as any).topics?.title ?? '',
    course_name: (data as any).topics?.courses?.name ?? '',
    mastery_card_text: data.mastery_card_text,
    created_at: data.created_at,
    author_display_name: authorName,
  }
}

// Generate dynamic metadata for SEO & social sharing
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const card = await getCardData(slug)

  if (!card) {
    return {
      title: 'Kartu Pemahaman Tidak Ditemukan - Sabi',
    }
  }

  const title = `Kartu Paspor Pemahaman: ${card.topic_title} - Sabi`
  const description = `Lihat bagaimana ${card.author_display_name} membuktikan penguasaan topik "${card.topic_title}" dalam mata kuliah ${card.course_name} menggunakan metode Socratic Sabi.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Sabi',
      locale: 'id_ID',
    },
    other: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  }
}

export default async function PublicCardPage({ params }: PageProps) {
  const { slug } = await params
  const card = await getCardData(slug)

  if (!card) {
    notFound()
  }

  const stampDate = new Date(card.created_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Format short date for stamp ink: e.g. "15 JUN 2026"
  const d = new Date(card.created_at)
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']
  const stampInkDate = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* Mini Brand Header */}
      <header className="border-b border-zinc-200 bg-white/85 px-4 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/85">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black tracking-tight text-indigo-600 dark:text-indigo-400 text-lg">
            <span>Sabi</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
              Socratic Learning
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            Masuk / Daftar
          </Link>
        </div>
      </header>

      {/* Main SSR Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-xl mx-auto w-full">
        {/* Visa Passport Stamp Card */}
        <div className="w-full relative overflow-hidden bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-850 p-6 md:p-8 shadow-md">
          {/* Top Stamp Header */}
          <div className="flex justify-between items-start gap-4 mb-6">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                SABI MASTERY PASSPORT
              </span>
              <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">
                Mata Kuliah: {card.course_name}
              </div>
            </div>

            {/* Vintage Stamp Seal */}
            <div className="rotate-12 border-2 border-emerald-600/80 text-emerald-600/80 font-serif text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-widest bg-white dark:bg-zinc-900 shadow-2xs">
              PASSED
            </div>
          </div>

          {/* Topic Title */}
          <h1 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-zinc-50 font-serif leading-tight mb-4">
            {card.topic_title}
          </h1>

          {/* Mastery Card Text */}
          <div className="relative mb-6">
            <blockquote className="border-l-4 border-amber-400/80 pl-4 italic text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed md:text-base">
              &ldquo;{card.mastery_card_text}&rdquo;
            </blockquote>
          </div>

          {/* Stamped metadata info */}
          <div className="pt-5 border-t border-dashed border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Mahasiswa Pelopor
              </span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {card.author_display_name}
              </span>
            </div>
            <div>
              <span className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Tanggal Terbit
              </span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200 font-semibold">
                {stampInkDate}
              </span>
            </div>
          </div>
        </div>

        {/* Viral CTA / Sabi Promo Box */}
        <div className="mt-8 text-center bg-indigo-50/50 border border-indigo-100 rounded-3xl p-6 dark:bg-indigo-950/20 dark:border-indigo-900/40 w-full">
          <h3 className="font-bold text-indigo-950 dark:text-indigo-300 text-sm md:text-base">
            Ingin menguasai mata kuliahmu 5x lebih cepat?
          </h3>
          <p className="text-xs text-indigo-800/80 dark:text-indigo-400/80 mt-1.5 leading-relaxed max-w-sm mx-auto">
            Sabi membantu mahasiswa memahami konsep sulit melalui sesi dialog Socratic interaktif dan menyimpan pemahaman dalam kartu pintar.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex justify-center items-center rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-semibold text-white transition-colors"
            >
              Mulai Belajar Sekarang (Gratis)
            </Link>
            <Link
              href="https://nextjs.org"
              target="_blank"
              className="w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-indigo-200/60 hover:bg-indigo-50/80 px-5 py-2.5 text-xs font-semibold text-indigo-700 dark:border-indigo-900/60 dark:hover:bg-indigo-950/40 transition-colors"
            >
              Pelajari Lebih Lanjut
            </Link>
          </div>
        </div>
      </main>

      {/* Public Footer */}
      <footer className="py-6 border-t border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-900/40">
        <p>&copy; {new Date().getFullYear()} Sabi. Semua Hak Dilindungi.</p>
      </footer>
    </div>
  )
}
