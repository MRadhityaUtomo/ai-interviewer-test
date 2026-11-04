# Integrasi AI (Alibaba Qwen)

## Status

| Item | Status |
| --- | --- |
| Provider yang dipilih perusahaan | **Alibaba Qwen** (Model Studio / DashScope) |
| Akses API | ⏳ Belum ada. Aplikasi sengaja berjalan dengan `AI_PROVIDER=fake` |
| Kode integrasi | ✅ `QwenProvider` siap dan teruji dengan `Http::fake()` |
| Speech-to-text | Web Speech API browser (bukan Qwen) |

## Arsitektur

```mermaid
flowchart LR
    RC[RoomController::sendMessage] --> S[InterviewAiService]
    S -- "riwayat 30 pesan terakhir" --> I{{AiProviderInterface}}
    S -. "prompt" .- CFG[config/interview.php]
    I --> F[FakeAiProvider]
    I --> Q[QwenProvider]
    Q -- "POST /chat/completions<br/>JSON mode" --> D[(DashScope API)]
    Q -. "config" .- SV[config/services.php<br/>.env]
```

Controller tidak bergantung langsung pada Qwen. Untuk mengganti atau menambah provider, cukup buat class baru yang mengimplementasikan `AiProviderInterface`, lalu daftarkan di `AppServiceProvider`.

## Kontrak Data

**Input ke provider**: satu system prompt ditambah riwayat chat.

```json
[
  { "role": "assistant", "content": "Silakan perkenalkan diri Anda." },
  { "role": "user", "content": "Saya backend engineer selama 3 tahun..." }
]
```

Pemetaan role: `applicant` → `user`, `ai_assistant` → `assistant`.

**Output yang diwajibkan** (divalidasi `InterviewAiService`):

```json
{ "reply": "Apa tantangan terbesar di proyek tersebut?" }
```

Jika output tidak valid, provider gagal, atau API key kosong, sistem melempar `AiProviderException`. Controller lalu mengembalikan pesan error ke user, sementara jawaban applicant tetap tersimpan.

## Mengaktifkan Qwen

1. Isi `.env`:
   ```
   AI_PROVIDER=qwen
   DASHSCOPE_API_KEY=sk-...
   QWEN_MODEL=qwen-plus
   ```
2. Jika akun Alibaba berada di region **China**, ubah juga:
   ```
   QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
   ```
   API key dari satu region tidak berlaku di region lain.
3. Jalankan `php artisan config:clear`.
4. Uji satu sesi interview, lalu setel prompt di `config/interview.php`.

### Yang perlu dikonfirmasi ke pemberi akses
- Region akun (internasional atau China)
- Model yang diizinkan (`qwen-plus` / `qwen-max` / `qwen-turbo` / `qwen-flash`)
- Rate limit dan kuota, terutama jika banyak applicant sekaligus
- Biaya per token
- Kebijakan penyimpanan data kandidat

## Bahasa Indonesia & Istilah Perusahaan

**Kesimpulan: tidak perlu training.** LLM Qwen sudah memahami Bahasa Indonesia. Istilah perusahaan cukup ditangani dengan glosarium di prompt dan kamus STT. Fine-tuning hanya opsi terakhir.

| Cara | Kapan dipakai | Catatan |
| --- | --- | --- |
| **Glosarium di prompt** | Langkah pertama | Daftar istilah + arti di `config/interview.php`. Tanpa biaya training, bisa langsung diubah |
| **Kamus STT** | Bersamaan dengan glosarium | Perluas pola `jaksel-normalizer.ts` untuk mengoreksi salah tangkap STT (misal "jidi pi es" → "GDPS") |
| **RAG** | Dokumen perusahaan banyak (SOP, job description) | Ambil potongan dokumen yang relevan, lalu sisipkan ke prompt |
| **Fine-tuning** | Gaya wawancara masih belum sesuai | Lihat kendala di bawah |

**Kendala:**
- Model ASR (suara) Qwen **belum terkonfirmasi mendukung Bahasa Indonesia**. Karena itu STT tetap memakai browser.
- Fine-tuning butuh sekitar **1.000 contoh** berkualitas, ada biaya training dan hosting, dan hanya tersedia untuk model tertentu. Dukungan untuk `qwen-plus` belum pasti.
- Fine-tuning **tidak andal** untuk menghafal istilah atau fakta. Kalau istilah berubah, model harus dilatih ulang.

## Rencana Lanjutan

| Prioritas | Pekerjaan |
| --- | --- |
| Tinggi | Glosarium istilah perusahaan (prompt + normalizer) |
| Tinggi | Konteks interview per room: posisi, job description, jumlah pertanyaan |
| Tinggi | Panggilan AI lewat **queue**, balasan dikirim lewat Reverb, supaya request tidak menggantung saat Qwen lambat |
| Tinggi | Perbaikan role `interviewer` di `interview_messages` |
| Sedang | Evaluasi akhir: skor, kelebihan, kekurangan, ringkasan (`interview_results`) |
| Sedang | Dashboard review recruiter |
| Sedang | Rate limit per room/applicant |
| Rendah | Text-to-speech untuk pertanyaan AI |
| Rendah | Memakai `AiProviderInterface` juga di prototype `/interview` |

Semua pekerjaan di atas bisa dibuat dan dites dengan `FakeAiProvider` sebelum akses API tersedia.

## Multi-Applicant dalam Satu Sesi

Requirement menyebut **1 interviewer untuk banyak applicant dalam 1 sesi**. Ada dua cara menafsirkannya:

| | **A. Interview paralel** (direkomendasikan) | **B. Group interview** |
| --- | --- | --- |
| Konsep | Setiap applicant diwawancarai AI secara terpisah, bersamaan | Semua applicant berada di satu ruang, AI memandu bergiliran |
| Video antar-applicant | Tidak perlu | Perlu SFU (misal LiveKit), karena WebRTC P2P hanya kuat untuk 2–3 orang |
| Keadilan penilaian | Tinggi, setiap kandidat mendapat waktu dan pertanyaan setara | Rawan bias, kandidat bisa saling memengaruhi |
| Kompleksitas | Sedang, sebagian besar di backend | Tinggi: turn-taking, atribusi pembicara |

Perubahan yang dibutuhkan untuk model A:
1. Tabel `interview_participants`. Riwayat AI dipisah per applicant, bukan per room.
2. `InterviewAiService` hanya membaca riwayat applicant tersebut.
3. Batas 2 peserta di `RoomPresenceService` diganti kapasitas sesi yang bisa diatur.
4. WebRTC antar-applicant dihapus. Recruiter manusia cukup mendapat tampilan pantau.
5. Rekaman dan pelanggaran dicatat per applicant.
6. Panggilan AI wajib lewat queue, dan perlu dipastikan masih dalam rate limit Qwen.

Model yang dipakai masih menunggu keputusan.

## Referensi

- [AI_INTERVIEW_SPECIFICATIONS.md](../AI_INTERVIEW_SPECIFICATIONS.md): spesifikasi target modul AI
- [Model Studio: Improve ASR accuracy](https://www.alibabacloud.com/help/en/model-studio/improve-asr-accuracy)
- [Model Studio: Custom hot words](https://www.alibabacloud.com/help/en/model-studio/custom-hot-words-user-guide)
- [Model Studio: Model training overview](https://www.alibabacloud.com/help/en/model-studio/model-training-overview)
