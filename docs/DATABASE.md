# Database

## Lokasi

| Lingkungan | Database |
| --- | --- |
| Lokal (development) | **PostgreSQL 18 di Docker** (service `pgsql`, volume `pgsql-data`). Dari host: `127.0.0.1:5433`, database `ai_int_test` |
| Tes (Pest) | SQLite `:memory:`, hilang setelah tes selesai |
| Production (rencana) | PostgreSQL, sesuai [spesifikasi](../AI_INTERVIEW_SPECIFICATIONS.md) |

File lama `database/database.sqlite` masih ada, tetapi tidak dipakai lagi.

Struktur tabel berasal dari migration di [database/migrations](../database/migrations). **Perubahan struktur selalu dibuat lewat migration baru**, bukan dengan mengedit tabel langsung.

Cara melihat struktur:

```bash
docker compose exec laravel.test php artisan db:show
```

```bash
docker compose exec laravel.test php artisan db:table interview_messages
```

Untuk tampilan visual, sambungkan DBeaver, TablePlus, atau pgAdmin ke `127.0.0.1:5433` (user dan password ada di `.env`).

## ERD

```mermaid
erDiagram
    users ||--o{ interview_rooms : "memiliki (interviewer)"
    users ||--o{ interview_messages : mengirim
    users ||--o{ interview_recordings : merekam
    interview_rooms ||--o{ interview_messages : berisi
    interview_rooms ||--o{ interview_recordings : berisi

    users {
        int id PK
        varchar name
        varchar email UK
        datetime email_verified_at
        varchar password
        varchar role "applicant (default) | interviewer"
        text two_factor_secret
        text two_factor_recovery_codes
        datetime two_factor_confirmed_at
        varchar remember_token
        datetime created_at
        datetime updated_at
    }
    interview_rooms {
        int id PK
        varchar room_code UK "6 karakter, uppercase"
        varchar status "default active"
        int user_id FK "nullable, pemilik room"
        datetime created_at
        datetime updated_at
    }
    interview_messages {
        int id PK
        int interview_room_id FK
        varchar room_code "index"
        int user_id FK "nullable, null untuk AI"
        varchar role "applicant | ai_assistant"
        text message
        datetime created_at
        datetime updated_at
    }
    interview_recordings {
        int id PK
        int interview_room_id FK
        varchar room_code "index"
        int user_id FK "nullable"
        varchar file_path
        varchar file_name
        varchar mime_type "default video/webm"
        int size_bytes "default 0"
        int duration_seconds "nullable"
        varchar status "default ready"
        datetime created_at
        datetime updated_at
    }
```

## Tabel Aplikasi

### `users`
Akun login dari Fortify, ditambah kolom `role` (index). User yang mendaftar lewat UI otomatis mendapat role `applicant`.

### `interview_rooms`
Satu baris mewakili satu sesi interview.
- `room_code`: kode 6 karakter acak, unik. Dipakai di URL `/rooms/{CODE}`.
- `status`: hanya `active` yang bisa dibuka. Belum ada fitur untuk menutup room.
- `user_id`: interviewer pembuat room. Interviewer lain mendapat 403.

### `interview_messages`
Riwayat percakapan di room, sekaligus konteks yang dikirim ke AI.
- `role`: `applicant` atau `ai_assistant` (enum di migration).
- `user_id`: `null` untuk pesan AI.
- **Catatan:** pesan yang dikirim interviewer saat ini juga tersimpan sebagai `applicant`, karena enum belum punya nilai `interviewer`. Lihat [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

### `interview_recordings`
Metadata rekaman video. File aslinya ada di `storage/app/public/{file_path}`.

### Relasi & penghapusan
- Room dihapus: semua pesan dan rekamannya ikut terhapus (`cascade`). **File di disk tidak ikut terhapus.**
- User dihapus: `user_id` di tabel lain diisi `null` (`set null`).

## Tabel Bawaan Laravel

| Tabel | Kegunaan |
| --- | --- |
| `sessions` | Tidak dipakai: session ada di Redis (`SESSION_DRIVER=redis`). Tabel disimpan untuk fallback |
| `cache`, `cache_locks` | Tidak dipakai: cache ada di Redis (`CACHE_STORE=redis`) |
| `jobs`, `job_batches` / `failed_jobs` | Antrian ada di Redis (`QUEUE_CONNECTION=redis`); `failed_jobs` tetap dipakai untuk mencatat job yang gagal |
| `password_reset_tokens` | Reset password |
| `passkeys` | Login passkey (WebAuthn) |
| `migrations` | Catatan migration yang sudah dijalankan |

## Data di Luar Tabel

| Data | Lokasi |
| --- | --- |
| Peserta aktif room | Redis (DB 1), key `…cache-interview-room-presence:{CODE}`, TTL 45 detik |
| File video rekaman | `storage/app/public/recordings/{CODE}/rec_{CODE}_{waktu}_{acak}.webm` |
| File audio untuk AI | `storage/app/public/audio/{CODE}/audio_ai_{CODE}_{waktu}_{acak}.webm` |
| Prototype `/interview` | Session key `prototype_interview` (tidak masuk tabel) |

## Rencana Tabel (dari spesifikasi)

Belum dibuat. Dibutuhkan untuk evaluasi AI dan mode multi-applicant:

| Tabel | Isi |
| --- | --- |
| `interview_participants` | Applicant per room/sesi, agar setiap applicant punya riwayat AI sendiri |
| `interview_questions` | Pertanyaan yang diajukan AI beserta tipe dan tujuannya |
| `interview_results` | Skor, kelebihan, kekurangan, ringkasan, dan rekomendasi |
| `interview_violations` | Riwayat pelanggaran proctoring (saat ini hanya di-broadcast) |
| Kolom konteks di `interview_rooms` | Posisi, job description, bahasa, jumlah pertanyaan |
