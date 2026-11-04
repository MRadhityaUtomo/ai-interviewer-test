<?php

namespace App\Services\Ai;

use App\Models\InterviewRoom;

class InterviewAiService
{
    public function __construct(private readonly AiProviderInterface $provider) {}

    /**
     * Generate the interviewer's next reply based on the room's message history.
     *
     * @throws AiProviderException
     */
    public function nextReply(InterviewRoom $room): string
    {
        $history = $room->messages()
            ->latest('id')
            ->limit((int) config('interview.history_limit'))
            ->get(['role', 'message'])
            ->reverse()
            ->map(fn ($m): array => [
                'role' => $m->role === 'ai_assistant' ? 'assistant' : 'user',
                'content' => $m->message,
            ])
            ->values()
            ->all();

        $result = $this->provider->generateStructuredResponse(
            config('interview.prompts.next_reply'),
            $history,
        );

        $reply = $result['reply'] ?? null;

        if (! is_string($reply) || trim($reply) === '') {
            throw new AiProviderException('AI response is missing a "reply" string.');
        }

        return trim($reply);
    }
}
