<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InterviewController extends Controller
{
    private const QUESTIONS = [
        'Tell me about your most relevant professional experience.',
        'Describe a difficult problem you solved and how you approached it.',
        'What would you like to develop further in your next role?',
    ];

    public function show(Request $request): Response
    {
        if (! $request->session()->has('prototype_interview')) {
            $request->session()->put('prototype_interview', [
                'question_index' => 0,
                'messages' => [],
                'complete' => false,
            ]);
        }

        return $this->renderInterview($request);
    }

    public function submit(Request $request): Response
    {
        $validated = $request->validate([
            'answer' => ['required', 'string', 'max:2000'],
        ]);

        $state = $request->session()->get('prototype_interview');

        if ($state['complete']) {
            return $this->renderInterview($request);
        }

        $questionIndex = $state['question_index'];
        $state['messages'][] = ['role' => 'candidate', 'content' => $validated['answer']];
        $state['messages'][] = ['role' => 'ai', 'content' => $this->fakeResponse($questionIndex)];
        $state['question_index']++;
        $state['complete'] = $state['question_index'] >= count(self::QUESTIONS);

        $request->session()->put('prototype_interview', $state);

        return $this->renderInterview($request);
    }

    public function reset(Request $request): Response
    {
        $request->session()->forget('prototype_interview');

        return redirect()->route('interview.session');
    }

    private function renderInterview(Request $request): Response
    {
        $state = $request->session()->get('prototype_interview');
        $questionIndex = $state['question_index'];

        return Inertia::render('interview/session', [
            'question' => $state['complete'] ? null : self::QUESTIONS[$questionIndex],
            'questionNumber' => min($questionIndex + 1, count(self::QUESTIONS)),
            'totalQuestions' => count(self::QUESTIONS),
            'messages' => $state['messages'],
            'complete' => $state['complete'],
            'summary' => $state['complete']
                ? 'Prototype complete. A real AI provider will summarize this interview here.'
                : null,
        ]);
    }

    private function fakeResponse(int $questionIndex): string
    {
        return match ($questionIndex) {
            0 => 'Thank you. Let us explore a specific example from that experience.',
            1 => 'That is helpful context. Let us finish by discussing your goals.',
            default => 'Thank you for completing this prototype interview.',
        };
    }
}