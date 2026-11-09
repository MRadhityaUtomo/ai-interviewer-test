# Setup & Menjalankan Proyek

Cara utama menjalankan proyek ini adalah **Docker**. Semua proses (web, WebSocket, queue, Vite, PostgreSQL, Redis) hidup dengan satu perintah.

## Kebutuhan

- **Docker Desktop** (Windows/macOS) atau Docker Engine + Compose (Linux)
- Tidak perlu PHP, Composer, atau Node di host. Semuanya ada di dalam image. PHP dan Node di host hanya dibutuhkan untuk menjalankan tes atau alur tanpa Docker.
- Browser **Chrome atau Edge**. Web Speech API (STT) paling stabil di browser berbasis Chromium.

## Menjalankan dengan Docker (direkomendasikan)

### Instalasi pertama

```bash
cp .env.example .env
```

```bash
docker compose up -d --build
```

Start pertama memakan beberapa menit: build image, `composer install`, dan `npm ci` ke dalam volume. Pantau dengan `docker compose logs -f`. Setelah `laravel.test` berstatus *healthy*, siapkan aplikasi:

```bash
docker compose exec laravel.test php artisan key:generate
```

```bash
docker compose exec laravel.test php artisan migrate --seed
```

```bash
docker compose exec laravel.test php artisan storage:link
```

Buka **http://localhost:8000**. Seeder membuat dua akun terverifikasi, yaitu **interviewer** dan **applicant**. Email dan password-nya ada di [database/seeders/DatabaseSeeder.php](../database/seeders/DatabaseSeeder.php).

### Membuat akun interviewer

Registrasi lewat halaman web selalu menghasilkan akun **applicant**. Akun interviewer dibuat lewat perintah ini (akun langsung terverifikasi):

```bash
docker compose exec laravel.test php artisan interviewer:create
```

Perintah ini menanyakan email, nama, dan password. Untuk script atau deploy, semuanya bisa diberikan sekaligus:

```bash
docker compose exec laravel.test php artisan interviewer:create --name="Rina HR" --email=rina@example.com --password=rahasia123
```

Kalau email sudah terdaftar sebagai applicant, perintah ini menawarkan untuk mengubahnya menjadi interviewer. Tanpa mode interaktif, tambahkan `--promote`:

```bash
docker compose exec laravel.test php artisan interviewer:create --email=rina@example.com --promote
```

### Sehari-hari

| Kebutuhan | Perintah |
| --- | --- |
| Menyalakan semua service | `docker compose up -d` |
| Mematikan | `docker compose down` |
| Melihat log (semua / satu service) | `docker compose logs -f` / `docker compose logs -f vite` |
| Menjalankan artisan | `docker compose exec laravel.test php artisan <perintah>` |
| Restart setelah ubah kode Reverb/event | `docker compose restart reverb queue` |
| Setelah ubah `composer.json` | `docker compose exec laravel.test composer install` |
| Setelah ubah `package.json` | `docker compose run --rm vite npm ci`, lalu `docker compose restart vite` |
| Setelah ubah `docker/Dockerfile` atau `docker/php.ini` | `docker compose up -d --build` |
| Reset database (hapus semua data) | `docker compose exec laravel.test php artisan migrate:fresh --seed` |

### Service di `compose.yaml`

| Service | Isi | Port di host |
| --- | --- | --- |
| `laravel.test` | `php artisan serve` (aplikasi) | `8000` (`APP_PORT`) |
| `reverb` | `php artisan reverb:start` (WebSocket signaling) | `8080` (`FORWARD_REVERB_PORT`) |
| `queue` | `php artisan queue:listen` | — |
| `vite` | `npm run dev` (hot reload) | `5173` (`VITE_PORT`) |
| `pgsql` | PostgreSQL 18 | `5433` (`FORWARD_DB_PORT`) |
| `redis` | Redis: session, cache (termasuk presence room), dan queue | `6379` (`FORWARD_REDIS_PORT`) |

Semua service PHP memakai satu image `ai-int-test/app` dari [docker/Dockerfile](../docker/Dockerfile): PHP 8.4 (sama dengan versi di host), ekstensi `pdo_pgsql`, `redis`, `intl`, `pcntl`, opcache, Composer, dan Node 24.

Catatan konfigurasi:
- **Kenapa bukan image Sail bawaan?** Image Sail mengunduh ratusan paket lewat `http://archive.ubuntu.com`, yang terblokir atau tidak stabil dari jaringan ini. Image sendiri jauh lebih kecil (build sekitar 1 menit), dan unduhan apt-nya lewat HTTPS.
- **Satu `.env` untuk dua dunia.** `.env` berisi alamat dari sisi host (`127.0.0.1:5433`), sedangkan `compose.yaml` menimpa `DB_HOST`, `REDIS_HOST`, dan `REVERB_HOST` dengan nama service Docker (`pgsql`, `redis`, `reverb`) untuk container PHP. Agar override ini tidak hilang, `artisan serve` dijalankan dengan `--no-reload`, jadi perubahan `.env` baru terbaca setelah container di-restart.
- **Port 5433, bukan 5432**, supaya tidak bentrok dengan PostgreSQL yang terpasang langsung di Windows. Aplikasi memakai port 8000 karena port 80 di host sudah terpakai. Ubah lewat variabel di tabel di atas jika perlu.
- **`vendor` dan `node_modules` ada di volume Docker** (`vendor`, `node-modules`), bukan di folder Windows. Membaca `vendor` lewat mount Windows membuat setiap request butuh ~9 detik, sedangkan dengan volume hanya ~0,3 detik. `node_modules` di Windows juga berisi binary khusus Windows. Folder `vendor`/`node_modules` di host tetap dipakai editor untuk autocomplete.
- Vite memakai *polling* (`VITE_USE_POLLING`) agar perubahan file dari Windows terdeteksi.
- **Batas upload PHP** di container dinaikkan ke 256 MB lewat [docker/php.ini](../docker/php.ini).
- Data PostgreSQL tersimpan di volume `pgsql-data`, jadi tetap ada setelah `docker compose down`. Untuk menghapusnya: `docker compose down -v` (ini juga menghapus volume `vendor` dan `node-modules`, yang akan diinstal ulang otomatis).

