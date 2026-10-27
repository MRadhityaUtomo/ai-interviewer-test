<?php

namespace Tests\Feature;

use App\Models\InterviewMessage;
use App\Models\InterviewRoom;
use App\Models\User;
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
            ->post(route('rooms.send-message', $room->room_code), [
                'message' => '',
            ]);

        $response->assertSessionHasErrors(['message']);
    }
}

