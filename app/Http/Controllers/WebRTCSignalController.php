<?php

namespace App\Http\Controllers;

use App\Events\WebRTCSignal;
use App\Models\InterviewRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebRTCSignalController extends Controller
{
    public function store(Request $request, string $roomCode): JsonResponse
    {
        $roomCode = strtoupper($roomCode);

        InterviewRoom::where('room_code', $roomCode)
            ->where('status', 'active')
            ->firstOrFail();

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:offer,answer,ice-candidate,left_room'],
            'data' => ['required', 'array'],
        ]);

        if ($validated['type'] === 'offer' && $request->user()->role !== 'interviewer') {
            abort(403, 'Only an interviewer can start the call.');
        }

        if ($validated['type'] === 'answer' && $request->user()->role !== 'applicant') {
            abort(403, 'Only an applicant can answer the call.');
        }

        broadcast(new WebRTCSignal(
            $roomCode,
            $validated['type'],
            $validated['data'],
        ))->toOthers();

        return response()->json(['success' => true]);
    }
}