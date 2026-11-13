<?php

namespace App\Http\Controllers;

use App\Models\InterviewParticipant;
use App\Models\InterviewRoom;
use App\Services\RoomPresenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The room and seat come from the room.participant middleware, so a
 * participant is identified by their room cookie, not by anything in the body.
 */
class RoomPresenceController extends Controller
{
    public function heartbeat(Request $request, RoomPresenceService $presence): JsonResponse
    {
        [$room, $participant] = $this->seat($request);

        $result = $presence->heartbeat($room->room_code, "user:{$participant->user_id}", $participant->role);

        return response()->json($result, $result['allowed'] ? 200 : 409);
    }

    public function leave(Request $request, RoomPresenceService $presence): JsonResponse
    {
        [$room, $participant] = $this->seat($request);

        $presence->release($room->room_code, "user:{$participant->user_id}");

        return response()->json(['allowed' => true]);
    }

    /**
     * @return array{0: InterviewRoom, 1: InterviewParticipant}
     */
    private function seat(Request $request): array
    {
        return [$request->attributes->get('room'), $request->attributes->get('participant')];
    }
}
