<?php

namespace App\Services\Ai;

interface AiProviderInterface
{
    /**
     * Send a system prompt plus chat history and return the decoded JSON object from the model.
     *
     * @param  array<int, array{role: 'user'|'assistant', content: string}>  $messages
     * @return array<string, mixed>
     *
     * @throws AiProviderException
     */
    public function generateStructuredResponse(string $systemPrompt, array $messages): array;
}
