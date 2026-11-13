<?php

namespace Tests\Feature;

use App\Models\InterviewRecording;
use App\Models\InterviewRoom;
use App\Models\User;
use App\Services\RoomAccessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RoomAccessTest extends TestCase
{
    use RefreshDatabase;

    private User $interviewer;

    private InterviewRoom $room;

    protected function setUp(): void
    {
        parent::setUp();

        $this->interviewer = User::factory()->create(['role' => 'interviewer']);
        $this->room = InterviewRoom::create([
            'room_code' => 'SEC001',
            'status' => 'active',
            'user_id' => $this->interviewer->id,
        ]);
    }

    private function signal(): array
    {
        return ['type' => 'left_room', 'data' => ['probe' => true]];
    }

    public function test_entering_sets_a_scoped_http_only_strict_cookie_and_no_url_token(): void
    {
        $response = $this->actingAs($this->interviewer)
            ->get(route('rooms.show', 'SEC001'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('room/show')
                ->missing('participantToken'));

        $cookie = $response->getCookie(RoomAccessService::COOKIE);

        $this->assertNotNull($cookie);
        $this->assertSame('/rooms/SEC001', $cookie->getPath());
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('strict', $cookie->getSameSite());
        $this->assertSame(64, strlen((string) $cookie->getValue()));

        // Only a hash of the token is stored
        $this->assertDatabaseMissing('interview_participants', ['token_hash' => $cookie->getValue()]);
        $this->assertDatabaseHas('interview_participants', [
            'user_id' => $this->interviewer->id,
            'token_hash' => hash('sha256', (string) $cookie->getValue()),
        ]);
    }

    public function test_room_endpoints_reject_requests_without_the_room_cookie(): void
    {
        $this->actingAs($this->interviewer)
            ->postJson(route('rooms.signals.store', 'SEC001'), $this->signal())
            ->assertForbidden();

        $this->postJson(route('rooms.presence.heartbeat', 'SEC001'))->assertForbidden();
        $this->post(route('rooms.send-message', 'SEC001'), ['message' => 'Halo'])->assertForbidden();
    }

    public function test_a_cookie_does_not_work_for_another_user(): void
    {
        $this->actingAs($this->interviewer)->enterRoom($this->room);

        $intruder = User::factory()->create(['role' => 'applicant']);

        $this->actingAs($intruder)
            ->postJson(route('rooms.signals.store', 'SEC001'), $this->signal())
            ->assertForbidden();
    }

    public function test_entering_on_another_device_invalidates_the_old_cookie(): void
    {
        $this->actingAs($this->interviewer)->enterRoom($this->room);
        $oldToken = $this->defaultCookies[RoomAccessService::COOKIE];
        $this->postJson(route('rooms.presence.heartbeat', 'SEC001'))->assertOk();

        // Same account on a fresh browser (no cookie) gets a new seat token...
        $this->defaultCookies = [];
        $this->get(route('rooms.show', 'SEC001'))->assertOk();

        // ...and the first browser's cookie stops working
        $this->withCookie(RoomAccessService::COOKIE, $oldToken)
            ->postJson(route('rooms.presence.heartbeat', 'SEC001'))
            ->assertForbidden();
    }

    public function test_the_first_applicant_locks_the_candidate_seat(): void
    {
        $first = User::factory()->create(['role' => 'applicant']);
        $second = User::factory()->create(['role' => 'applicant']);

        $this->actingAs($first)->enterRoom($this->room);

        $this->actingAs($second)
            ->get(route('rooms.show', 'SEC001'))
            ->assertInertia(fn (Assert $page) => $page->component('room/full'));
        $this->actingAs($second)
            ->get(route('rooms.lobby', 'SEC001'))
            ->assertInertia(fn (Assert $page) => $page->component('room/full'));

        // The seated applicant can come back
        $this->actingAs($first)
            ->get(route('rooms.show', 'SEC001'))
            ->assertInertia(fn (Assert $page) => $page->component('room/show'));
    }

    public function test_a_revoked_seat_cannot_be_used_or_reclaimed(): void
    {
        $applicant = User::factory()->create(['role' => 'applicant']);
        $this->actingAs($applicant)->enterRoom($this->room);

        $this->room->participants()->update(['revoked_at' => now()]);

        $this->postJson(route('rooms.presence.heartbeat', 'SEC001'))->assertForbidden();
        $this->get(route('rooms.show', 'SEC001'))
            ->assertInertia(fn (Assert $page) => $page->component('room/full'));
    }

    public function test_role_restricted_room_endpoints(): void
    {
        $applicant = User::factory()->create(['role' => 'applicant']);

        $this->actingAs($applicant)->enterRoom($this->room)
            ->getJson(route('rooms.recordings.index', 'SEC001'))
            ->assertForbidden();

        $this->actingAs($this->interviewer)->enterRoom($this->room)
            ->postJson(route('rooms.violations.store', 'SEC001'), ['event_type' => 'tab_hidden'])
            ->assertForbidden();
    }

    public function test_only_seated_users_may_join_the_private_channel(): void
    {
        $access = app(RoomAccessService::class);
        $outsider = User::factory()->create(['role' => 'applicant']);

        $this->assertFalse($access->isParticipant($this->interviewer, 'SEC001'));

        $this->actingAs($this->interviewer)->enterRoom($this->room);

        $this->assertTrue($access->isParticipant($this->interviewer, 'sec001'));
        $this->assertFalse($access->isParticipant($outsider, 'SEC001'));
    }

    public function test_recordings_can_only_be_fetched_by_the_owning_interviewer(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('recordings/SEC001/a.webm', 'video');

        $recording = InterviewRecording::create([
            'interview_room_id' => $this->room->id,
            'room_code' => 'SEC001',
            'user_id' => $this->interviewer->id,
            'file_path' => 'recordings/SEC001/a.webm',
            'file_name' => 'a.webm',
            'mime_type' => 'video/webm',
            'size_bytes' => 5,
            'status' => 'ready',
        ]);

        $otherInterviewer = User::factory()->create(['role' => 'interviewer']);
        $applicant = User::factory()->create(['role' => 'applicant']);

        $this->actingAs($otherInterviewer)->get(route('recordings.download', $recording))->assertForbidden();
        $this->actingAs($applicant)->get(route('recordings.stream', $recording))->assertForbidden();
        $this->actingAs($this->interviewer)->get(route('recordings.download', $recording))->assertOk();
    }
}
