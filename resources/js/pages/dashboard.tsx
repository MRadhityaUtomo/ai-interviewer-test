import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, KeyRound, PhoneCall, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Auth } from '@/types';

const steps = [
    {
        icon: Video,
        title: 'Buat room',
        description:
            'Interviewer membuat room dan membagikan kode 6 karakter ke kandidat.',
    },
    {
        icon: KeyRound,
        title: 'Masuk dengan kode',
        description:
            'Kandidat memasukkan kode. Interview berjalan dalam mode layar penuh.',
    },
    {
        icon: PhoneCall,
        title: 'Mulai panggilan',
        description:
            'Video call dimulai. Ucapan kandidat ditranskrip untuk AI interviewer.',
    },
];

export default function Dashboard() {
    const { auth } = usePage<{ auth: Partial<Auth> }>().props;
    const role = auth.user?.role as string | undefined;

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex-1 p-4 md:p-8">
                <div className="mx-auto flex max-w-4xl flex-col gap-6 md:gap-8">
                    <section className="rounded-2xl border bg-card p-6 shadow-sm md:p-10">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                            <Video className="size-6" />
                        </div>
                        <h1 className="mt-6 text-2xl font-semibold tracking-tight md:text-3xl">
                            Interview video call
                        </h1>
                        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                            {role === 'interviewer'
                                ? 'Buat room baru, bagikan kodenya ke kandidat, lalu mulai panggilan.'
                                : role === 'applicant'
                                  ? 'Masukkan kode room dari interviewer untuk memulai interview.'
                                  : 'Masuk untuk membuat atau bergabung ke room interview.'}
                        </p>
                        <Button
                            asChild
                            size="lg"
                            className="mt-6 w-full sm:w-auto"
                        >
                            <Link href={auth.user ? '/rooms' : '/login'}>
                                {role === 'interviewer'
                                    ? 'Buat room'
                                    : role === 'applicant'
                                      ? 'Masukkan kode room'
                                      : 'Masuk'}
                                <ArrowRight />
                            </Link>
                        </Button>
                    </section>

                    <section className="grid gap-4 sm:grid-cols-3">
                        {steps.map(({ icon: Icon, title, description }, i) => (
                            <div
                                key={title}
                                className="rounded-xl border bg-card p-5"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                                        {i + 1}
                                    </span>
                                    <Icon className="size-4 text-muted-foreground" />
                                </div>
                                <h2 className="mt-4 font-medium">{title}</h2>
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                    {description}
                                </p>
                            </div>
                        ))}
                    </section>
                </div>
            </div>
        </>
    );
}
