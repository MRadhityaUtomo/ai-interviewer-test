# Known Issues & Technical Debt

Temuan dari review kode. Diurutkan per kategori, dengan perkiraan dampak.

## Keamanan

| # | Masalah | Lokasi | Dampak | Saran |
| --- | --- | --- | --- | --- |
| ~~S1~~ | ✅ Selesai: channel `room.{CODE}` kini **privat**; hanya user yang duduk di room (tabel `interview_participants`) yang boleh subscribe | `routes/channels.php` | — | — |
| ~~S2~~ | ✅ Selesai: stream/download rekaman hanya untuk interviewer pemilik room | `InterviewRecordingController` | — | — |
| ~~S3~~ | ✅ Selesai: daftar/upload rekaman khusus interviewer peserta room; `analyze-audio` wajib cookie room | `routes/web.php` (`room.participant`) | — | — |
| ~~S4~~ | ✅ Selesai: semua endpoint di dalam room mengecek cookie peserta (`EnsureRoomParticipant`) | `app/Http/Middleware` | — | — |
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
