<?php

namespace Tests\Feature;

use App\Models\InterviewMessage;
use App\Models\InterviewRoom;
use App\Models\User;
use App\Services\Ai\AiProviderException;
use App\Services\Ai\AiProviderInterface;
use App\Services\Ai\QwenProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OllamaProviderTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'http://ollama.test:11434/v1/chat/completions';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.ai.provider' => 'ollama',
            'services.ollama.base_url' => 'http://ollama.test:11434/v1',
            'services.ollama.model' => 'qwen2.5:3b',
            'services.qwen.api_key' => null,
        ]);
    }

    private function completion(string $content): array
    {
        return ['choices' => [['message' => ['role' => 'assistant', 'content' => $content]]]];
    }

    public function test_ollama_provider_needs_no_api_key_and_sends_no_authorization_header(): void
    {
        Http::fake([self::URL => Http::response($this->completion('{"reply":"Halo, silakan perkenalkan diri."}'))]);

        $provider = app(AiProviderInterface::class);
        $result = $provider->generateStructuredResponse('system prompt JSON', [['role' => 'user', 'content' => 'Halo']]);

        $this->assertInstanceOf(QwenProvider::class, $provider);
        $this->assertSame(['reply' => 'Halo, silakan perkenalkan diri.'], $result);
        Http::assertSent(fn (Request $request): bool => $request->url() === self::URL
            && ! $request->hasHeader('Authorization')
            && $request['model'] === 'qwen2.5:3b'
            && $request['response_format'] === ['type' => 'json_object']);
    }

    public function test_unreachable_ollama_raises_provider_exception(): void
    {
        Http::fake([self::URL => Http::failedConnection()]);

        $this->expectException(AiProviderException::class);
        $this->expectExceptionMessage('Ollama request failed');

        app(AiProviderInterface::class)->generateStructuredResponse('JSON', []);
    }

    public function test_room_message_gets_reply_from_ollama(): void
    {
        Http::fake([self::URL => Http::response($this->completion('{"reply":"Apa tantangan terbesar Anda?"}'))]);

        $applicant = User::factory()->create(['role' => 'applicant']);
        $room = InterviewRoom::create(['room_code' => 'OLLA01', 'status' => 'active', 'user_id' => $applicant->id]);

        $this->actingAs($applicant)
            ->enterRoom($room)
            ->post(route('rooms.send-message', $room->room_code), ['message' => 'Saya suka tantangan.'])
            ->assertSessionHasNoErrors();

        $this->assertSame(
            'Apa tantangan terbesar Anda?',
            InterviewMessage::where('room_code', 'OLLA01')->where('role', 'ai_assistant')->value('message'),
        );
    }
}
