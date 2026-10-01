<?php

namespace App\Http\Controllers;

use App\Models\InterviewRoom;
use App\Services\RoomPresenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomPresenceController extends Controller
{
    public function heartbeat(
        Request $request,
        string $roomCode,
        RoomPresenceService $presence,
    ): JsonResponse {
        $validated = $this->validateParticipant($request);
        $this->ensureRoomIsActive($roomCode);
        $result = $presence->heartbeat(
            strtoupper($roomCode),
            $validated['participant_token'],
            $request->user()->role,
        );

        return response()->json($result, $result['allowed'] ? 200 : 409);
    }

    public function leave(
        Request $request,
        string $roomCode,
        RoomPresenceService $presence,
    ): JsonResponse {
        $validated = $this->validateParticipant($request);
        $presence->release(strtoupper($roomCode), $validated['participant_token']);

        return response()->json(['allowed' => true]);
    }

    private function validateParticipant(Request $request): array
    {
        return $request->validate([
            'participant_token' => ['required', 'string', 'min:20', 'max:80'],
        ]);
    }

    private function ensureRoomIsActive(string $roomCode): void
    {
        InterviewRoom::where('room_code', strtoupper($roomCode))
            ->where('status', 'active')
            ->firstOrFail();
    }
}