import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { dashboard } from '@/routes';

type Message = { role: 'ai' | 'candidate'; content: string };

type InterviewProps = {
    question: string | null;
    questionNumber: number;
    totalQuestions: number;
    messages: Message[];
    complete: boolean;
    summary: string | null;
};

export default function InterviewSession({
    question,
    questionNumber,
    totalQuestions,
    messages,
    complete,
    summary,
}: InterviewProps) {
    const [answer, setAnswer] = useState('');

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.post(
            '/interview/message',
            { answer },
            {
                preserveScroll: true,
                onSuccess: () => setAnswer(''),
            },
        );
    }

    return (
        <>
            <Head title="AI Interview Prototype" />
            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-8">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">
                            Prototype workspace
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            AI Interview
                        </h1>
                    </div>
                    <a
                        href={dashboard().url}
                        className="text-sm text-muted-foreground underline"
                    >
                        Back to dashboard
                    </a>
                </div>
                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    <section className="rounded-xl border bg-card p-6 shadow-sm">
                        <div className="mb-6 flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Question {questionNumber} of {totalQuestions}
                            </p>
                            <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                                Fake provider
                            </span>
                        </div>
                        {complete ? (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold">
                                    Interview complete
                                </h2>
                                <p className="text-muted-foreground">
                                    {summary}
                                </p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post('/interview/reset')
                                    }
                                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                                >
                                    Start again
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={submit} className="space-y-5">
                                <h2 className="text-xl leading-relaxed font-medium">
                                    {question}
                                </h2>
                                <textarea
                                    value={answer}
                                    onChange={(event) =>
                                        setAnswer(event.target.value)
                                    }
                                    placeholder="Write your answer here..."
                                    rows={7}
                                    required
                                    className="w-full rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                                />
                                <button
                                    type="submit"
                                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                                >
                                    Submit answer
                                </button>
                            </form>
                        )}
                    </section>
                    <aside className="rounded-xl border bg-card p-6 shadow-sm">
                        <h2 className="font-semibold">Conversation</h2>
                        <div className="mt-4 space-y-4">
                            {messages.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Your answers and AI follow-ups will appear
                                    here.
                                </p>
                            ) : (
                                messages.map((message, index) => (
                                    <div
                                        key={`${message.role}-${index}`}
                                        className="space-y-1"
                                    >
                                        <p className="text-xs font-medium text-muted-foreground uppercase">
                                            {message.role === 'ai'
                                                ? 'AI interviewer'
                                                : 'You'}
                                        </p>
                                        <p className="text-sm leading-relaxed">
                                            {message.content}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </>
    );
}
