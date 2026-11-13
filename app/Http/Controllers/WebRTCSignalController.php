<?php

namespace App\Http\Controllers;

use App\Events\WebRTCSignal;
use App\Models\InterviewParticipant;
use App\Models\InterviewRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebRTCSignalController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        /** @var InterviewRoom $room */
        $room = $request->attributes->get('room');
        /** @var InterviewParticipant $participant */
        $participant = $request->attributes->get('participant');

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:offer,answer,ice-candidate,left_room'],
            'data' => ['required', 'array'],
        ]);

        if ($validated['type'] === 'offer' && $participant->role !== 'interviewer') {
            abort(403, 'Only an interviewer can start the call.');
        }

        if ($validated['type'] === 'answer' && $participant->role !== 'applicant') {
            abort(403, 'Only an applicant can answer the call.');
        }

        broadcast(new WebRTCSignal(
            $room->room_code,
            $validated['type'],
            $validated['data'],
        ))->toOthers();

        return response()->json(['success' => true]);
    }
}
