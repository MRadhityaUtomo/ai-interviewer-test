import { Head, Link } from '@inertiajs/react';

type RoomFullProps = {
    roomCode: string;
};

export default function RoomFull({ roomCode }: RoomFullProps) {
    return (
        <>
            <Head title="Room full" />
            <div className="flex min-h-full flex-1 items-center justify-center bg-muted/30 p-6">
                <section className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
                    <p className="text-sm font-medium text-red-600">
                        Room full
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold">
                        Ruangan penuh
                    </h1>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        Room {roomCode} sudah memiliki dua peserta aktif.
                    </p>
                    <Link
                        href="/rooms"
                        className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    >
                        Back to rooms
                    </Link>
                </section>
            </div>
        </>
    );
}
