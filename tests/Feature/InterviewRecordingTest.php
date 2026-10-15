<?php

namespace Tests\Feature;

use App\Models\InterviewRecording;
use App\Models\InterviewRoom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class InterviewRecordingTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_upload_recordings(): void
    {
        $response = $this->postJson(route('rooms.recordings.store', 'ROOM99'), [
            'recording' => UploadedFile::fake()->create('video.webm', 1024, 'video/webm'),
        ]);

        $response->assertUnauthorized();
    }

    public function test_authenticated_interviewer_can_upload_recording_to_local_disk(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'interviewer']);
        $room = InterviewRoom::create([
            'room_code' => 'REC101',
            'status' => 'active',
            'user_id' => $user->id,
        ]);

        $this->actingAs($user);

        $file = UploadedFile::fake()->create('meeting.webm', 2048, 'video/webm');

        $response = $this->postJson(route('rooms.recordings.store', $room->room_code), [
            'recording' => $file,
            'duration' => 65,
        ]);

        $response->assertCreated();
        $response->assertJsonStructure([
            'message',
            'recording' => [
                'id',
                'room_code',
                'file_name',
                'duration_seconds',
                'size_bytes',
                'url',
            ],
        ]);

        $this->assertDatabaseHas('interview_recordings', [
            'room_code' => 'REC101',
            'duration_seconds' => 65,
        ]);

        $recording = InterviewRecording::first();
        Storage::disk('public')->assertExists($recording->file_path);
    }

    public function test_can_list_recordings_for_a_room(): void
    {
        $user = User::factory()->create(['role' => 'interviewer']);
        $room = InterviewRoom::create([
            'room_code' => 'REC102',
            'status' => 'active',
            'user_id' => $user->id,
        ]);

        InterviewRecording::create([
            'interview_room_id' => $room->id,
            'room_code' => $room->room_code,
            'user_id' => $user->id,
            'file_path' => 'recordings/REC102/test.webm',
            'file_name' => 'test.webm',
            'mime_type' => 'video/webm',
            'size_bytes' => 1024,
            'duration_seconds' => 30,
            'status' => 'ready',
        ]);

        $this->actingAs($user);

        $response = $this->getJson(route('rooms.recordings.index', $room->room_code));

        $response->assertOk();
        $response->assertJsonCount(1, 'recordings');
    }

    public function test_can_download_and_stream_stored_recording(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'interviewer']);
        $room = InterviewRoom::create([
            'room_code' => 'REC103',
            'status' => 'active',
            'user_id' => $user->id,
        ]);

        $filePath = 'recordings/REC103/sample.webm';
        Storage::disk('public')->put($filePath, 'fake video data stream');

        $recording = InterviewRecording::create([
            'interview_room_id' => $room->id,
            'room_code' => $room->room_code,
            'user_id' => $user->id,
            'file_path' => $filePath,
            'file_name' => 'sample.webm',
            'mime_type' => 'video/webm',
            'size_bytes' => 24,
            'duration_seconds' => 10,
            'status' => 'ready',
        ]);

        $this->actingAs($user);

        $streamResponse = $this->get(route('recordings.stream', $recording->id));
        $streamResponse->assertOk();
        $streamResponse->assertHeader('Content-Type', 'video/webm');

        $downloadResponse = $this->get(route('recordings.download', $recording->id));
        $downloadResponse->assertOk();
    }
}
