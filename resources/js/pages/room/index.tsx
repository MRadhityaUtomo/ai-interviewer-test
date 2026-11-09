import { Head, router, usePage } from '@inertiajs/react';
import { ArrowRight, KeyRound, Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type RoomIndexProps = {
    role: 'interviewer' | 'applicant';
};

export default function RoomIndex({ role }: RoomIndexProps) {
    const [roomCode, setRoomCode] = useState('');
    const [joinError, setJoinError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const { errors } = usePage().props;

    function createRoom(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.post('/rooms', undefined, {
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
        });
    }

    function joinRoom(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const normalizedCode = roomCode.trim().toUpperCase();

        if (!normalizedCode) {
            setJoinError('Masukkan kode room.');

            return;
        }

        setJoinError(null);
        router.post(
            '/room/join',
            { room_code: normalizedCode },
            {
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (validationErrors) => {
                    setJoinError(
                        validationErrors.room_code ??
                            'Tidak dapat bergabung ke room ini.',
                    );
                },
            },
        );
    }

    const error = joinError ?? errors.room_code;

    return (
        <>
            <Head title="Ruang interview" />
            <div className="flex flex-1 items-start justify-center p-4 md:items-center md:p-8">
                <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm md:p-8">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        {role === 'interviewer' ? (
                            <Plus className="size-6" />
                        ) : (
                            <KeyRound className="size-6" />
                        )}
                    </div>

                    {role === 'interviewer' ? (
                        <>
                            <h1 className="mt-6 text-2xl font-semibold tracking-tight">
                                Buat room interview
                            </h1>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                Kamu akan mendapat kode 6 karakter untuk
                                dibagikan ke kandidat.
                            </p>
                            <form onSubmit={createRoom} className="mt-6">
                                <Button
                                    type="submit"
                                    size="lg"
                                    className="w-full"
                                    disabled={processing}
                                >
                                    Buat room
                                    <ArrowRight />
                                </Button>
                            </form>
                        </>
                    ) : (
                        <>
                            <h1 className="mt-6 text-2xl font-semibold tracking-tight">
                                Masuk ke room
                            </h1>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                Masukkan kode room yang dibagikan interviewer.
                            </p>
                            <form
                                onSubmit={joinRoom}
                                className="mt-6 flex flex-col gap-3 sm:flex-row"
                            >
                                <Input
                                    value={roomCode}
                                    onChange={(event) =>
                                        setRoomCode(event.target.value)
                                    }
                                    placeholder="ABC123"
                                    maxLength={6}
                                    autoComplete="off"
                                    aria-label="Kode room"
                                    aria-invalid={Boolean(error)}
                                    className="h-10 text-center font-mono tracking-[0.3em] uppercase sm:text-left"
                                />
                                <Button
                                    type="submit"
                                    size="lg"
                                    disabled={processing}
                                >
                                    Masuk
                                </Button>
                            </form>
                            {error && (
                                <p className="mt-3 text-sm text-destructive">
                                    {error}
                                </p>
                            )}
                        </>
                    )}
                </section>
            </div>
        </>
    );
}
