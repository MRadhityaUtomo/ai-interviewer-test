# ai-int-test

Platform interview kerja online berbasis Laravel 13 + Inertia React: video call interviewer–applicant, speech-to-text, proctoring, rekaman, dan AI interviewer (Alibaba Qwen, saat ini masih memakai provider dummy).

## Mulai Cepat

Butuh Docker Desktop. Seluruh stack (app, Reverb, queue, Vite, PostgreSQL, Redis) jalan lewat `compose.yaml`.

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec laravel.test php artisan key:generate
docker compose exec laravel.test php artisan migrate --seed
docker compose exec laravel.test php artisan storage:link
```

Buka `http://localhost:8000`. Akun demo ada di `database/seeders/DatabaseSeeder.php`. Selanjutnya cukup `docker compose up -d`. Detail ada di [docs/SETUP.md](docs/SETUP.md).

## Dokumentasi

Lihat folder [docs/](docs/README.md):

- [Roadmap](docs/ROADMAP.md)
- [Arsitektur & struktur folder](docs/ARCHITECTURE.md)
- [Flow diagram](docs/FLOWS.md)
- [Database](docs/DATABASE.md)
- [Routes & endpoint](docs/ROUTES.md)
- [Setup & testing](docs/SETUP.md)
- [Integrasi AI (Qwen)](docs/AI_INTEGRATION.md)
- [Known issues](docs/KNOWN_ISSUES.md)
