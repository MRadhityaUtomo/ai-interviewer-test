<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Alibaba Cloud Model Studio (DashScope) via its OpenAI-compatible endpoint.
 */
class QwenProvider implements AiProviderInterface
{
    public function __construct(
        private readonly ?string $apiKey,
        private readonly string $baseUrl,
        private readonly string $model,
        private readonly int $timeout,
    ) {}

    public function generateStructuredResponse(string $systemPrompt, array $messages): array
    {
        if (blank($this->apiKey)) {
            throw new AiProviderException('DASHSCOPE_API_KEY is not configured.');
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->acceptJson()
                ->timeout($this->timeout)
                ->retry(2, 500, fn (Throwable $e): bool => $e instanceof ConnectionException
                    || ($e instanceof RequestException && in_array($e->response->status(), [429, 500, 502, 503, 504], true)), throw: false)
                ->post(rtrim($this->baseUrl, '/').'/chat/completions', [
                    'model' => $this->model,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ...$messages,
                    ],
                    // JSON mode: the prompt itself must also mention "JSON".
                    'response_format' => ['type' => 'json_object'],
                    'temperature' => 0.7,
                ]);
        } catch (ConnectionException $e) {
            throw new AiProviderException('Qwen request failed: '.$e->getMessage(), previous: $e);
        }

        if ($response->failed()) {
            // Log status and provider error code only; never the prompt or applicant answers.
            Log::warning('Qwen request failed', [
                'status' => $response->status(),
                'code' => $response->json('error.code') ?? $response->json('code'),
            ]);

            throw new AiProviderException("Qwen returned HTTP {$response->status()}.");
        }

        $content = $response->json('choices.0.message.content');
        $decoded = is_string($content) ? json_decode($content, true) : null;

        if (! is_array($decoded)) {
            throw new AiProviderException('Qwen returned a non-JSON message.');
        }

        return $decoded;
    }
}
