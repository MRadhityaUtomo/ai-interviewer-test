<?php

use App\Http\Controllers\InterviewController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

Route::inertia('dashboard', 'dashboard')->name('dashboard');

Route::get('interview', [InterviewController::class, 'show'])->name('interview.session');
Route::post('interview/message', [InterviewController::class, 'submit'])->name('interview.message');
Route::post('interview/reset', [InterviewController::class, 'reset'])->name('interview.reset');

require __DIR__.'/settings.php';
