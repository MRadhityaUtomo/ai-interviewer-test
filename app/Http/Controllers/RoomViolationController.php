<?php

namespace App\Http\Controllers;

use App\Events\WebRTCSignal;
use App\Models\InterviewRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomViolationController extends Controller
{
    public function store(Request $request, string $roomCode): JsonResponse
    {
        abort_unless($request->user()->role === 'applicant', 403);

        $roomCode = strtoupper($roomCode);
        InterviewRoom::where('room_code', $roomCode)
            ->where('status', 'active')
            ->firstOrFail();

        $validated = $request->validate([
            'event_type' => ['required', 'string', 'in:tab_hidden,window_blurred'],
        ]);

        broadcast(new WebRTCSignal(
            $roomCode,
            'violation_warning',
            [
                'event_type' => $validated['event_type'],
                'reported_at' => now()->toIso8601String(),
            ],
        ))->toOthers();

        return response()->json(['success' => true]);
    }
}