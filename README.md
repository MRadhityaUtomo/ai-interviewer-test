# ai-int-test

Platform interview kerja online berbasis Laravel 13 + Inertia React: video call interviewer–applicant, speech-to-text, proctoring, rekaman, dan AI interviewer (Alibaba Qwen, saat ini masih memakai provider dummy).

## Mulai Cepat

```bash
composer run setup
php artisan db:seed
php artisan storage:link
composer run dev
```

Buka `http://localhost:8000`. Akun demo ada di `database/seeders/DatabaseSeeder.php`.

## Dokumentasi

Lihat folder [docs/](docs/README.md):

- [Arsitektur & struktur folder](docs/ARCHITECTURE.md)
- [Flow diagram](docs/FLOWS.md)
- [Database](docs/DATABASE.md)
- [Routes & endpoint](docs/ROUTES.md)
- [Setup & testing](docs/SETUP.md)
- [Integrasi AI (Qwen)](docs/AI_INTEGRATION.md)
- [Known issues](docs/KNOWN_ISSUES.md)
