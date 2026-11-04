# Flow Diagram

Diagram alur utama aplikasi, sesuai kode saat ini. Diagram ditulis dengan Mermaid dan dirender otomatis oleh GitHub, VS Code (ekstensi *Markdown Preview Mermaid Support*), atau [mermaid.live](https://mermaid.live).

Daftar isi:
1. [Alur bisnis end-to-end](#1-alur-bisnis-end-to-end)
2. [Login & role](#2-login--role)
3. [Membuat & join room](#3-membuat--join-room)
4. [Presence (batas 2 peserta)](#4-presence-batas-2-peserta)
5. [Signaling WebRTC](#5-signaling-webrtc)
6. [Speech-to-text → AI](#6-speech-to-text--ai)
7. [Pemilihan provider AI](#7-pemilihan-provider-ai)
8. [Proctoring applicant](#8-proctoring-applicant)
9. [Rekaman meeting](#9-rekaman-meeting)
10. [Status room](#10-status-room)

---

## 1. Alur bisnis end-to-end

Garis putus-putus menandai bagian yang belum dibuat.

```mermaid
flowchart TD
    A([Interviewer login]) --> B[Buat room<br/>kode 6 karakter]
    B --> C[Bagikan kode ke applicant]
    C --> D([Applicant login & masukkan kode])
    D --> E[Keduanya masuk room/show<br/>kamera + mic aktif]
    E --> F[Interviewer klik Start Call<br/>koneksi WebRTC terbentuk]
    F --> G[Interview berlangsung]

    G --> H[Applicant bicara<br/>STT browser → teks]
    H --> I[Kirim transkrip ke server]
    I --> J[AI membalas dengan<br/>pertanyaan lanjutan]
    J --> G

    G --> K[Proctoring: pindah tab<br/>→ peringatan ke interviewer]
    K --> G

    G --> L[Interviewer stop rekaman<br/>→ video + audio diunggah]
    L --> M([Interview selesai])

    M -.-> N[Evaluasi AI: skor,<br/>kelebihan, kekurangan]
    N -.-> O[Recruiter review hasil]
    O -.-> P{Keputusan}
    P -. Lolos .-> Q([Lanjut tahap berikutnya])
    P -. Tidak .-> R([Proses berhenti])

    classDef todo stroke-dasharray: 5 5,opacity:0.7
    class N,O,P,Q,R todo
```

## 2. Login & role

```mermaid
flowchart TD
    A([Buka aplikasi]) --> B{Sudah login?}
    B -- Belum --> C[Login / Register<br/>Fortify]
    C --> D{2FA aktif?}
    D -- Ya --> E[Two-factor challenge]
    D -- Tidak --> F
    E --> F["/dashboard"]
    B -- Sudah --> F
    F --> G["/rooms"]
    G --> H{role user}
    H -- interviewer --> I[Tombol Create room]
    H -- applicant --> J[Form kode room + Join]
```

Registrasi lewat UI selalu menghasilkan role `applicant`. Interviewer dibuat lewat seeder atau database.

## 3. Membuat & join room

```mermaid
sequenceDiagram
    autonumber
    actor IV as Interviewer
    actor AP as Applicant
    participant RC as RoomController
    participant DB as Database
    participant PS as RoomPresenceService

    IV->>RC: POST /rooms
    RC->>RC: cek role = interviewer (403 jika bukan)
    RC->>DB: buat interview_rooms (kode unik, status active)
    RC-->>IV: redirect /rooms/{CODE}

    AP->>RC: POST /room/join {room_code}
    RC->>RC: cek role = applicant
    RC->>DB: cari room aktif
    alt tidak ditemukan
        RC-->>AP: error "Room was not found or is already closed."
    else ditemukan
        RC-->>AP: redirect /rooms/{CODE}
    end

    Note over IV,AP: GET /rooms/{CODE} (untuk keduanya)
    RC->>RC: tanpa participant_token? → redirect + token acak 40 karakter
    RC->>PS: claim(room, token, role)
    alt sudah ada 2 peserta lain
        RC-->>AP: render room/full
    else diizinkan
        RC->>DB: ambil interview_messages room
        RC-->>AP: render room/show (room, role, token, messages)
    end
```

## 4. Presence (batas 2 peserta)

```mermaid
sequenceDiagram
    participant B as Browser (use-room-presence)
    participant C as RoomPresenceController
    participant S as RoomPresenceService
    participant K as Cache<br/>interview-room-presence:{CODE}

    loop setiap 15 detik selama di room
        B->>C: POST /rooms/{CODE}/presence/heartbeat {participant_token}
        C->>S: heartbeat()
        S->>K: buang peserta yang last_seen > 45 detik
        alt token baru & sudah 2 peserta
            S-->>C: allowed=false
            C-->>B: 409 → tampil "room penuh"
        else
            S->>K: simpan last_seen = sekarang
            C-->>B: 200 {allowed, count}
        end
    end

    B->>C: POST /rooms/{CODE}/presence/leave (saat keluar)
    C->>S: release() → hapus token dari cache
```

## 5. Signaling WebRTC

Server hanya meneruskan pesan. Video dan audio mengalir langsung antar-browser.

```mermaid
sequenceDiagram
    autonumber
    participant I as Browser Interviewer<br/>(caller)
    participant L as Laravel<br/>WebRTCSignalController
    participant R as Reverb<br/>channel room.{CODE}
    participant A as Browser Applicant

    Note over I,A: Keduanya subscribe channel publik room.{CODE}
    I->>I: createOffer() + setLocalDescription
    I->>L: POST /signals {type: offer, sdp}
    L->>L: validasi: offer hanya oleh interviewer
    L->>R: broadcast WebRTCSignal (toOthers)
    R-->>A: offer
    A->>A: setRemoteDescription + createAnswer
    A->>L: POST /signals {type: answer, sdp}
    L->>L: validasi: answer hanya oleh applicant
    L->>R: broadcast
    R-->>I: answer
    I->>I: setRemoteDescription

    par Pertukaran ICE candidate
        I->>L: ice-candidate
        L->>R: broadcast
        R-->>A: ice-candidate
    and
        A->>L: ice-candidate
        L->>R: broadcast
        R-->>I: ice-candidate
    end

    I<<->>A: Media P2P (video + audio)

    A->>L: left_room (saat keluar)
    L->>R: broadcast
    R-->>I: participantLeft = true
```

## 6. Speech-to-text → AI

```mermaid
sequenceDiagram
    autonumber
    actor AP as Applicant
    participant STT as Web Speech API<br/>use-speech-recognition
    participant N as jaksel-normalizer
    participant UI as room/show
    participant RC as RoomController::sendMessage
    participant DB as interview_messages
    participant AI as InterviewAiService
    participant P as AiProvider<br/>(Fake / Qwen)

    AP->>STT: berbicara
    STT-->>UI: interimTranscript (subtitle live)
    STT->>N: hasil final
    N-->>UI: liveTranscript → draft
    AP->>UI: klik Kirim Pesan ke AI (draft bisa diedit)
    UI->>RC: POST /rooms/{CODE}/send-message {message}
    RC->>DB: simpan role=applicant
    alt pengirim bukan applicant
        RC-->>UI: back() tanpa balasan AI
    else applicant
        RC->>AI: nextReply(room)
        AI->>DB: 30 pesan terakhir
        AI->>P: generateStructuredResponse(prompt, riwayat)
        alt sukses
            P-->>AI: {"reply": "..."}
            AI-->>RC: reply
            RC->>DB: simpan role=ai_assistant
            RC-->>UI: back() → Inertia memuat ulang messages
        else AiProviderException
            RC-->>UI: error "AI sedang tidak tersedia..." (pesan applicant tetap tersimpan)
        end
    end
```

## 7. Pemilihan provider AI

```mermaid
flowchart TD
    A[Container meminta AiProviderInterface] --> B{config services.ai.provider<br/>env AI_PROVIDER}
    B -- fake / default --> C[FakeAiProvider<br/>balasan dummy]
    B -- qwen --> D[QwenProvider]
    D --> E{DASHSCOPE_API_KEY ada?}
    E -- Tidak --> X[AiProviderException]
    E -- Ya --> F[POST base_url/chat/completions<br/>model, messages, response_format=json_object]
    F --> G{Respons}
    G -- 429 / 5xx / koneksi gagal --> H[Retry maksimal 2x, jeda 500ms]
    H --> F
    G -- Gagal permanen --> X
    G -- 200 --> I{content berupa JSON valid?}
    I -- Tidak --> X
    I -- Ya --> J[array hasil]
    J --> K{ada field reply string?}
    K -- Tidak --> X
    K -- Ya --> L([Balasan AI])
```

## 8. Proctoring applicant

```mermaid
sequenceDiagram
    participant A as Browser Applicant<br/>use-proctoring-events
    participant C as RoomViolationController
    participant R as Reverb
    participant I as Browser Interviewer

    A->>A: visibilitychange (hidden) / window blur
    A->>A: dedup: 1 laporan per jenis per 2 detik
    A->>C: POST /rooms/{CODE}/violations {event_type}
    C->>C: cek role = applicant, room aktif
    C->>R: broadcast violation_warning (toOthers)
    R-->>I: tampil peringatan pelanggaran
    Note over C: Pelanggaran belum disimpan ke database
```

## 9. Rekaman meeting

```mermaid
sequenceDiagram
    actor IV as Interviewer
    participant MR as use-meeting-recorder
    participant UI as room/show
    participant RC as InterviewRecordingController
    participant FS as storage/app/public
    participant DB as interview_recordings

    IV->>MR: Mulai rekam
    MR->>MR: VideoRecorder (video gabungan)<br/>+ AudioRecorder (audio terpisah)
    IV->>MR: Stop
    MR-->>UI: videoBlob, durasi, audioBlob
    UI->>RC: POST /rooms/{CODE}/recordings (≤200MB)
    RC->>FS: recordings/{CODE}/rec_....webm
    RC->>DB: simpan metadata
    IV->>UI: (opsional) klik Kirim Audio ke AI
    UI->>RC: POST /rooms/{CODE}/analyze-audio (≤100MB)
    RC->>FS: audio/{CODE}/audio_ai_....webm
    Note over RC: Audio baru disimpan, belum dianalisis AI
    UI->>RC: GET /rooms/{CODE}/recordings → daftar
    IV->>RC: GET /recordings/{id}/stream atau /download
```

## 10. Status room

```mermaid
stateDiagram-v2
    [*] --> active: Interviewer membuat room
    active --> active: peserta join/keluar
    active --> closed: (belum ada endpoint penutup)
    closed --> [*]

    note right of active
        Hanya room "active" yang bisa
        di-join, ditampilkan, dan
        menerima signal.
    end note
```

Target state machine interview yang lebih lengkap (`waiting → in_progress → evaluating → completed / failed`) ada di [AI_INTERVIEW_SPECIFICATIONS.md](../AI_INTERVIEW_SPECIFICATIONS.md) bagian 10.
