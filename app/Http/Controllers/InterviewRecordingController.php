<?php

namespace App\Http\Controllers;

use App\Models\InterviewRecording;
use App\Models\InterviewRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class InterviewRecordingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var InterviewRoom $room Resolved by room.participant:interviewer */
        $room = $request->attributes->get('room');

        $recordings = InterviewRecording::where('interview_room_id', $room->id)
            ->with('user:id,name,role')
            ->latest()
            ->get();

        return response()->json([
            'recordings' => $recordings,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var InterviewRoom $room Resolved by room.participant:interviewer */
        $room = $request->attributes->get('room');

        $request->validate([
            'recording' => ['required', 'file', 'max:204800'], // max 200MB
            'duration' => ['nullable', 'integer', 'min:0'],
        ]);

        $file = $request->file('recording');
        $duration = $request->input('duration') ? (int) $request->input('duration') : null;

        $extension = $file->getClientOriginalExtension() ?: 'webm';
        $timestamp = now()->format('Ymd_His');
        $random = Str::random(6);
        $fileName = "rec_{$room->room_code}_{$timestamp}_{$random}.{$extension}";
        $folder = "recordings/{$room->room_code}";

        $storedPath = Storage::disk('public')->putFileAs($folder, $file, $fileName);

        if (! $storedPath) {
            return response()->json([
                'message' => 'Failed to store video recording on local disk.',
            ], 500);
        }

        $recording = InterviewRecording::create([
            'interview_room_id' => $room->id,
            'room_code' => $room->room_code,
            'user_id' => $request->user()->id,
            'file_path' => $storedPath,
            'file_name' => $fileName,
            'mime_type' => $file->getClientMimeType() ?: 'video/webm',
            'size_bytes' => $file->getSize() ?: 0,
            'duration_seconds' => $duration,
            'status' => 'ready',
        ]);

        $recording->load('user:id,name,role');

        return response()->json([
            'message' => 'Recording saved successfully.',
            'recording' => $recording,
        ], 201);
    }

    public function stream(Request $request, InterviewRecording $recording): Response
    {
        $this->authorizeOwner($request, $recording);

        if (! Storage::disk('public')->exists($recording->file_path)) {
            abort(404, 'Recording file not found on disk.');
        }

        return Storage::disk('public')->response(
            $recording->file_path,
            $recording->file_name,
            [
                'Content-Type' => $recording->mime_type ?: 'video/webm',
                'Accept-Ranges' => 'bytes',
            ]
        );
    }

    public function download(Request $request, InterviewRecording $recording): StreamedResponse
    {
        $this->authorizeOwner($request, $recording);

        if (! Storage::disk('public')->exists($recording->file_path)) {
            abort(404, 'Recording file not found on disk.');
        }

        return Storage::disk('public')->download($recording->file_path, $recording->file_name);
    }

    public function analyzeAudio(Request $request): JsonResponse
    {
        /** @var InterviewRoom $room Resolved by room.participant */
        $room = $request->attributes->get('room');

        $request->validate([
            'audio' => ['required', 'file', 'max:102400'], // max 100MB
        ]);

        $file = $request->file('audio');
        $extension = $file->getClientOriginalExtension() ?: 'webm';
        $timestamp = now()->format('Ymd_His');
        $random = Str::random(6);
        $folderCode = $room->room_code;
        $fileName = "audio_ai_{$folderCode}_{$timestamp}_{$random}.{$extension}";
        $folder = "audio/{$folderCode}";

        $storedPath = Storage::disk('public')->putFileAs($folder, $file, $fileName);

        if (! $storedPath) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to store AI audio file on disk.',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Audio berhasil diterima dan siap untuk analisis AI (SenseVoice / Qwen).',
            'file_name' => $fileName,
            'file_path' => $storedPath,
            'size_bytes' => $file->getSize() ?: 0,
        ], 200);
    }

    /**
     * Recordings are only for the interviewer who owns the room.
     */
    private function authorizeOwner(Request $request, InterviewRecording $recording): void
    {
        $ownerId = InterviewRoom::whereKey($recording->interview_room_id)->value('user_id');

        abort_unless(
            $request->user()->role === 'interviewer' && $ownerId === $request->user()->id,
            403,
        );
    }
}
