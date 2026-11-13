<?php

namespace App\Http\Controllers;

use App\Events\WebRTCSignal;
use App\Models\InterviewRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomViolationController extends Controller
{
    /**
     * Only the applicant's seat reaches this (room.participant:applicant).
     */
    public function store(Request $request): JsonResponse
    {
        /** @var InterviewRoom $room */
        $room = $request->attributes->get('room');

        $validated = $request->validate([
            'event_type' => ['required', 'string', 'in:tab_hidden,window_blurred'],
        ]);

        broadcast(new WebRTCSignal(
            $room->room_code,
            'violation_warning',
            [
                'event_type' => $validated['event_type'],
                'reported_at' => now()->toIso8601String(),
            ],
        ))->toOthers();

        return response()->json(['success' => true]);
    }
}
