interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export function buildGenerateMasteryCardPrompt(
  topicTitle: string,
  bestExplanation: string,
  conversationHistory: ConversationMessage[]
): string {
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'Mahasiswa' : 'Tutor'}: ${m.content}`)
    .join('\n')

  return `Kamu adalah editor yang memoles penjelasan mahasiswa menjadi mastery card — ringkasan bersih yang ditulis dalam SUARA MAHASISWA.

Topik: "${topicTitle}"

Penjelasan terbaik mahasiswa:
"""${bestExplanation}"""

Histori percakapan lengkap:
${historyText}

Tugas:
Buat ringkasan 3–5 kalimat yang:
1. Ditulis dalam SUARA MAHASISWA — bukan definisi buku teks
2. Mempertahankan ANALOGI dan CONTOH asli mahasiswa sebisa mungkin
3. Mengalir natural sebagai paragraf pendek
4. Menangkap esensi pemahaman yang ditunjukkan

ATURAN:
- INI BUKAN ringkasan AI — ini adalah versi yang dipoles dari kata-kata mahasiswa
- Jangan tambahkan informasi yang tidak disebutkan mahasiswa
- Gunakan bahasa Indonesia yang natural
- 3–5 kalimat, tidak lebih

Kembalikan HANYA teks mastery card (tanpa JSON, tanpa wrapper — langsung teksnya saja).`
}
