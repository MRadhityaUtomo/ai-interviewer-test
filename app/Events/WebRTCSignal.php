<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast immediately instead of via the queue: WebRTC offers, answers and
 * ICE candidates are latency-sensitive and must not wait for a queue worker.
 */
class WebRTCSignal implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        public string $roomCode,
        public string $type,
        public array $data,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel("room.{$this->roomCode}")];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'room_code' => $this->roomCode,
            'type' => $this->type,
            'data' => $this->data,
        ];
    }
}
