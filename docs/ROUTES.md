# Routes & Endpoint

Sumber: [routes/web.php](../routes/web.php), [routes/settings.php](../routes/settings.php), dan route bawaan Fortify. Daftar lengkap bisa dilihat dengan:

```bash
php artisan route:list --except-vendor
```

Tipe respons: **Inertia** merender halaman React, **Redirect** mengarahkan ke halaman lain, **JSON** dipanggil lewat `fetch` dari hook.

## Room Interview (wajib login)

| Method | URL | Controller | Respons | Keterangan |
| --- | --- | --- | --- | --- |
| GET | `/rooms` | `RoomController@index` | Inertia `room/index` | Buat room atau join |
| POST | `/rooms` | `RoomController@create` | Redirect | Hanya interviewer. Membuat room baru |
| POST | `/room/join` | `RoomController@join` | Redirect | Hanya applicant. Body: `room_code` (6 karakter) |
| GET | `/rooms/{roomCode}` | `RoomController@show` | Inertia `room/show` / `room/full` | Menambahkan `participant_token` jika belum ada |
| POST | `/rooms/{roomCode}/send-message` | `RoomController@sendMessage` | Redirect | Body: `message` (≤2000). Applicant mendapat balasan AI |
| POST | `/room/{roomCode}/send-message` | sama | Redirect | Alias lama |
| POST | `/rooms/{roomCode}/signals` | `WebRTCSignalController@store` | JSON | Body: `type` (`offer`/`answer`/`ice-candidate`/`left_room`), `data` |
| POST | `/rooms/{roomCode}/presence/heartbeat` | `RoomPresenceController@heartbeat` | JSON 200 / 409 | Body: `participant_token` |
| POST | `/rooms/{roomCode}/presence/leave` | `RoomPresenceController@leave` | JSON | Body: `participant_token` |
| POST | `/rooms/{roomCode}/violations` | `RoomViolationController@store` | JSON | Hanya applicant. Body: `event_type` (`tab_hidden`/`window_blurred`) |
| GET | `/rooms/{roomCode}/recordings` | `InterviewRecordingController@index` | JSON | Daftar rekaman room |
| POST | `/rooms/{roomCode}/recordings` | `InterviewRecordingController@store` | JSON 201 | Multipart: `recording` (≤200MB), `duration` |
| GET | `/recordings/{recording}/stream` | `InterviewRecordingController@stream` | Video | Putar langsung di browser |
| GET | `/recordings/{recording}/download` | `InterviewRecordingController@download` | File | |
| POST | `/rooms/{roomCode}/analyze-audio` | `InterviewRecordingController@analyzeAudio` | JSON | Multipart: `audio` (≤100MB). Saat ini hanya disimpan |
| POST | `/room/analyze-audio` | sama | JSON | Body tambahan opsional: `room_code` |

## Prototype Interview Lama (tanpa login)

| Method | URL | Keterangan |
| --- | --- | --- |
| GET | `/interview` | 3 pertanyaan tetap, state di session |
| POST | `/interview/message` | Body: `answer` |
| POST | `/interview/reset` | Mengulang prototype |

Prototype ini terpisah dari room dan belum memakai `AiProviderInterface`.

## Umum & Akun

| Method | URL | Keterangan |
| --- | --- | --- |
| GET | `/` | Redirect ke `/dashboard` |
| GET | `/dashboard` | Dashboard |
| GET/PATCH/DELETE | `/settings/profile` | Profil |
| GET | `/settings/security` | Password, 2FA, passkey (wajib konfirmasi password) |
| PUT | `/settings/password` | Ganti password (throttle 6/menit) |
| GET | `/settings/appearance` | Tema |
| * | `/login`, `/register`, `/forgot-password`, `/two-factor-challenge`, … | Route Fortify |

## Channel WebSocket (Reverb)

| Channel | Tipe | Event | Payload |
| --- | --- | --- | --- |
| `room.{CODE}` | **Publik** | `WebRTCSignal` | `{ room_code, type, data }`. `type`: `offer`, `answer`, `ice-candidate`, `left_room`, `violation_warning` |
| `App.Models.User.{id}` | Privat | (belum dipakai) | Hanya user ybs |

Signal dikirim `toOthers()`, sehingga pengirim tidak menerima pesannya sendiri (lewat header `X-Socket-ID`).
