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

class QwenProviderTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';

    private function provider(?string $apiKey = 'test-key'): QwenProvider
    {
        return new QwenProvider($apiKey, 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'qwen-plus', 5);
    }

    private function completion(string $content): array
    {
        return ['choices' => [['message' => ['role' => 'assistant', 'content' => $content]]]];
    }

    public function test_it_sends_openai_compatible_request_and_decodes_json_content(): void
    {
        Http::fake([self::URL => Http::response($this->completion('{"reply":"Ceritakan pengalaman Anda."}'))]);

        $result = $this->provider()->generateStructuredResponse('system prompt JSON', [
            ['role' => 'user', 'content' => 'Halo'],
        ]);

        $this->assertSame(['reply' => 'Ceritakan pengalaman Anda.'], $result);

        Http::assertSent(fn (Request $request): bool => $request->hasHeader('Authorization', 'Bearer test-key')
            && $request['model'] === 'qwen-plus'
            && $request['response_format'] === ['type' => 'json_object']
            && $request['messages'][0] === ['role' => 'system', 'content' => 'system prompt JSON']
            && $request['messages'][1] === ['role' => 'user', 'content' => 'Halo']);
    }

    public function test_it_throws_when_content_is_not_json(): void
    {
        Http::fake([self::URL => Http::response($this->completion('bukan json'))]);

        $this->expectException(AiProviderException::class);

        $this->provider()->generateStructuredResponse('JSON', []);
    }

    public function test_it_throws_on_http_error(): void
    {
        Http::fake([self::URL => Http::response(['error' => ['code' => 'invalid_api_key']], 401)]);

        $this->expectException(AiProviderException::class);

        $this->provider()->generateStructuredResponse('JSON', []);
    }

    public function test_it_throws_without_api_key(): void
    {
        Http::fake();

        $this->expectException(AiProviderException::class);

        try {
            $this->provider(null)->generateStructuredResponse('JSON', []);
        } finally {
            Http::assertNothingSent();
        }
    }

    public function test_room_message_uses_qwen_reply_and_history(): void
    {
        config(['services.ai.provider' => 'qwen', 'services.qwen.api_key' => 'test-key']);
        Http::fake([self::URL => Http::response($this->completion('{"reply":"Apa peran Anda di tim?"}'))]);

        $applicant = User::factory()->create(['role' => 'applicant']);
        $room = InterviewRoom::create(['room_code' => 'QWEN01', 'status' => 'active', 'user_id' => $applicant->id]);

        $this->actingAs($applicant)
            ->post(route('rooms.send-message', $room->room_code), ['message' => 'Saya backend engineer.'])
            ->assertSessionHasNoErrors();

        $this->assertInstanceOf(QwenProvider::class, app(AiProviderInterface::class));
        $this->assertSame(
            'Apa peran Anda di tim?',
            InterviewMessage::where('room_code', 'QWEN01')->where('role', 'ai_assistant')->value('message'),
        );
        Http::assertSent(fn (Request $request): bool => end($request->data()['messages']) === [
            'role' => 'user', 'content' => 'Saya backend engineer.',
        ]);
    }

    public function test_provider_failure_keeps_applicant_message_and_returns_error(): void
    {
        config(['services.ai.provider' => 'qwen', 'services.qwen.api_key' => 'test-key']);
        Http::fake([self::URL => Http::response([], 500)]);

        $applicant = User::factory()->create(['role' => 'applicant']);
        $room = InterviewRoom::create(['room_code' => 'QWEN02', 'status' => 'active', 'user_id' => $applicant->id]);

        $this->actingAs($applicant)
            ->post(route('rooms.send-message', $room->room_code), ['message' => 'Jawaban saya.'])
            ->assertSessionHasErrors(['message']);

        $this->assertTrue(InterviewMessage::where('room_code', 'QWEN02')->where('role', 'applicant')->exists());
        $this->assertFalse(InterviewMessage::where('room_code', 'QWEN02')->where('role', 'ai_assistant')->exists());
    }
}
