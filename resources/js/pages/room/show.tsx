import { Head, router } from '@inertiajs/react';
import {
    Camera,
    CameraOff,
    Clock,
    Copy,
    Download,
    Film,
    HardDrive,
    Loader2,
    Mic,
    MicOff,
    Pause,
    PhoneCall,
    PhoneOff,
    Play,
    Square,
    Video,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    type SignalingPayload,
    type SignalingType,
    useRoomSignaling,
} from '@/hooks/use-room-signaling';
import { useLocalMedia } from '@/hooks/use-local-media';
import { useRoomPresence } from '@/hooks/use-room-presence';
import { useProctoringEvents } from '@/hooks/use-proctoring-events';
import { useWebRTC } from '@/hooks/use-webrtc';
import { useMeetingRecorder } from '@/hooks/use-meeting-recorder';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type Room = {
    code: string;
    status: string;
};

type RoomProps = {
    room: Room;
    participantRole: string;
    participantToken: string;
    participantCount: number;
};

type RecordingItem = {
    id: number;
    room_code: string;
    file_name: string;
    file_path: string;
    mime_type: string;
    size_bytes: number;
    duration_seconds: number | null;
    status: string;
    url: string;
    created_at: string;
    user?: {
        id: number;
        name: string;
        role: string;
    };
};

function getCsrfToken(): string {
    const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
    if (metaTag?.content) {
        return metaTag.content;
    }
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds: number | null): string {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
}

