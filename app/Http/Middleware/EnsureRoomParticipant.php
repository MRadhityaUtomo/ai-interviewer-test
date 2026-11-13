<?php

namespace App\Http\Middleware;

use App\Models\InterviewRoom;
use App\Services\RoomAccessService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Only lets through requests that carry this room's participant cookie for
 * the signed-in user. Optionally restricts to one role: `room.participant:interviewer`.
 * The room and seat are shared with the controller as request attributes.
 */
class EnsureRoomParticipant
{
    public function __construct(private readonly RoomAccessService $access) {}

    public function handle(Request $request, Closure $next, ?string $role = null): Response
    {
        $room = InterviewRoom::where('room_code', strtoupper((string) $request->route('roomCode')))
            ->where('status', 'active')
            ->firstOrFail();

        $participant = $this->access->resolve($request, $room);

        abort_if($participant === null, 403, 'Kamu bukan peserta room ini.');
        abort_if($role !== null && $participant->role !== $role, 403);

        $request->attributes->set('room', $room);
        $request->attributes->set('participant', $participant);

        return $next($request);
    }
}
