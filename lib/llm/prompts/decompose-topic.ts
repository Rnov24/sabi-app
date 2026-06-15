export function buildDecomposeTopicPrompt(topicString: string): string {
  return `Kamu adalah tutor akademik. Dekomposisi topik berikut menjadi 4–8 subtopik atomik yang bersama-sama membentuk pemahaman lengkap.

Topik: "${topicString}"

Aturan:
1. Setiap subtopik harus SPESIFIK dan BISA DIJELASKAN — bukan meta-topik seperti "Pengenalan X" atau "Sejarah X" kecuali relevan langsung
2. Subtopik TIDAK boleh overlap
3. Urutkan dari fondasi ke advanced
4. Setiap subtopik harus bisa berdiri sendiri sebagai unit belajar
5. Judul subtopik maksimal 150 karakter

Kembalikan HANYA JSON array valid (tanpa teks tambahan):
[
  { "title": "string", "difficulty": "basic" | "intermediate" | "advanced" }
]`
}
