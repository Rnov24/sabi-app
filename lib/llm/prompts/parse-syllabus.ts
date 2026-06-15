export function buildParseSyllabusPrompt(): string {
  return `Kamu adalah asisten akademik yang menganalisis silabus mata kuliah universitas Indonesia.

Tugas: Analisis dokumen silabus PDF ini dan ekstrak informasi terstruktur.

Aturan:
1. Ekstrak SEMUA topik yang bisa dipelajari dan dijelaskan oleh mahasiswa — bukan nama bab generik
2. Kelompokkan topik berdasarkan parent topic jika ada hierarki jelas
3. Jika ada jadwal ujian (UTS, UAS, quiz) yang disebutkan eksplisit, ekstrak tanggal terdekat sebagai exam_date dalam format YYYY-MM-DD
4. Jika TIDAK ada jadwal ujian dalam dokumen, set exam_date = null — JANGAN menebak
5. Tentukan level mata kuliah: "intro" (semester 1-2), "intermediate" (semester 3-5), atau "advanced" (semester 6+)
6. Maksimal 30 topik
7. Urutkan topik sesuai urutan pembelajaran logis

Kembalikan HANYA JSON valid (tanpa teks tambahan) dengan format:
{
  "course_level": "intro" | "intermediate" | "advanced",
  "exam_date": "YYYY-MM-DD" | null,
  "topics": [
    {
      "title": "string — judul topik spesifik dan bisa dipelajari",
      "parent_topic": "string | null — label pengelompokan induk",
      "display_order": number
    }
  ]
}`
}
