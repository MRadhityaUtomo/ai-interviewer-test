<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class RoomPresenceService
{
    private const TTL_SECONDS = 45;

    public function claim(string $roomCode, string $participantToken, string $role): array
    {
        $participants = $this->activeParticipants($roomCode);

        if (! isset($participants[$participantToken]) && count($participants) >= 2) {
            return [
                'allowed' => false,
                'count' => count($participants),
            ];
        }

        $participants[$participantToken] = [
            'role' => $role,
            'last_seen' => now()->timestamp,
        ];

        $this->store($roomCode, $participants);

        return [
            'allowed' => true,
            'count' => count($participants),
        ];
    }

    public function heartbeat(string $roomCode, string $participantToken, string $role): array
    {
        return $this->claim($roomCode, $participantToken, $role);
    }

    public function release(string $roomCode, string $participantToken): void
    {
        $participants = $this->activeParticipants($roomCode);
        unset($participants[$participantToken]);
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