import { Head, router } from '@inertiajs/react';
import {
    AlertCircle,
    Camera,
    CameraOff,
    CheckCircle2,
    ChevronDown,
    Mic,
    MicOff,
    Video,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useDeviceSetup } from '@/hooks/use-device-setup';

type LobbyProps = {
    roomCode: string;
    participantRole: 'interviewer' | 'applicant';
};

export default function RoomLobby({ roomCode, participantRole }: LobbyProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

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

    // Attach stream to the preview video element
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    function enterRoom() {
        // Stop the lobby stream — the room page will re-acquire its own stream
        stopStream();
        router.visit(`/rooms/${roomCode}`);
    }

    const isReady = status === 'ready';
    const isDenied = status === 'denied' || status === 'unsupported';
    const isRequesting = status === 'requesting';

    // ─── Mic volume bar: split into 10 segments ──────────────────────────────
    const segments = 10;
    const filledSegments = Math.round((micVolume / 100) * segments);

    return (
        <>
            <Head title={`Device check — Room ${roomCode}`} />

            {/* Full-page dark layout, independent of the AppLayout sidebar */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f11] p-4 text-white">
                <div className="w-full max-w-3xl space-y-6">

                    {/* ── Header ─────────────────────────────────────────────── */}
                    <header className="space-y-1">
                        <p className="text-xs font-semibold tracking-[0.18em] text-white/40 uppercase">
                            {participantRole === 'interviewer' ? 'Interviewer' : 'Applicant'} · Room{' '}
                            <span className="tracking-[0.3em] text-white/70">{roomCode}</span>
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Pemeriksaan Perangkat
                        </h1>
                        <p className="text-sm text-white/50">
                            Pastikan kamera dan mikrofon berfungsi sebelum memasuki ruangan.
                        </p>
                    </header>

                    <div className="grid gap-5 md:grid-cols-[1fr_320px]">

                        {/* ── Left: Camera preview ────────────────────────────── */}
                        <div className="space-y-3">
                            <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl">
                                {/* Video element — always rendered so the ref attaches */}
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className={`size-full object-cover transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
                                />

                                {/* Overlay when camera not ready */}
                                {!isReady && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
                                        {isRequesting && (
                                            <>
                                                <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                                <p className="text-sm text-white/50">
                                                    Meminta akses kamera&hellip;
                                                </p>
                                            </>
                                        )}
                                        {isDenied && (
                                            <>
                                                <CameraOff className="size-10 text-white/30" />
                                                <p className="text-sm text-white/50">
                                                    Kamera tidak tersedia
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* "You" label */}
                                {isReady && (
                                    <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white/80 backdrop-blur-sm">
                                        Preview kamera Anda
                                    </span>
                                )}
                            </div>

                            {/* ── Mic volume indicator ─────────────────────── */}
                            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                {micVolume > 3 ? (
                                    <Mic className="size-4 shrink-0 text-emerald-400" />
                                ) : (
                                    <MicOff className="size-4 shrink-0 text-white/30" />
                                )}
                                <div
                                    className="flex flex-1 items-center gap-[3px]"
                                    role="meter"
                                    aria-label="Microphone volume"
                                    aria-valuenow={micVolume}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                >
                                    {Array.from({ length: segments }).map((_, i) => {
                                        const filled = i < filledSegments;
                                        // Green → yellow → red gradient based on position
                                        const color =
                                            i < 6
                                                ? filled
                                                    ? 'bg-emerald-400'
                                                    : 'bg-white/10'
                                                : i < 8
                                                  ? filled
                                                      ? 'bg-yellow-400'
                                                      : 'bg-white/10'
                                                  : filled
                                                    ? 'bg-red-400'
                                                    : 'bg-white/10';

                                        return (
                                            <div
                                                key={i}
                                                className={`h-5 flex-1 rounded-sm transition-colors duration-75 ${color}`}
                                            />
                                        );
                                    })}
                                </div>
                                <span className="w-8 text-right text-xs tabular-nums text-white/40">
                                    {micVolume}%
                                </span>
                            </div>
                        </div>

                        {/* ── Right: Controls ─────────────────────────────────── */}
                        <div className="flex flex-col gap-4">

                            {/* Status badge */}
                            <div
                                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                                    isReady
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                        : isDenied
                                          ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                          : 'border-white/10 bg-white/5 text-white/60'
                                }`}
                            >
                                {isReady ? (
                                    <CheckCircle2 className="size-4 shrink-0" />
                                ) : isDenied ? (
                                    <AlertCircle className="size-4 shrink-0" />
                                ) : (
                                    <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                )}
                                <span>
                                    {isReady
                                        ? 'Kamera & mikrofon siap'
                                        : isDenied
                                          ? error ?? 'Akses perangkat ditolak'
                                          : 'Menunggu izin akses…'}
                                </span>
                            </div>

                            {/* Camera selector */}
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="camera-select"
                                    className="flex items-center gap-1.5 text-xs font-medium text-white/50"
                                >
                                    <Camera className="size-3.5" />
                                    Kamera
                                </label>
                                <div className="relative">
                                    <select
                                        id="camera-select"
                                        value={selectedCamera}
                                        onChange={(e) => setSelectedCamera(e.target.value)}
                                        disabled={!isReady || cameras.length === 0}
                                        className="w-full appearance-none rounded-lg border border-white/15 bg-white/5 py-2.5 pl-3 pr-8 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {cameras.length === 0 && (
                                            <option value="">Tidak ada kamera ditemukan</option>
                                        )}
                                        {cameras.map((cam) => (
                                            <option
                                                key={cam.deviceId}
                                                value={cam.deviceId}
                                                className="bg-[#1a1d20] text-white"
                                            >
                                                {cam.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                                </div>
                            </div>

                            {/* Microphone selector */}
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="mic-select"
                                    className="flex items-center gap-1.5 text-xs font-medium text-white/50"
                                >
                                    <Mic className="size-3.5" />
                                    Mikrofon
                                </label>
                                <div className="relative">
                                    <select
                                        id="mic-select"
                                        value={selectedMicrophone}
                                        onChange={(e) => setSelectedMicrophone(e.target.value)}
                                        disabled={!isReady || microphones.length === 0}
                                        className="w-full appearance-none rounded-lg border border-white/15 bg-white/5 py-2.5 pl-3 pr-8 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {microphones.length === 0 && (
                                            <option value="">Tidak ada mikrofon ditemukan</option>
                                        )}
                                        {microphones.map((mic) => (
                                            <option
                                                key={mic.deviceId}
                                                value={mic.deviceId}
                                                className="bg-[#1a1d20] text-white"
                                            >
                                                {mic.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                                </div>
                            </div>

                            {/* Tip */}
                            <p className="rounded-lg border border-white/8 bg-white/[0.03] p-3 text-xs leading-relaxed text-white/40">
                                {participantRole === 'applicant'
                                    ? 'Setelah memasuki ruangan, Anda akan diminta mengaktifkan mode layar penuh sebagai bagian dari proses wawancara.'
                                    : 'Sebagai interviewer, Anda dapat memulai panggilan setelah kandidat bergabung.'}
                            </p>

                            {/* CTA */}
                            <div className="mt-auto pt-2">
                                <button
                                    id="enter-room-btn"
                                    type="button"
                                    onClick={enterRoom}
                                    disabled={!isReady}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Video className="size-4" />
                                    Masuk ke Ruangan
                                </button>
                                {isDenied && (
                                    <p className="mt-2 text-center text-xs text-white/40">
                                        Izinkan akses kamera & mikrofon di browser, lalu muat ulang halaman.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
