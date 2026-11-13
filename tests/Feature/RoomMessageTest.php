<?php

namespace Tests\Feature;

use App\Models\InterviewMessage;
use App\Models\InterviewRoom;
use App\Models\User;
use App\Services\Ai\AiProviderInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoomMessageTest extends TestCase
{
    use RefreshDatabase;

    public function test_applicant_can_send_transcript_message_and_receive_simulated_ai_reply(): void
    {
        $applicant = User::factory()->create(['role' => 'applicant']);
        $room = InterviewRoom::create([
            'room_code' => 'ABC123',
            'status' => 'active',
            'user_id' => $applicant->id,
        ]);

        $response = $this->actingAs($applicant)
            ->enterRoom($room)
            ->post(route('rooms.send-message', $room->room_code), [
                'message' => 'Halo, saya memiliki pengalaman 3 tahun sebagai Fullstack Engineer.',
            ]);

        $response->assertStatus(302);

        $this->assertTrue(
            InterviewMessage::where('room_code', 'ABC123')->where('role', 'applicant')->exists()
        );
        $this->assertTrue(
            InterviewMessage::where('room_code', 'ABC123')->where('role', 'ai_assistant')->exists()
        );
    }

    public function test_message_field_is_required_when_sending_room_message(): void
    {
        $applicant = User::factory()->create(['role' => 'applicant']);
        $room = InterviewRoom::create([
            'room_code' => 'TEST99',
            'status' => 'active',
            'user_id' => $applicant->id,
        ]);

        $response = $this->actingAs($applicant)
            ->enterRoom($room)
            ->post(route('rooms.send-message', $room->room_code), [
                'message' => '',
            ]);

        $response->assertSessionHasErrors(['message']);
    }

    public function test_interviewer_message_is_stored_as_interviewer_without_ai_reply(): void
    {
        $interviewer = User::factory()->create(['role' => 'interviewer']);
        $room = InterviewRoom::create([
            'room_code' => 'INT001',
            'status' => 'active',
            'user_id' => $interviewer->id,
        ]);

        $this->actingAs($interviewer)
            ->enterRoom($room)
            ->post(route('rooms.send-message', $room->room_code), [
                'message' => 'Catatan: kandidat menjawab dengan jelas.',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(
            ['interviewer'],
            InterviewMessage::where('room_code', 'INT001')->pluck('role')->all(),
        );
    }

    public function test_ai_history_excludes_interviewer_messages(): void
    {
        $fake = new class implements AiProviderInterface
        {
            /** @var array<int, array{role: string, content: string}> */
            public array $received = [];

            public function generateStructuredResponse(string $systemPrompt, array $messages): array
            {
                $this->received = $messages;

                return ['reply' => 'Pertanyaan berikutnya.'];
            }
        };
        $this->app->instance(AiProviderInterface::class, $fake);

        $interviewer = User::factory()->create(['role' => 'interviewer']);
        $applicant = User::factory()->create(['role' => 'applicant']);
        $room = InterviewRoom::create([
            'room_code' => 'INT002',
            'status' => 'active',
            'user_id' => $interviewer->id,
        ]);

        $this->actingAs($interviewer)->enterRoom($room)->post(route('rooms.send-message', $room->room_code), [
            'message' => 'Catatan interviewer.',
        ]);
        $this->actingAs($applicant)->enterRoom($room)->post(route('rooms.send-message', $room->room_code), [
            'message' => 'Jawaban kandidat.',
        ]);

        $this->assertSame([['role' => 'user', 'content' => 'Jawaban kandidat.']], $fake->received);
    }
}