export default function RoomShow({
    room,
    participantRole,
    participantToken,
    participantCount: initialParticipantCount,
}: RoomProps) {
    const [copied, setCopied] = useState(false);
    const [lastSignal, setLastSignal] = useState<SignalingPayload | null>(null);
    const [violationWarning, setViolationWarning] = useState<string | null>(null);
    const [recordings, setRecordings] = useState<RecordingItem[]>([]);
    const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
    const [isRecordingsOpen, setIsRecordingsOpen] = useState(false);
    const [activePlaybackUrl, setActivePlaybackUrl] = useState<string | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const {
        stream,
        status: mediaStatus,
        error: mediaError,
        isMuted,
        cameraEnabled,
        pauseCamera,
        toggleMute,
        toggleCamera,
    } = useLocalMedia();

    const handleSignal = useCallback((payload: SignalingPayload) => {
        setLastSignal(payload);
        if (payload.type === 'violation_warning') {
            setViolationWarning(String(payload.data.event_type ?? 'unknown event'));
        }
    }, []);

    const { sendSignal } = useRoomSignaling(room.code, handleSignal);
    const {
        participantCount,
        error: presenceError,
        leave,
    } = useRoomPresence({
        roomCode: room.code,
        participantToken,
    });

    const isCaller = participantRole === 'interviewer';
    const isApplicant = participantRole === 'applicant';
    useProctoringEvents({ enabled: isApplicant, roomCode: room.code });

    const [isFullscreen, setIsFullscreen] = useState(!isApplicant);
    const [fullscreenError, setFullscreenError] = useState<string | null>(null);
    const wasFullscreenRef = useRef(false);

    const {
        remoteStream,
        connectionState,
        error: webrtcError,
        participantLeft,
        startCall,
        hangUp,
    } = useWebRTC({
        roomCode: room.code,
        localStream: stream,
        isCaller,
    });

    const fetchRecordings = useCallback(async () => {
        try {
            setIsLoadingRecordings(true);
            const res = await fetch(`/rooms/${room.code}/recordings`);
            if (res.ok) {
                const data = await res.json();
                setRecordings(data.recordings || []);
            }
        } catch (err) {
            console.error('Failed to fetch recordings:', err);
        } finally {
            setIsLoadingRecordings(false);
        }
    }, [room.code]);

    const handleRecordingComplete = useCallback(
        async (blob: Blob, durationSeconds: number) => {
            const formData = new FormData();
            formData.append('recording', blob, `rec_${room.code}_${Date.now()}.webm`);
            formData.append('duration', String(durationSeconds));

            const toastId = toast.loading('Menyimpan rekaman ke penyimpanan lokal...');
            try {
                const response = await fetch(`/rooms/${room.code}/recordings`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': getCsrfToken(),
                    },
                });

                if (!response.ok) {
                    if (response.status === 413) {
                        throw new Error('Ukuran file rekaman melebihi batas upload PHP server.');
                    }
                    if (response.status === 419) {
                        throw new Error('Sesi halaman telah kedaluwarsa. Silakan refresh halaman.');
                    }
                    const errorJson = await response.json().catch(() => ({}));
                    const validationErr = errorJson.errors?.recording?.[0] || errorJson.message;
                    throw new Error(validationErr || 'Gagal menyimpan rekaman ke server.');
                }

                toast.success('Rekaman meeting berhasil disimpan di penyimpanan lokal!', { id: toastId });
                fetchRecordings();
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Gagal mengunggah file rekaman';
                toast.error(message, { id: toastId });
                throw err;
            }
        },
        [room.code, fetchRecordings]
    );

    const {
        status: recordingStatus,
        formattedDuration,
        error: recordingError,
        isRecording,
        isPaused,
        isUploading,
        startRecording,
        pauseRecording,
        resumeRecording,
        stopRecording,
    } = useMeetingRecorder({
        localStream: stream,
        remoteStream,
        localVideoRef,
        remoteVideoRef,
        onRecordingComplete: handleRecordingComplete,
    });

    // Auto load recordings on mount
    useEffect(() => {
        if (isCaller) {
            fetchRecordings();
        }
    }, [isCaller, fetchRecordings]);

    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }
    }, [stream]);

    useEffect(() => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    useEffect(() => {
        if (!isApplicant) {
            return;
        }

        const handleFullscreenChange = () => {
            const active = document.fullscreenElement !== null;
            setIsFullscreen(active);

            if (!active && wasFullscreenRef.current) {
                pauseCamera();
            }

            wasFullscreenRef.current = active;
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        handleFullscreenChange();

        return () =>
            document.removeEventListener(
                'fullscreenchange',
                handleFullscreenChange,
            );
    }, [isApplicant, pauseCamera]);

    async function enterFullscreen() {
        try {
            await document.documentElement.requestFullscreen();
            setFullscreenError(null);
        } catch {
            setFullscreenError(
                'Fullscreen permission was not granted. Please try again.',
            );
        }
    }

    async function sendTestSignal(type: SignalingType) {
        await sendSignal(type, {
            prototype: true,
            sent_at: new Date().toISOString(),
        });
    }

    async function copyRoomCode() {
        await navigator.clipboard.writeText(room.code);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    }

    async function endCall() {
        if (isRecording) {
            stopRecording();
        }
        await leave();
        await hangUp();
        router.visit('/');
    }

    async function leaveRoom() {
        if (isRecording) {
            stopRecording();
        }
        await leave();
        router.visit('/rooms');
    }

    return (
        <>
            <Head title={`Room ${room.code}`} />
            {isApplicant && !isFullscreen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6 text-white">
                    <section className="max-w-md space-y-5 text-center">
                        <p className="text-sm font-medium tracking-[0.2em] text-white/60 uppercase">
                            Interview mode
                        </p>
                        <h1 className="text-3xl font-semibold">
                            Full-screen is required
                        </h1>
                        <p className="text-sm leading-relaxed text-white/65">
                            Enter full-screen mode to continue the interview.
                            The interviewer will be notified if you leave it.
                        </p>
                        <button
                            type="button"
                            onClick={() => void enterFullscreen()}
                            className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/85"
                        >
                            Enter full-screen
                        </button>
                        {fullscreenError && (
                            <p className="text-sm text-red-300">
                                {fullscreenError}
                            </p>
                        )}
                    </section>
                </div>
            )}
            <div className="min-h-full flex-1 bg-[#101214] p-4 text-white md:p-8">
                <div className="mx-auto flex max-w-6xl flex-col gap-6">
                    <header className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-sm text-white/60">
                                    Interview room
                                </p>
                                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                                    {isCaller ? 'Host & Review Panel' : 'Waiting room'}
                                </h1>
                            </div>

                            {/* Phase 17: Recording Status Badge */}
                            {isRecording && (
                                <div className="flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-300 shadow-sm animate-pulse">
                                    <span className="size-2 rounded-full bg-rose-500" />
                                    <span>REC</span>
                                    <span className="font-mono">{formattedDuration}</span>
                                </div>
                            )}
                            {isPaused && (
                                <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 shadow-sm">
                                    <span>❚❚ PAUSED</span>
                                    <span className="font-mono">{formattedDuration}</span>
                                </div>
                            )}
                            {isUploading && (
                                <div className="flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300 shadow-sm">
                                    <Loader2 className="size-3 animate-spin" />
                                    <span>SAVING RECORDING...</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Phase 18: Recording History Button for Host */}
                            {isCaller && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        fetchRecordings();
                                        setIsRecordingsOpen(true);
                                    }}
                                    className="flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                    <Film className="size-4 text-rose-400" />
                                    <span>Recordings</span>
                                    {recordings.length > 0 && (
                                        <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-xs font-semibold text-rose-300">
                                            {recordings.length}
                                        </span>
                                    )}
                                </button>
                            )}

                            <div className="flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm">
                                <span className="text-white/60">Code</span>
                                <strong className="tracking-[0.2em]">
                                    {room.code}
                                </strong>
                                <button
                                    type="button"
                                    onClick={copyRoomCode}
                                    className="ml-1 text-white/70 hover:text-white"
                                    title="Copy room code"
                                >
                                    <Copy className="size-4" />
                                </button>
                                {copied && (
                                    <span className="text-xs text-emerald-300">
                                        Copied
                                    </span>
                                )}
                            </div>
                        </div>
                    </header>

                    <section className="grid gap-4 md:grid-cols-2">
                        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className={`size-full object-cover ${cameraEnabled ? '' : 'opacity-0'}`}
                            />
                            {!cameraEnabled && (
                                <div className="absolute inset-0 flex items-center justify-center text-white/60">
                                    <CameraOff className="size-8" />
                                </div>
                            )}
                            <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs">
                                You ({participantRole})
                            </span>
                        </div>
                        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.03]">
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className={`size-full object-cover ${remoteStream ? '' : 'hidden'}`}
                            />
                            {!remoteStream && (
                                <p className="text-sm text-white/50">
                                    {participantLeft
                                        ? 'The other participant has left the room'
                                        : 'Waiting for the second participant'}
                                </p>
                            )}
                            {remoteStream && (
                                <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs">
                                    Other participant
                                </span>
                            )}
                        </div>
                    </section>

                    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
                        <div className="flex items-center gap-3 text-sm text-white/70">
                            {mediaStatus === 'ready' ? (
                                <Video className="size-4 text-emerald-300" />
                            ) : (
                                <Video className="size-4 text-amber-300" />
                            )}
                            <span>
                                {mediaStatus === 'ready'
                                    ? 'Camera and microphone ready'
                                    : mediaStatus === 'requesting'
                                      ? 'Requesting camera and microphone access...'
                                      : 'Camera and microphone unavailable'}
                            </span>
                        </div>

                        {/* Control Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-white/15 px-3 py-2 text-sm text-white/70">
                                WebRTC: {connectionState}
                            </span>

                            {/* Phase 17: Meeting Recording Controls (Interviewer only) */}
                            {isCaller && (
                                <>
                                    {recordingStatus === 'idle' && (
                                        <button
                                            type="button"
                                            onClick={startRecording}
                                            disabled={mediaStatus !== 'ready'}
                                            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                                            title="Start local meeting recording"
                                        >
                                            <span className="size-2 rounded-full bg-white" />
                                            Record meeting
                                        </button>
                                    )}

                                    {recordingStatus === 'recording' && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={pauseRecording}
                                                className="inline-flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-400/20 transition-colors"
                                            >
                                                <Pause className="size-4" />
                                                Pause REC
                                            </button>
                                            <button
                                                type="button"
                                                onClick={stopRecording}
                                                className="inline-flex items-center gap-2 rounded-md bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600 transition-colors"
                                            >
                                                <Square className="size-4 fill-white" />
                                                Stop & Save
                                            </button>
                                        </>
                                    )}

                                    {recordingStatus === 'paused' && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={resumeRecording}
                                                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                                            >
                                                <Play className="size-4 fill-white" />
                                                Resume REC
                                            </button>
                                            <button
                                                type="button"
                                                onClick={stopRecording}
                                                className="inline-flex items-center gap-2 rounded-md bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600 transition-colors"
                                            >
                                                <Square className="size-4 fill-white" />
                                                Stop & Save
                                            </button>
                                        </>
                                    )}

                                    {recordingStatus === 'uploading' && (
                                        <button
                                            type="button"
                                            disabled
                                            className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white/70 cursor-not-allowed"
                                        >
                                            <Loader2 className="size-4 animate-spin text-rose-400" />
                                            Saving to disk...
                                        </button>
                                    )}
                                </>
                            )}

                            {isCaller && (
                                <button
                                    type="button"
                                    onClick={() => void startCall()}
                                    disabled={mediaStatus !== 'ready'}
                                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <PhoneCall className="size-4" />
                                    Start call
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => void endCall()}
                                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
                            >
                                <PhoneOff className="size-4" />
                                End call
                            </button>

                            <button
                                type="button"
                                onClick={toggleMute}
                                disabled={mediaStatus !== 'ready'}
                                className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {isMuted ? (
                                    <MicOff className="size-4" />
                                ) : (
                                    <Mic className="size-4" />
                                )}
                                {isMuted ? 'Unmute' : 'Mute'}
                            </button>

                            <button
                                type="button"
                                onClick={toggleCamera}
                                disabled={mediaStatus !== 'ready'}
                                className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {cameraEnabled ? (
                                    <Camera className="size-4" />
                                ) : (
                                    <CameraOff className="size-4" />
                                )}
                                {cameraEnabled ? 'Camera off' : 'Camera on'}
                            </button>
                        </div>
                    </section>

                    {recordingError && (
                        <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-200">
                            Recording Error: {recordingError}
                        </p>
                    )}

                    {mediaError && (
                        <p className="rounded-md border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100">
                            {mediaError} Check the browser permission and reload the room.
                        </p>
                    )}

                    {webrtcError && (
                        <p className="rounded-md border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100">
                            {webrtcError}
                        </p>
                    )}

                    {!isApplicant && violationWarning && (
                        <p className="rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-100">
                            Warning: applicant reported {violationWarning}.
                        </p>
                    )}

                    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
                        <div>
                            <p className="text-sm font-medium">Room active</p>
                            <p className="mt-1 text-sm text-white/60">
                                You joined as {participantRole}. Participants:{' '}
                                {participantCount || initialParticipantCount}/2
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => void leaveRoom()}
                                className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10"
                            >
                                Leave room
                            </button>
                        </div>
                    </section>

                    {presenceError && (
                        <p className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                            {presenceError}
                        </p>
                    )}

                    <section className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5">
                        <p className="text-sm font-medium text-amber-100">
                            Signaling test
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                            These controls remain available for inspecting the
                            signaling layer while WebRTC is connected.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {(
                                ['offer', 'answer', 'ice-candidate'] as const
                            ).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => void sendTestSignal(type)}
                                    className="rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/10"
                                >
                                    Send {type}
                                </button>
                            ))}
                        </div>
                        <p className="mt-4 text-xs text-white/50">
                            {lastSignal
                                ? `Received ${lastSignal.type} from another participant.`
                                : 'No signaling message received yet.'}
                        </p>
                    </section>
                </div>
            </div>

            {/* Phase 18: Local Recordings Dialog & In-Browser Playback */}
            <Dialog open={isRecordingsOpen} onOpenChange={setIsRecordingsOpen}>
                <DialogContent className="max-w-2xl bg-[#16181b] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                            <Film className="size-5 text-rose-400" />
                            Local Meeting Recordings ({room.code})
                        </DialogTitle>
                        <DialogDescription className="text-white/60">
                            Rekaman video wawancara disimpan langsung di penyimpanan lokal server (`storage/app/public/recordings`).
                        </DialogDescription>
                    </DialogHeader>

                    {activePlaybackUrl && (
                        <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-black/50 p-3">
                            <div className="flex items-center justify-between text-xs text-white/70">
                                <span>Preview Pemutaran Video</span>
                                <button
                                    type="button"
                                    onClick={() => setActivePlaybackUrl(null)}
                                    className="text-white/50 hover:text-white"
                                >
                                    Tutup Player
                                </button>
                            </div>
                            <video
                                src={activePlaybackUrl}
                                controls
                                autoPlay
                                className="w-full rounded-md aspect-video bg-black"
                            />
                        </div>
                    )}

                    <div className="mt-4 max-h-72 overflow-y-auto space-y-3 pr-1">
                        {isLoadingRecordings && (
                            <div className="flex items-center justify-center py-8 text-white/60">
                                <Loader2 className="size-5 animate-spin mr-2" />
                                Memuat daftar rekaman...
                            </div>
                        )}

                        {!isLoadingRecordings && recordings.length === 0 && (
                            <div className="py-8 text-center text-sm text-white/50">
                                Belum ada rekaman tersimpan untuk ruangan ini. Tekan tombol &quot;Record meeting&quot; untuk mulai merekam.
                            </div>
                        )}

                        {!isLoadingRecordings &&
                            recordings.map((rec) => (
                                <div
                                    key={rec.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3.5 hover:bg-white/[0.07] transition-colors"
                                >
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-white/90">
                                            {rec.file_name}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                                            <span className="flex items-center gap-1">
                                                <Clock className="size-3 text-white/40" />
                                                {formatDuration(rec.duration_seconds)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <HardDrive className="size-3 text-white/40" />
                                                {formatBytes(rec.size_bytes)}
                                            </span>
                                            <span>
                                                Oleh: {rec.user?.name || 'Interviewer'}
                                            </span>
                                            <span>
                                                {new Date(rec.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setActivePlaybackUrl(rec.url)}
                                            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors"
                                        >
                                            <Play className="size-3 fill-white" />
                                            Play
                                        </button>
                                        <a
                                            href={`/recordings/${rec.id}/download`}
                                            download
                                            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 transition-colors"
                                        >
                                            <Download className="size-3" />
                                            Download
                                        </a>
                                    </div>
                                </div>
                            ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
