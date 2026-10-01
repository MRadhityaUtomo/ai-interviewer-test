import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowRight, Plus, Video } from 'lucide-react';
import { FormEvent, useState } from 'react';

type RoomIndexProps = {
    role: 'interviewer' | 'applicant';
};

export default function RoomIndex({ role }: RoomIndexProps) {
    const [roomCode, setRoomCode] = useState('');
    const [joinError, setJoinError] = useState<string | null>(null);
    const { errors } = usePage().props;

    function createRoom(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.post('/rooms');
    }

    function joinRoom(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const normalizedCode = roomCode.trim().toUpperCase();

        if (normalizedCode) {
            setJoinError(null);
            router.post(
                '/room/join',
                { room_code: normalizedCode },
                {
                    onError: (validationErrors) => {
                        setJoinError(
                            validationErrors.room_code ??
                                'Unable to join this room.',
                        );
                    },
                },
            );
        } else {
            setJoinError('Enter a room code.');
        }
    }

    return (
        <>
            <Head title="Interview rooms" />
            <div className="min-h-full flex-1 bg-muted/30 p-4 md:p-8">
                <div className="mx-auto flex max-w-4xl flex-col gap-8">
                    <header>
                        <p className="text-sm font-medium text-primary">
                            Phase 1 prototype
                        </p>
                        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                            Interview rooms
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            Create or join a room before camera, microphone, and
                            WebRTC signaling are added.
                        </p>
                    </header>

                    <div
                        className={`grid gap-4 ${role === 'interviewer' ? 'md:grid-cols-2' : ''}`}
                    >
                        {role === 'interviewer' && (
                            <section className="rounded-xl border bg-card p-6 shadow-sm">
                                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <Plus className="size-5" />
                                </div>
                                <h2 className="mt-5 text-xl font-semibold">
                                    Create a room
                                </h2>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    Generate a room code and open a waiting room
                                    for two participants.
                                </p>
                                <form onSubmit={createRoom} className="mt-6">
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
                                    >
                                        Create room
                                        <ArrowRight className="size-4" />
                                    </button>
                                </form>
                            </section>
                        )}

                        {role === 'applicant' && (
                            <section className="rounded-xl border bg-card p-6 shadow-sm">
                                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <Video className="size-5" />
                                </div>
                                <h2 className="mt-5 text-xl font-semibold">
                                    Join a room
                                </h2>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    Enter a room code shared by the interviewer
                                    or applicant.
                                </p>
                                <form
                                    onSubmit={joinRoom}
                                    className="mt-6 flex gap-2"
                                >
                                    <input
                                        value={roomCode}
                                        onChange={(event) =>
                                            setRoomCode(event.target.value)
                                        }
                                        placeholder="ABC123"
                                        maxLength={6}
                                        className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
                                        aria-label="Room code"
                                    />
                                    <button
                                        type="submit"
                                        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                                    >
                                        Join
                                    </button>
                                </form>
                                {joinError || errors.room_code ? (
                                    <p className="mt-3 text-sm text-red-600">
                                        {joinError ?? errors.room_code}
                                    </p>
                                ) : null}
                            </section>
                        )}
                    </div>

                    <Link
                        href="/dashboard"
                        className="text-sm text-muted-foreground underline underline-offset-4"
                    >
                        Back to dashboard
                    </Link>
                </div>
            </div>
        </>
    );
}