### Akses database dari host

| Field | Nilai |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `5433` |
| Database | `ai_int_test` |
| User / password | `sail` / `password` (lihat `.env`) |

Bisa dibuka dengan DBeaver, TablePlus, pgAdmin, atau `psql -h 127.0.0.1 -p 5433 -U sail ai_int_test`.

### Keterbatasan

- **Vite butuh 1–3 menit setelah start** untuk mengompilasi aset di latar belakang (`server.warmup` di `vite.config.ts`). Pantau dengan `docker compose logs -f vite`. Kalau halaman dibuka sebelum selesai, layar bisa **hitam/kosong** selama proses itu; tunggu sebentar lalu refresh. Setelah siap, halaman tampil dalam ~3 detik.
- **Layar hitam terus-menerus** biasanya berarti container `vite` tidak jalan (cek `docker compose ps`), atau Chrome masih menyimpan modul lama. Solusinya: `docker compose up -d`, lalu hard refresh dengan `Ctrl+Shift+R`.
- Selalu jalankan `docker compose up -d` **tanpa nama service**, supaya semua service ikut hidup.
- Kamera dan mic tetap diakses oleh browser di Windows, bukan oleh Docker, jadi video call dan STT bekerja seperti biasa di `http://localhost:8000`.
- Kalau proyek dipindah ke filesystem WSL (`\\wsl$\Ubuntu\...`), seluruh stack akan lebih cepat lagi, tapi saat ini tidak wajib.

## Alternatif: Tanpa Docker

Masih bisa memakai `composer run dev`, yang menjalankan server, Reverb, queue, dan Vite dalam satu perintah. Database tetap PostgreSQL di Docker:

```bash
docker compose up -d pgsql redis
```

```bash
composer run dev
```

Syarat: PHP di host harus punya ekstensi **`pdo_pgsql`**. Di Windows, aktifkan `extension=pdo_pgsql` dan `extension=pgsql` di `php.ini`. Jalankan juga `npm install` di host.

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
| `DB_CONNECTION`, `DB_HOST`, `DB_PORT` | `pgsql`, `127.0.0.1`, `5433` | PostgreSQL di Docker. Container memakai `pgsql:5432` |
| `APP_PORT`, `FORWARD_DB_PORT`, `FORWARD_REVERB_PORT`, `VITE_PORT` | `8000`, `5433`, `8080`, `5173` | Port di host untuk `docker compose` |
| `BROADCAST_CONNECTION` | `reverb` | WebSocket untuk signaling |
| `REVERB_APP_KEY`, `REVERB_HOST`, `REVERB_PORT` | `local-key`, `127.0.0.1`, `8080` | Juga diteruskan ke frontend lewat `VITE_REVERB_*` |
| `SESSION_DRIVER`, `CACHE_STORE`, `QUEUE_CONNECTION` | `redis` | Container memakai host `redis`, dari host `127.0.0.1:6379`. Signal WebRTC tidak lewat queue |
| `AI_PROVIDER` | `fake` | `fake` = balasan dummy, `qwen` = Alibaba Qwen |
| `DASHSCOPE_API_KEY` | kosong | API key Qwen. **Jangan di-commit** |
| `QWEN_BASE_URL` | endpoint internasional (Singapura) | Ganti ke endpoint China jika akunnya region China |
| `QWEN_MODEL` | `qwen-plus` | |
| `QWEN_TIMEOUT` | `30` | Detik |
| `INTERVIEW_HISTORY_LIMIT` | `30` | Jumlah pesan terakhir yang dikirim ke AI |

Setelah mengubah `.env`, restart container agar nilainya terbaca:

```bash
docker compose up -d --force-recreate
```

Batas upload rekaman (200 MB) juga bergantung pada `upload_max_filesize` dan `post_max_size` di PHP. Di Docker sudah diatur 256 MB. Kalau menjalankan tanpa Docker dan batas PHP lebih kecil, upload akan gagal dengan error 413.

## Testing & Kualitas Kode

| Perintah | Fungsi |
| --- | --- |
| `php artisan test` | Menjalankan seluruh tes Pest, bisa di host atau `docker compose exec laravel.test php artisan test`. Tes memakai SQLite in-memory, jadi tidak menyentuh data PostgreSQL. AI selalu memakai provider `fake` (diatur di `phpunit.xml`) |
| `composer run lint` | Merapikan format PHP (Pint) |
| `composer run types:check` | Analisis statis PHP (PHPStan) |
| `npm run types:check` | Typecheck TypeScript |
| `npm run check` | Lint & format frontend (`vp check`) |
| `composer run ci:check` | Semua pemeriksaan di atas, sama seperti CI |

CI GitHub Actions ada di [.github/workflows/tests.yml](../.github/workflows/tests.yml).
