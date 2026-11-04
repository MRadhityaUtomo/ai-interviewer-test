# Known Issues & Technical Debt

Temuan dari review kode. Diurutkan per kategori, dengan perkiraan dampak.

## Keamanan

| # | Masalah | Lokasi | Dampak | Saran |
| --- | --- | --- | --- | --- |
| S1 | Channel `room.{CODE}` bersifat **publik**. Siapa pun yang tahu kode room bisa subscribe dan membaca SDP/ICE serta peringatan pelanggaran | `WebRTCSignal::broadcastOn`, `use-room-signaling` | Tinggi | Ganti ke `PrivateChannel` + otorisasi di `routes/channels.php` (hanya pemilik room & applicant terdaftar) |
| S2 | `stream` / `download` rekaman **tidak memeriksa hak akses**. Semua user login bisa mengakses rekaman apa pun lewat ID | `InterviewRecordingController` | Tinggi | Batasi ke interviewer pemilik room |
| S3 | `index` / `store` rekaman dan `analyze-audio` tidak memeriksa role atau kepemilikan room | `InterviewRecordingController` | Sedang | Tambah policy / pengecekan role |
| S4 | `sendMessage` tidak memeriksa apakah user memang peserta room tersebut | `RoomController::sendMessage` | Sedang | Validasi kepemilikan / keikutsertaan |
| S5 | Prototype `/interview` tanpa middleware `auth` | `routes/web.php` | Rendah | Lindungi atau hapus setelah room menggantikannya |
| S6 | File rekaman disimpan di disk `public`, sehingga bisa diakses langsung lewat `/storage/...` jika path diketahui | `storage/app/public/recordings` | Sedang | Pindah ke disk privat, akses hanya lewat controller |

## Fungsional

| # | Masalah | Lokasi | Saran |
| --- | --- | --- | --- |
| F1 | Pesan dari interviewer tersimpan dengan role `applicant`, karena enum hanya `applicant` / `ai_assistant`. Pesan ini ikut terbaca AI sebagai jawaban kandidat | `RoomController::sendMessage`, migration `interview_messages` | Migration baru yang menambah `interviewer`, lalu simpan `$role` |
| F2 | Panggilan AI sinkron di dalam request. Qwen bisa butuh beberapa detik dan memblokir worker PHP | `RoomController::sendMessage` | Job queue + broadcast balasan |
| F3 | Tidak ada cara menutup room (`status` selalu `active`) | `InterviewRoom` | Endpoint "End interview" |
| F4 | Pelanggaran proctoring hanya di-broadcast, **tidak disimpan** | `RoomViolationController` | Tabel `interview_violations` |
| F5 | `analyze-audio` hanya menyimpan file, belum ada analisis | `InterviewRecordingController::analyzeAudio` | Sambungkan ke STT/AI server-side jika dibutuhkan |
| F6 | Halaman `room/lobby.tsx` (cek perangkat) tidak dipakai route mana pun | `resources/js/pages/room/lobby.tsx` | Pasang sebelum `room/show` atau hapus |
| F7 | Batas 2 peserta. Belum mendukung multi-applicant | `RoomPresenceService` | Lihat [AI_INTEGRATION.md](AI_INTEGRATION.md#multi-applicant-dalam-satu-sesi) |
| F8 | Menghapus room tidak menghapus file rekaman di disk | `interview_recordings` | Hapus file di event `deleting` |
| F9 | Tidak ada cara membuat akun interviewer dari UI | Registrasi Fortify | Halaman admin atau perintah artisan |
| F10 | Hanya STUN publik Google, tanpa TURN server. WebRTC bisa gagal tersambung di jaringan kantor atau NAT ketat | `use-webrtc` (`iceServers`) | Tambah TURN server (misal coturn), konfigurasi lewat `.env` |

## Kualitas Kode

| # | Masalah | Saran |
| --- | --- | --- |
| Q1 | `room/show.tsx` sangat besar (±1.270 baris) dan menggabungkan video, STT, chat, rekaman, dan proctoring | Pecah ke komponen: `VideoTiles`, `TranscriptPanel`, `RecordingDialog`, dst. |
| Q2 | `room/show.tsx` belum lolos `vp check` (format) | Jalankan `npm run check:fix` setelah perubahan STT di-commit |
| Q3 | Dua alur interview terpisah (`/interview` berbasis session dan room) | Pilih satu, lalu hapus yang lain |
| Q4 | `README.md` di root kosong | Sudah diisi ringkasan + tautan ke `docs/` |
