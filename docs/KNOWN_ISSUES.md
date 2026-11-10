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
| ~~F1~~ | ✅ Selesai: pesan interviewer kini disimpan dengan role `interviewer` dan tidak dikirim ke AI | `RoomController::sendMessage`, migration `2026_11_09_…` | — |
| F2 | Panggilan AI sinkron di dalam request. Qwen bisa butuh beberapa detik dan memblokir worker PHP | `RoomController::sendMessage` | Job queue + broadcast balasan |
| F3 | Tidak ada cara menutup room (`status` selalu `active`) | `InterviewRoom` | Endpoint "End interview" |
| F4 | Pelanggaran proctoring hanya di-broadcast, **tidak disimpan** | `RoomViolationController` | Tabel `interview_violations` |
| F5 | `analyze-audio` hanya menyimpan file, belum ada analisis | `InterviewRecordingController::analyzeAudio` | Sambungkan ke STT/AI server-side jika dibutuhkan |
| ~~F6~~ | ✅ Selesai: lobby cek kamera/mic dipasang di `/rooms/{code}/lobby` sebelum masuk room | — | — |
| F7 | Batas 2 peserta. Belum mendukung multi-applicant | `RoomPresenceService` | Lihat [AI_INTEGRATION.md](AI_INTEGRATION.md#multi-applicant-dalam-satu-sesi) |
| F8 | Menghapus room tidak menghapus file rekaman di disk | `interview_recordings` | Hapus file di event `deleting` |
| F9 | Akun interviewer hanya bisa dibuat lewat perintah artisan (`interviewer:create`), belum ada halaman admin | Registrasi Fortify | Halaman admin saat tim HR non-teknis perlu mengelola akun |
| F10 | Hanya STUN publik Google, tanpa TURN server. WebRTC bisa gagal tersambung di jaringan kantor atau NAT ketat | `use-webrtc` (`iceServers`) | Tambah TURN server (misal coturn), konfigurasi lewat `.env` |

## Kualitas Kode

| # | Masalah | Saran |
| --- | --- | --- |
| ~~Q1~~ | ✅ Selesai: panel transkrip, dialog rekaman, dan tombol kontrol dipisah ke `components/room/` | — |
| ~~Q2~~ | ✅ Selesai: `room/show.tsx` lolos `vp check` | — |
| Q3 | Dua alur interview terpisah (`/interview` berbasis session dan room) | Pilih satu, lalu hapus yang lain |
| Q4 | `README.md` di root kosong | Sudah diisi ringkasan + tautan ke `docs/` |
