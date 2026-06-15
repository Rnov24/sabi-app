interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export function buildSubmitExplanationPrompt(
  topicTitle: string,
  learningGoal: string,
  explanation: string,
  roundNumber: number,
  conversationHistory: ConversationMessage[]
): string {
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'Mahasiswa' : 'Tutor'}: ${m.content}`)
    .join('\n')

  return `Kamu adalah tutor Socratic yang skeptis tapi supportif. Kamu sedang mengevaluasi penjelasan mahasiswa dalam ronde ke-${roundNumber}.

Topik: "${topicTitle}"
Learning Goal: "${learningGoal}"

Histori percakapan sebelumnya:
${historyText || '(belum ada)'}

Penjelasan terbaru mahasiswa:
"""${explanation}"""

Tugas:
Evaluasi apakah penjelasan mahasiswa sudah memenuhi learning goal.

Jika BELUM memenuhi:
- Identifikasi gap yang masih ada
- Ajukan SATU pertanyaan Socratic yang paling efektif mengungkap gap tersebut
- Return status "continue"

Jika SUDAH memenuhi (bukti nyata dalam penjelasan):
- Ekstrak penjelasan terbaik mahasiswa dari seluruh percakapan
- Return status "mastery"

ATURAN KETAT:
- JANGAN konfirmasi mastery sebelum ronde ke-2 (round_number >= 2)
- JANGAN memberikan jawaban langsung dalam pertanyaan
- JANGAN memberikan petunjuk yang terlalu jelas
- Mastery HANYA jika ada bukti NYATA pemahaman, bukan sekadar mengulang definisi
- Pertanyaan harus dalam bahasa Indonesia natural
- Hanya SATU pertanyaan per ronde

Kembalikan HANYA JSON valid, salah satu dari:
{ "status": "continue", "socratic_question": "string" }
atau
{ "status": "mastery", "best_explanation": "string — penjelasan terbaik mahasiswa dari percakapan" }`
}
