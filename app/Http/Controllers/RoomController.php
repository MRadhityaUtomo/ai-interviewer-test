<?php

namespace App\Http\Controllers;

use App\Models\InterviewMessage;
use App\Models\InterviewRoom;
use App\Services\Ai\AiProviderException;
use App\Services\Ai\InterviewAiService;
use App\Services\RoomAccessService;
use App\Services\RoomPresenceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Inertia\Inertia;
use Inertia\Response;

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

        return redirect()->route('rooms.lobby', $room->room_code);
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
                ->withErrors(['room_code' => 'Room tidak ditemukan atau sudah ditutup.']);
        }

        return redirect()->route('rooms.lobby', $room->room_code);
    }

    /**
     * Camera / microphone check before entering. Does not take a participant slot.
     */
    public function lobby(Request $request, string $roomCode, RoomAccessService $access): Response
    {
        $room = $this->findRoomFor($request, $roomCode);

        if ($access->isTakenFor($room, $request->user())) {
            return Inertia::render('room/full', ['roomCode' => $room->room_code]);
        }

        return Inertia::render('room/lobby', [
            'roomCode' => $room->room_code,
            'participantRole' => $request->user()->role,
        ]);
    }

    public function show(
        Request $request,
        string $roomCode,
        RoomPresenceService $presence,
        RoomAccessService $access,
    ): Response {
        $room = $this->findRoomFor($request, $roomCode);
        $user = $request->user();
        $role = $user->role;

        // Keep a valid seat as is (this page is also polled for new messages);
        // otherwise take a seat and hand out a fresh room cookie.
        if ($access->resolve($request, $room) === null) {
            $token = $access->enter($room, $user);

            if ($token === null) {
                return Inertia::render('room/full', ['roomCode' => $room->room_code]);
            }

            Cookie::queue($access->cookie($room, $token));
        }

        $presenceResult = $presence->claim($room->room_code, "user:{$user->id}", $role);

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
            'participantCount' => $presenceResult['count'],
            'messages' => $messages,
        ]);
    }

    /**
     * Phase 22: Receive speech transcript/message, save to DB, generate AI reply.
     */
    public function sendMessage(Request $request, InterviewAiService $ai): RedirectResponse
    {
        /** Resolved by the room.participant middleware */
        $room = $request->attributes->get('room');

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $role = $request->user()->role === 'interviewer' ? 'interviewer' : 'applicant';

        // 1. Simpan pesan dari pengguna (applicant / interviewer)
        InterviewMessage::create([
            'interview_room_id' => $room->id,
            'room_code' => $room->room_code,
            'user_id' => $request->user()->id,
            'role' => $role,
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

    /**
     * An active room the current user may enter: applicants any room, interviewers only their own.
     */
    private function findRoomFor(Request $request, string $roomCode): InterviewRoom
    {
        $room = InterviewRoom::where('room_code', strtoupper($roomCode))
            ->where('status', 'active')
            ->firstOrFail();

        if ($request->user()->role === 'interviewer' && $room->user_id !== null && $room->user_id !== $request->user()->id) {
            abort(403);
        }

        return $room;
    }
}
