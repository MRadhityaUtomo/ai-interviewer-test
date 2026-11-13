<?php

use App\Http\Controllers\InterviewController;
use App\Http\Controllers\InterviewRecordingController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\RoomPresenceController;
use App\Http\Controllers\RoomViolationController;
use App\Http\Controllers\WebRTCSignalController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

Route::inertia('dashboard', 'dashboard')->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('rooms', [RoomController::class, 'index'])->name('rooms.index');
    Route::post('rooms', [RoomController::class, 'create'])->name('rooms.create');
    Route::post('room/join', [RoomController::class, 'join'])->name('room.join');
    Route::get('rooms/{roomCode}/lobby', [RoomController::class, 'lobby'])->name('rooms.lobby');
    // Entering the room issues the per-room participant cookie
    Route::get('rooms/{roomCode}', [RoomController::class, 'show'])->name('rooms.show');

    // Everything inside a room requires that cookie (see EnsureRoomParticipant)
    Route::middleware('room.participant')->prefix('rooms/{roomCode}')->name('rooms.')->group(function () {
        Route::post('signals', [WebRTCSignalController::class, 'store'])->name('signals.store');
        Route::post('presence/heartbeat', [RoomPresenceController::class, 'heartbeat'])->name('presence.heartbeat');
        Route::post('presence/leave', [RoomPresenceController::class, 'leave'])->name('presence.leave');
        Route::post('send-message', [RoomController::class, 'sendMessage'])->name('send-message');
        Route::post('analyze-audio', [InterviewRecordingController::class, 'analyzeAudio'])->name('analyze-audio');
    });

    Route::middleware('room.participant:applicant')->group(function () {
        Route::post('rooms/{roomCode}/violations', [RoomViolationController::class, 'store'])->name('rooms.violations.store');
    });

    Route::middleware('room.participant:interviewer')->group(function () {
        Route::get('rooms/{roomCode}/recordings', [InterviewRecordingController::class, 'index'])->name('rooms.recordings.index');
        Route::post('rooms/{roomCode}/recordings', [InterviewRecordingController::class, 'store'])->name('rooms.recordings.store');
    });

    // Outside the room path (no room cookie): only the interviewer who owns the room
    Route::get('recordings/{recording}/stream', [InterviewRecordingController::class, 'stream'])->name('recordings.stream');
    Route::get('recordings/{recording}/download', [InterviewRecordingController::class, 'download'])->name('recordings.download');
});

Route::get('interview', [InterviewController::class, 'show'])->name('interview.session');
Route::post('interview/message', [InterviewController::class, 'submit'])->name('interview.message');
Route::post('interview/reset', [InterviewController::class, 'reset'])->name('interview.reset');

require __DIR__.'/settings.php';
