<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Who is currently in a room, kept in the cache with a short TTL refreshed by
 * heartbeats. Participants are keyed by "user:{id}" (see RoomPresenceController).
 */
class RoomPresenceService
{
    private const TTL_SECONDS = 45;

    public function claim(string $roomCode, string $participantKey, string $role): array
    {
        $participants = $this->activeParticipants($roomCode);

        if (! isset($participants[$participantKey]) && count($participants) >= 2) {
            return [
                'allowed' => false,
                'count' => count($participants),
            ];
        }

        $participants[$participantKey] = [
            'role' => $role,
            'last_seen' => now()->timestamp,
        ];

        $this->store($roomCode, $participants);

        return [
            'allowed' => true,
            'count' => count($participants),
        ];
    }

    public function heartbeat(string $roomCode, string $participantKey, string $role): array
    {
        return $this->claim($roomCode, $participantKey, $role);
    }

    public function release(string $roomCode, string $participantKey): void
    {
        $participants = $this->activeParticipants($roomCode);
        unset($participants[$participantKey]);
        $this->store($roomCode, $participants);
    }

    private function activeParticipants(string $roomCode): array
    {
        $participants = Cache::get($this->key($roomCode), []);
        $cutoff = now()->subSeconds(self::TTL_SECONDS)->timestamp;

        return array_filter(
            $participants,
            fn (array $participant): bool => $participant['last_seen'] >= $cutoff,
        );
    }

    private function store(string $roomCode, array $participants): void
    {
        Cache::put($this->key($roomCode), $participants, self::TTL_SECONDS);
    }

    private function key(string $roomCode): string
    {
        return "interview-room-presence:{$roomCode}";
    }
}
