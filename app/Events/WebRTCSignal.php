<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WebRTCSignal implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $roomCode,
        public string $type,
        public array $data,
    ) {
    }

    public function broadcastOn(): array
    {
        return [new Channel("room.{$this->roomCode}")];
    }

    public function broadcastWith(): array
    {
        return [
            'room_code' => $this->roomCode,
            'type' => $this->type,
            'data' => $this->data,
        ];
    }
}