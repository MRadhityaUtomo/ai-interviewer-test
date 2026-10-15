<?php

namespace App\Http\Controllers;

use App\Models\InterviewRecording;
use App\Models\InterviewRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpFoundation\Response;

class InterviewRecordingController extends Controller
{
    public function index(Request $request, string $roomCode): JsonResponse
    {
        $room = InterviewRoom::where('room_code', strtoupper($roomCode))->firstOrFail();

        $recordings = InterviewRecording::where('interview_room_id', $room->id)
            ->with('user:id,name,role')
            ->latest()
            ->get();

        return response()->json([
            'recordings' => $recordings,
        ]);
    }

    public function store(Request $request, string $roomCode): JsonResponse
    {
        $room = InterviewRoom::where('room_code', strtoupper($roomCode))->firstOrFail();

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
        if (! Storage::disk('public')->exists($recording->file_path)) {
            abort(404, 'Recording file not found on disk.');
        }

        return Storage::disk('public')->download($recording->file_path, $recording->file_name);
    }
}
