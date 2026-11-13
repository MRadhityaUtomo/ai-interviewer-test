<?php

namespace Tests\Feature;

use App\Models\InterviewRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class WebRTCSignalTest extends TestCase
{
    use RefreshDatabase;

    public function test_signals_are_broadcast_immediately_without_the_queue(): void
    {
        Queue::fake();

        $interviewer = User::factory()->create(['role' => 'interviewer']);
        $room = InterviewRoom::create([
            'room_code' => 'SIG001',
            'status' => 'active',
            'user_id' => $interviewer->id,
        ]);

        $this->actingAs($interviewer)
            ->enterRoom($room)
            ->postJson(route('rooms.signals.store', $room->room_code), [
                'type' => 'offer',
                'data' => ['type' => 'offer', 'sdp' => 'v=0'],
            ])
            ->assertOk();

        // WebRTC signaling must not wait for a queue worker.
        Queue::assertNothingPushed();
    }

    public function test_applicant_cannot_send_an_offer(): void
    {
        $applicant = User::factory()->create(['role' => 'applicant']);
        $room = InterviewRoom::create([
            'room_code' => 'SIG002',
            'status' => 'active',
            'user_id' => $applicant->id,
        ]);

        $this->actingAs($applicant)
            ->enterRoom($room)
            ->postJson(route('rooms.signals.store', $room->room_code), [
                'type' => 'offer',
                'data' => ['sdp' => 'v=0'],
            ])
            ->assertForbidden();
    }
}
