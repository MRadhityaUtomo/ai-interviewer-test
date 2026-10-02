<?php

use App\Http\Controllers\InterviewController;
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
	Route::get('rooms/{roomCode}', [RoomController::class, 'show'])->name('rooms.show');
	Route::post('rooms/{roomCode}/signals', [WebRTCSignalController::class, 'store'])->name('rooms.signals.store');
	Route::post('rooms/{roomCode}/presence/heartbeat', [RoomPresenceController::class, 'heartbeat'])->name('rooms.presence.heartbeat');
	Route::post('rooms/{roomCode}/presence/leave', [RoomPresenceController::class, 'leave'])->name('rooms.presence.leave');
	Route::post('rooms/{roomCode}/violations', [RoomViolationController::class, 'store'])->name('rooms.violations.store');
});

Route::get('interview', [InterviewController::class, 'show'])->name('interview.session');
Route::post('interview/message', [InterviewController::class, 'submit'])->name('interview.message');
Route::post('interview/reset', [InterviewController::class, 'reset'])->name('interview.reset');

require __DIR__.'/settings.php';
