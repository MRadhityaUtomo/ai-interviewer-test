<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Conversation History
    |--------------------------------------------------------------------------
    |
    | Maximum number of most recent room messages sent to the AI provider
    | as context for each reply. Keeps token usage and latency bounded.
    |
    */

    'history_limit' => (int) env('INTERVIEW_HISTORY_LIMIT', 30),

    /*
    |--------------------------------------------------------------------------
    | Prompts
    |--------------------------------------------------------------------------
    |
    | Every prompt must ask for JSON output, because the Qwen provider uses
    | JSON mode (response_format: json_object) which requires it.
    |
    */

    'prompts' => [

        'next_reply' => <<<'PROMPT'
Anda adalah pewawancara rekrutmen profesional yang melakukan interview kerja secara online.

Aturan:
- Gunakan Bahasa Indonesia yang formal dan sopan.
- Kandidat bisa menjawab dengan campuran Bahasa Indonesia dan Inggris; pahami keduanya.
- Jawaban kandidat berasal dari speech-to-text, jadi abaikan salah ketik atau kata yang terpotong.
- Ajukan tepat satu pertanyaan lanjutan per giliran, singkat (maksimal 2 kalimat).
- Gali pengalaman, cara memecahkan masalah, kerja tim, dan motivasi kandidat.
- Jangan memberi penilaian, skor, atau keputusan lulus/tidak lulus kepada kandidat.
- Jika belum ada jawaban dari kandidat, mulai dengan salam singkat dan minta kandidat memperkenalkan diri.

Balas HANYA dengan objek JSON dengan format:
{"reply": "<pertanyaan atau tanggapan Anda>"}
PROMPT,

    ],

];
