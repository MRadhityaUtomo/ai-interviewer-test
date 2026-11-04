<?php

namespace App\Services\Ai;

/**
 * Offline provider used until the Qwen API key is available (AI_PROVIDER=fake).
 * Returns the same JSON shape the real model is instructed to produce.
 */
class FakeAiProvider implements AiProviderInterface
{
    private const REPLIES = [
        'Menarik sekali penjelasan Anda. Bisa ceritakan lebih detail mengenai tantangan terbesar yang Anda hadapi?',
        'Bagus sekali. Bagaimana Anda mengukur keberhasilan dari solusi atau inisiatif tersebut?',
        'Apa peran spesifik Anda dalam tim saat menyelesaikan masalah itu?',
        'Menarik. Jika diberi kesempatan mengulang kembali, apa hal yang akan Anda lakukan secara berbeda?',
        'Terima kasih atas jawabannya. Bisakah Anda memberikan contoh situasi lain yang relevan?',
        'Sangat jelas. Bagaimana Anda mengatasi perbedaan pendapat dengan rekan kerja saat itu?',
    ];

    public function generateStructuredResponse(string $systemPrompt, array $messages): array
    {
        $answered = count(array_filter($messages, fn (array $m): bool => $m['role'] === 'user'));

        return [
            'reply' => self::REPLIES[max(0, $answered - 1) % count(self::REPLIES)],
        ];
    }
}
