# Setup & Menjalankan Proyek

## Kebutuhan

- PHP **8.3+** dengan ekstensi `pdo_sqlite`
- Composer
- Node.js + npm
- Browser **Chrome atau Edge**. Web Speech API (STT) paling stabil di browser berbasis Chromium.

## Instalasi Pertama

```bash
composer run setup
```

Perintah di atas menjalankan: `composer install`, menyalin `.env.example` → `.env`, `key:generate`, `migrate`, `npm install`, dan `npm run build`.

Jika file `database/database.sqlite` belum ada, `migrate` akan menawarkan untuk membuatnya. Setelah itu isi akun demo:

```bash
php artisan db:seed
```

Seeder membuat dua akun terverifikasi, yaitu **interviewer** dan **applicant**. Email dan password-nya ada di [database/seeders/DatabaseSeeder.php](../database/seeders/DatabaseSeeder.php).

## Menjalankan Saat Development

```bash
composer run dev
```

Satu perintah ini menjalankan empat proses sekaligus:

| Proses | Perintah | Fungsi |
| --- | --- | --- |
| server | `php artisan serve` | Aplikasi di `http://localhost:8000` |
| reverb | `php artisan reverb:start` | WebSocket di port `8080`, dibutuhkan untuk signaling WebRTC |
| queue | `php artisan queue:listen` | Worker queue |
| vite | `npm run dev` | Hot reload frontend |

Agar rekaman bisa diputar, buat symlink storage sekali saja:

```bash
php artisan storage:link
```

## Mencoba Interview di Satu Komputer

1. Buka dua jendela browser yang **berbeda session**, misalnya satu jendela normal dan satu Incognito.
2. Jendela 1: login sebagai interviewer, buka `/rooms`, lalu klik **Create room**. Catat kodenya.
3. Jendela 2: login sebagai applicant, buka `/rooms`, masukkan kode, lalu klik **Join**.
4. Interviewer klik **Start call**.
5. Applicant bicara. Transkrip muncul, lalu klik **Kirim Pesan ke AI** untuk mendapat balasan AI (dummy).

Kamera dan mic hanya diizinkan di `localhost` atau HTTPS. Untuk mencoba dari HP atau komputer lain di jaringan yang sama, butuh HTTPS (misalnya lewat tunnel).

## Variabel `.env` Penting

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `DB_CONNECTION` | `sqlite` | Ganti ke `pgsql` / `mysql` untuk server |
| `BROADCAST_CONNECTION` | `reverb` | WebSocket untuk signaling |
| `REVERB_APP_KEY`, `REVERB_HOST`, `REVERB_PORT` | `local-key`, `127.0.0.1`, `8080` | Juga diteruskan ke frontend lewat `VITE_REVERB_*` |
| `SESSION_DRIVER`, `CACHE_STORE`, `QUEUE_CONNECTION` | `database` | |
| `AI_PROVIDER` | `fake` | `fake` = balasan dummy, `qwen` = Alibaba Qwen |
| `DASHSCOPE_API_KEY` | kosong | API key Qwen. **Jangan di-commit** |
| `QWEN_BASE_URL` | endpoint internasional (Singapura) | Ganti ke endpoint China jika akunnya region China |
| `QWEN_MODEL` | `qwen-plus` | |
| `QWEN_TIMEOUT` | `30` | Detik |
| `INTERVIEW_HISTORY_LIMIT` | `30` | Jumlah pesan terakhir yang dikirim ke AI |

Setelah mengubah `.env`, jalankan:

```bash
php artisan config:clear
```

Batas upload rekaman (200 MB) juga bergantung pada `upload_max_filesize` dan `post_max_size` di `php.ini`. Kalau batas PHP lebih kecil, upload akan gagal dengan error 413.

## Testing & Kualitas Kode

| Perintah | Fungsi |
| --- | --- |
| `php artisan test` | Menjalankan seluruh tes Pest. AI selalu memakai provider `fake` (diatur di `phpunit.xml`) |
| `composer run lint` | Merapikan format PHP (Pint) |
| `composer run types:check` | Analisis statis PHP (PHPStan) |
| `npm run types:check` | Typecheck TypeScript |
| `npm run check` | Lint & format frontend (`vp check`) |
| `composer run ci:check` | Semua pemeriksaan di atas, sama seperti CI |

CI GitHub Actions ada di [.github/workflows/tests.yml](../.github/workflows/tests.yml).
