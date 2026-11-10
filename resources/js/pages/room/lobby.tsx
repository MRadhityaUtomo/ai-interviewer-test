import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    Camera,
    CameraOff,
    CheckCircle2,
    Loader2,
    Maximize,
    Mic,
    MicOff,
    Video,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { DeviceInfo } from '@/hooks/use-device-setup';
import { useDeviceSetup } from '@/hooks/use-device-setup';
import { saveMediaPreferences } from '@/lib/media-preferences';
import { cn } from '@/lib/utils';

type LobbyProps = {
    roomCode: string;
    participantRole: 'interviewer' | 'applicant';
};

const METER_SEGMENTS = 12;

function DeviceSelect({
    id,
    label,
    icon: Icon,
    devices,
    value,
    onChange,
    disabled,
    emptyLabel,
}: {
    id: string;
    label: string;
    icon: typeof Camera;
    devices: DeviceInfo[];
    value: string;
    onChange: (deviceId: string) => void;
    disabled: boolean;
    emptyLabel: string;
}) {
    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className="flex items-center gap-1.5 text-sm font-medium"
            >
                <Icon className="size-4 text-muted-foreground" />
                {label}
            </label>
            <Select
                value={value || undefined}
                onValueChange={onChange}
                disabled={disabled || devices.length === 0}
            >
                <SelectTrigger id={id} className="w-full">
                    <SelectValue placeholder={emptyLabel} />
                </SelectTrigger>
                <SelectContent>
                    {devices.map((device) => (
                        <SelectItem
                            key={device.deviceId}
                            value={device.deviceId}
                        >
                            {device.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export default function RoomLobby({ roomCode, participantRole }: LobbyProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isEntering, setIsEntering] = useState(false);
    const isApplicant = participantRole === 'applicant';

    const {
        stream,
        status,
        error,
        cameras,
        microphones,
        selectedCamera,
        selectedMicrophone,
        micVolume,
        setSelectedCamera,
        setSelectedMicrophone,
        stopStream,
    } = useDeviceSetup();

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const isReady = status === 'ready';
    const isDenied = status === 'denied' || status === 'unsupported';
    const filledSegments = Math.round((micVolume / 100) * METER_SEGMENTS);
    const hearsSound = micVolume > 3;

    async function enterRoom() {
        setIsEntering(true);
        saveMediaPreferences({
            cameraId: selectedCamera || undefined,
            microphoneId: selectedMicrophone || undefined,
        });

        // The interview requires full screen; this click is the user gesture that
        // allows it, and it survives the Inertia visit (no page reload).
        if (isApplicant && !document.fullscreenElement) {
            try {
                await document.documentElement.requestFullscreen();
            } catch {
                // Declined: the room shows its own full-screen prompt
            }
        }

        // Release the camera so the room can open it with the same devices
        stopStream();
        router.visit(`/rooms/${roomCode}`, {
            onFinish: () => setIsEntering(false),
        });
    }

    return (
        <>
            <Head title={`Cek perangkat · Room ${roomCode}`} />

            <div className="flex min-h-dvh flex-col bg-background text-foreground">
                <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
                    <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        aria-label="Kembali"
                    >
                        <Link href="/rooms">
                            <ArrowLeft />
                        </Link>
                    </Button>
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                        <span className="hidden text-muted-foreground sm:inline">
                            Room
                        </span>
                        <span className="font-mono font-semibold tracking-[0.2em]">
                            {roomCode}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {isApplicant ? 'Kandidat' : 'Interviewer'}
                        </span>
                    </div>
                    <ThemeToggle className="ml-auto" />
                </header>

                <main className="flex flex-1 items-start justify-center p-4 md:items-center md:p-8">
                    <div className="w-full max-w-4xl">
                        <div className="mb-5 md:mb-6">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Cek kamera & mikrofon
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Pastikan wajahmu terlihat dan suaramu terdeteksi
                                sebelum masuk ke room.
                            </p>
                        </div>

                        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-6">
                            <div className="space-y-3">
                                <div className="relative aspect-video overflow-hidden rounded-2xl border bg-neutral-900 dark:bg-neutral-800">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className={cn(
                                            'size-full -scale-x-100 object-cover transition-opacity duration-300',
                                            isReady
                                                ? 'opacity-100'
                                                : 'opacity-0',
                                        )}
                                    />
                                    {!isReady && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-neutral-300">
                                            {isDenied ? (
                                                <CameraOff className="size-8" />
                                            ) : (
                                                <Loader2 className="size-8 animate-spin" />
                                            )}
                                            <p className="text-sm">
                                                {isDenied
                                                    ? 'Kamera tidak tersedia'
                                                    : 'Meminta akses kamera…'}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                                    {hearsSound ? (
                                        <Mic className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                        <MicOff className="size-4 shrink-0 text-muted-foreground" />
                                    )}
                                    <div
                                        className="flex flex-1 items-center gap-[3px]"
                                        role="meter"
                                        aria-label="Volume mikrofon"
                                        aria-valuenow={micVolume}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                    >
                                        {Array.from({
                                            length: METER_SEGMENTS,
                                        }).map((_, i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    'h-4 flex-1 rounded-sm transition-colors duration-75',
                                                    i >= filledSegments
                                                        ? 'bg-muted'
                                                        : i <
                                                            METER_SEGMENTS * 0.6
                                                          ? 'bg-emerald-500'
                                                          : i <
                                                              METER_SEGMENTS *
                                                                  0.85
                                                            ? 'bg-amber-500'
                                                            : 'bg-red-500',
                                                )}
                                            />
                                        ))}
                                    </div>
                                    <span className="hidden text-xs text-muted-foreground sm:inline">
                                        {hearsSound
                                            ? 'Suara terdeteksi'
                                            : 'Coba bicara'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div
                                    className={cn(
                                        'flex items-start gap-2 rounded-xl border px-4 py-3 text-sm',
                                        isReady &&
                                            'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                                        isDenied &&
                                            'border-destructive/40 bg-destructive/10 text-destructive',
                                        !isReady &&
                                            !isDenied &&
                                            'text-muted-foreground',
                                    )}
                                >
                                    {isReady ? (
                                        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                                    ) : isDenied ? (
                                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                    ) : (
                                        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
                                    )}
                                    <span>
                                        {isReady
                                            ? 'Kamera & mikrofon siap'
                                            : isDenied
                                              ? `${error ?? 'Akses perangkat ditolak.'} Izinkan akses di browser, lalu muat ulang halaman.`
                                              : 'Menunggu izin akses…'}
                                    </span>
                                </div>

                                <DeviceSelect
                                    id="camera-select"
                                    label="Kamera"
                                    icon={Camera}
                                    devices={cameras}
                                    value={selectedCamera}
                                    onChange={setSelectedCamera}
                                    disabled={!isReady}
                                    emptyLabel="Tidak ada kamera"
                                />
                                <DeviceSelect
                                    id="mic-select"
                                    label="Mikrofon"
                                    icon={Mic}
                                    devices={microphones}
                                    value={selectedMicrophone}
                                    onChange={setSelectedMicrophone}
                                    disabled={!isReady}
                                    emptyLabel="Tidak ada mikrofon"
                                />

                                <p className="text-xs leading-relaxed text-muted-foreground">
                                    {isApplicant
                                        ? 'Interview berjalan dalam layar penuh. Interviewer akan diberi tahu jika kamu keluar dari layar penuh atau berpindah tab.'
                                        : 'Kamu bisa memulai panggilan setelah kandidat masuk ke room.'}
                                </p>

                                <Button
                                    size="lg"
                                    className="mt-auto w-full"
                                    onClick={() => void enterRoom()}
                                    disabled={!isReady || isEntering}
                                >
                                    {isEntering ? (
                                        <Loader2 className="animate-spin" />
                                    ) : isApplicant ? (
                                        <Maximize />
                                    ) : (
                                        <Video />
                                    )}
                                    {isApplicant
                                        ? 'Masuk (layar penuh)'
                                        : 'Masuk ke room'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
