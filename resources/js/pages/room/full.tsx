import { Head, Link } from '@inertiajs/react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

type RoomFullProps = {
    roomCode: string;
};

export default function RoomFull({ roomCode }: RoomFullProps) {
    return (
        <>
            <Head title="Room penuh" />
            <div className="flex flex-1 items-start justify-center p-4 md:items-center md:p-8">
                <section className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm md:p-8">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                        <Users className="size-6" />
                    </div>
                    <h1 className="mt-5 text-2xl font-semibold tracking-tight">
                        Room penuh
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Room{' '}
                        <span className="font-mono font-semibold">
                            {roomCode}
                        </span>{' '}
                        sudah memiliki dua peserta aktif. Coba lagi beberapa
                        saat lagi.
                    </p>
                    <Button asChild className="mt-6 w-full">
                        <Link href="/rooms">Kembali</Link>
                    </Button>
                </section>
            </div>
        </>
    );
}
