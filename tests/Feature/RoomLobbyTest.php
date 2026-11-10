<?php

namespace Tests\Feature;

use App\Models\InterviewRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RoomLobbyTest extends TestCase
{
    use RefreshDatabase;

    private function room(User $owner, string $code = 'LOB001', string $status = 'active'): InterviewRoom
    {
        return InterviewRoom::create([
            'room_code' => $code,
            'status' => $status,
            'user_id' => $owner->id,
        ]);
    }

    public function test_creating_a_room_leads_to_its_lobby(): void
    {
        $interviewer = User::factory()->create(['role' => 'interviewer']);

        $response = $this->actingAs($interviewer)->post(route('rooms.create'));

        $room = InterviewRoom::firstOrFail();
        $response->assertRedirect(route('rooms.lobby', $room->room_code));
    }

    public function test_joining_a_room_leads_to_its_lobby(): void
    {
        $interviewer = User::factory()->create(['role' => 'interviewer']);
        $applicant = User::factory()->create(['role' => 'applicant']);
        $room = $this->room($interviewer);

        $this->actingAs($applicant)
            ->post(route('room.join'), ['room_code' => 'lob001'])
            ->assertRedirect(route('rooms.lobby', $room->room_code));
    }

    public function test_lobby_renders_for_the_applicant_without_taking_a_participant_slot(): void
    {
        $interviewer = User::factory()->create(['role' => 'interviewer']);
        $applicant = User::factory()->create(['role' => 'applicant']);
        $room = $this->room($interviewer);

        $this->actingAs($applicant)
            ->get(route('rooms.lobby', 'lob001'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('room/lobby')
                ->where('roomCode', 'LOB001')
                ->where('participantRole', 'applicant'));

        $this->assertNull(Cache::get("interview-room-presence:{$room->room_code}"));
    }

    public function test_lobby_renders_for_the_owning_interviewer(): void
    {
        $interviewer = User::factory()->create(['role' => 'interviewer']);
        $this->room($interviewer);

        $this->actingAs($interviewer)
            ->get(route('rooms.lobby', 'LOB001'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('participantRole', 'interviewer'));
    }

    public function test_another_interviewer_cannot_open_the_lobby(): void
    {
        $owner = User::factory()->create(['role' => 'interviewer']);
        $other = User::factory()->create(['role' => 'interviewer']);
        $this->room($owner);

        $this->actingAs($other)->get(route('rooms.lobby', 'LOB001'))->assertForbidden();
    }

    public function test_a_closed_room_has_no_lobby(): void
    {
        $interviewer = User::factory()->create(['role' => 'interviewer']);
        $this->room($interviewer, status: 'closed');

        $this->actingAs($interviewer)->get(route('rooms.lobby', 'LOB001'))->assertNotFound();
    }
}
