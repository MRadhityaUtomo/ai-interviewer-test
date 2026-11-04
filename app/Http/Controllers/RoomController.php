<?php

namespace App\Http\Controllers;

use App\Models\InterviewMessage;
use App\Models\InterviewRoom;
use App\Services\Ai\AiProviderException;
use App\Services\Ai\InterviewAiService;
use App\Services\RoomPresenceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Str;

class RoomController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('room/index', [
            'role' => $request->user()->role,
        ]);
    }

    public function create(Request $request): RedirectResponse
    {
        abort_unless($request->user()->role === 'interviewer', 403);

        do {
            $roomCode = strtoupper(str()->random(6));
        } while (InterviewRoom::where('room_code', $roomCode)->exists());

        $room = InterviewRoom::create([
            'room_code' => $roomCode,
            'status' => 'active',
            'user_id' => $request->user()->id,
        ]);

        return redirect()->route('rooms.show', $room->room_code);
    }

    public function join(Request $request): RedirectResponse
    {
        abort_unless($request->user()->role === 'applicant', 403);

        $validated = $request->validate([
            'room_code' => ['required', 'string', 'size:6'],
        ]);

        $room = InterviewRoom::where('room_code', strtoupper($validated['room_code']))
            ->where('status', 'active')
            ->first();

        if (! $room) {
            return back()
                ->withInput()
                ->withErrors(['room_code' => 'Room was not found or is already closed.']);
        }

        return redirect()->route('rooms.show', $room->room_code);
    }

    public function show(
        Request $request,
        string $roomCode,
        RoomPresenceService $presence,
    ): Response|RedirectResponse
    {
        $room = InterviewRoom::where('room_code', strtoupper($roomCode))
            ->where('status', 'active')
            ->firstOrFail();
        $role = $request->user()->role;

        if ($role === 'interviewer' && $room->user_id !== null && $room->user_id !== $request->user()->id) {
            abort(403);
        }
        $participantToken = $request->query('participant_token');

        if (! is_string($participantToken) || $participantToken === '') {
            return redirect()->route('rooms.show', [
                'roomCode' => $room->room_code,
                'participant_token' => Str::random(40),
            ]);
        }

        $presenceResult = $presence->claim($room->room_code, $participantToken, $role);

        if (! $presenceResult['allowed']) {
            return Inertia::render('room/full', [
                'roomCode' => $room->room_code,
            ]);
        }

        $messages = InterviewMessage::where('room_code', $room->room_code)
            ->orderBy('created_at')
            ->get(['id', 'role', 'message', 'created_at'])
            ->toArray();

        return Inertia::render('room/show', [
            'room' => [
                'code' => $room->room_code,
                'status' => $room->status,
            ],
            'participantRole' => $role,
            'participantToken' => $participantToken,
            'participantCount' => $presenceResult['count'],
            'messages' => $messages,
        ]);
    }

    /**
     * Phase 22: Receive speech transcript/message, save to DB, generate AI reply.
     */
    public function sendMessage(Request $request, string $roomCode, InterviewAiService $ai): RedirectResponse
    {
        $room = InterviewRoom::where('room_code', strtoupper($roomCode))
            ->where('status', 'active')
            ->firstOrFail();

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $role = $request->user()->role === 'interviewer' ? 'interviewer' : 'applicant';

        // 1. Simpan pesan dari pengguna (applicant / interviewer)
        InterviewMessage::create([
            'interview_room_id' => $room->id,
            'room_code' => $room->room_code,
            'user_id' => $request->user()->id,
            'role' => 'applicant',
            'message' => $validated['message'],
        ]);

        // 2. Hanya jawaban applicant yang dibalas AI (provider dipilih lewat AI_PROVIDER)
        if ($role !== 'applicant') {
            return back();
        }

        try {
            $reply = $ai->nextReply($room);
        } catch (AiProviderException $e) {
            report($e);

            return back()->withErrors([
                'message' => 'AI sedang tidak tersedia. Jawaban Anda sudah tersimpan, silakan coba lagi sebentar.',
            ]);
        }

        InterviewMessage::create([
            'interview_room_id' => $room->id,
            'room_code' => $room->room_code,
            'user_id' => null,
            'role' => 'ai_assistant',
            'message' => $reply,
        ]);

        return back();
    }
}