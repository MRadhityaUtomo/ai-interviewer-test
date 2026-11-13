<?php

use App\Models\User;
use App\Services\RoomAccessService;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// WebRTC signaling and proctoring warnings: only users seated in the room
Broadcast::channel('room.{roomCode}', function (User $user, string $roomCode) {
    return app(RoomAccessService::class)->isParticipant($user, $roomCode);
});
