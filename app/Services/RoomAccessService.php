<?php

namespace App\Services;

use App\Models\InterviewParticipant;
use App\Models\InterviewRoom;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Per-room participant sessions.
 *
 * Entering a room gives the user a random token in a cookie scoped to
 * /rooms/{code} (HttpOnly, SameSite=Strict, encrypted by Laravel). Only its
 * SHA-256 hash is stored. Every room endpoint checks that the cookie matches
 * the signed-in user's seat in that room.
 */
class RoomAccessService
{
    public const COOKIE = 'room_participant';

    private const COOKIE_MINUTES = 8 * 60;

    /**
     * Whether another applicant already holds the candidate seat of this room.
     */
    public function isTakenFor(InterviewRoom $room, User $user): bool
    {
        if ($user->role !== 'applicant') {
            return false;
        }

        return $room->participants()
            ->where('role', 'applicant')
            ->where('user_id', '!=', $user->id)
            ->exists();
    }

    /**
     * Give the user a seat in the room (or a fresh token for their existing
     * seat). Returns the plain token for the cookie, or null when not allowed.
     */
    public function enter(InterviewRoom $room, User $user): ?string
    {
        if ($this->isTakenFor($room, $user)) {
            return null;
        }

        $participant = $room->participants()->where('user_id', $user->id)->first();

        if ($participant?->revoked_at !== null) {
            return null;
        }

        $token = Str::random(64);

        $room->participants()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'role' => $user->role,
                'token_hash' => hash('sha256', $token),
                'joined_at' => $participant->joined_at ?? now(),
            ],
        );

        return $token;
    }

    public function cookie(InterviewRoom $room, string $token): Cookie
    {
        return cookie(
            self::COOKIE,
            $token,
            self::COOKIE_MINUTES,
            "/rooms/{$room->room_code}",
            null,
            config('session.secure'),
            true,
            false,
            'strict',
        );
    }

    /**
     * The active seat proven by the request's room cookie, if any.
     */
    public function resolve(Request $request, InterviewRoom $room): ?InterviewParticipant
    {
        $token = $request->cookie(self::COOKIE);
        $user = $request->user();

        if (! is_string($token) || $token === '' || $user === null) {
            return null;
        }

        $participant = $room->participants()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->first();

        if ($participant === null || ! hash_equals($participant->token_hash, hash('sha256', $token))) {
            return null;
        }

        return $participant;
    }

    /**
     * Whether the user holds an active seat (used where the room cookie is
     * not sent, e.g. the broadcasting auth endpoint).
     */
    public function isParticipant(User $user, string $roomCode): bool
    {
        return InterviewParticipant::where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->whereHas('room', fn ($query) => $query
                ->where('room_code', strtoupper($roomCode))
                ->where('status', 'active'))
            ->exists();
    }
}
