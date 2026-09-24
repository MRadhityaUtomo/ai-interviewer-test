import { Head, Link } from '@inertiajs/react';
import { ArrowUpRight, Bot, CircleCheck, Mic, Settings2 } from 'lucide-react';
import { dashboard } from '@/routes';

export default function Dashboard() {
    return (
        <>
            <Head title="Interview workspace" />
            <div className="min-h-full flex-1 bg-muted/30 p-4 md:p-8">
                <div className="mx-auto flex max-w-6xl flex-col gap-8">
                    <header className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-primary">
                                Prototype workspace
                            </p>
                            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                                AI Interview Lab
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                                Shape the interview experience before connecting
                                a real AI provider.
                            </p>
                        </div>
                        <Link
                            href="/interview"
                            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
                        >
                            Start interview
                            <ArrowUpRight className="size-4" />
                        </Link>
                    </header>

                    <section className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl border bg-card p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    Provider
                                </span>
                                <Bot className="size-5 text-primary" />
                            </div>
                            <p className="mt-4 text-xl font-semibold">
                                Fake provider
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Ready for model integration
                            </p>
                        </div>
                        <div className="rounded-xl border bg-card p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    Interview mode
                                </span>
                                <Mic className="size-5 text-primary" />
                            </div>
                            <p className="mt-4 text-xl font-semibold">
                                Text only
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Voice comes after the core flow
                            </p>
                        </div>
                        <div className="rounded-xl border bg-card p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    Prototype status
                                </span>
                                <CircleCheck className="size-5 text-emerald-600" />
                            </div>
                            <p className="mt-4 text-xl font-semibold">
                                Runnable
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Three-question interview loop
                            </p>
                        </div>
                    </section>

                    <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                        <div className="rounded-xl border bg-card p-6 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium text-primary">
                                        Next experiment
                                    </p>
                                    <h2 className="mt-1 text-xl font-semibold">
                                        Run a baseline interview
                                    </h2>
                                </div>
                                <Bot className="size-6 text-muted-foreground" />
                            </div>
                            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                                Test the conversation loop with the
                                deterministic interviewer. Your answers stay in
                                the current session and are not sent to an
                                external service.
                            </p>
                            <Link
                                href="/interview"
                                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"
                            >
                                Open interview room
                                <ArrowUpRight className="size-4" />
                            </Link>
                        </div>
                        <div className="rounded-xl border bg-card p-6 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-md bg-primary/10 p-2 text-primary">
                                    <Settings2 className="size-5" />
                                </div>
                                <div>
                                    <h2 className="font-semibold">
                                        Build sequence
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        The prototype path
                                    </p>
                                </div>
                            </div>
                            <ol className="mt-6 space-y-4 text-sm">
                                <li className="flex gap-3">
                                    <span className="font-semibold text-primary">
                                        01
                                    </span>
                                    <span>Conversation loop</span>
                                </li>
                                <li className="flex gap-3 text-muted-foreground">
                                    <span className="font-semibold">02</span>
                                    <span>Editable interview behavior</span>
                                </li>
                                <li className="flex gap-3 text-muted-foreground">
                                    <span className="font-semibold">03</span>
                                    <span>Real AI provider adapter</span>
                                </li>
                            </ol>
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
