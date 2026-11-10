import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera,
    CameraOff,
    Check,
    Circle,
    Copy,
    Film,
    Loader2,
    Maximize,
    MessageSquareText,
    Mic,
    MicOff,
    Pause,
    PhoneCall,
    PhoneOff,
    Play,
    Send,
    Square,
    User,
    Users,
} from 'lucide-react';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { toast } from 'sonner';
import { ControlButton } from '@/components/room/control-button';
import { RecordingsDialog } from '@/components/room/recordings-dialog';
import type { RecordingItem } from '@/components/room/recordings-dialog';
import { TranscriptPanel } from '@/components/room/transcript-panel';
import type { InterviewMessageItem } from '@/components/room/transcript-panel';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from '@/components/ui/sheet';
import { useLocalMedia } from '@/hooks/use-local-media';
import { useMeetingRecorder } from '@/hooks/use-meeting-recorder';
import { useProctoringEvents } from '@/hooks/use-proctoring-events';
import { useRoomPresence } from '@/hooks/use-room-presence';
import {
    type SignalingPayload,
    useRoomSignaling,
} from '@/hooks/use-room-signaling';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { useVoiceActivity } from '@/hooks/use-voice-activity';
import { useWebRTC } from '@/hooks/use-webrtc';
import { cn } from '@/lib/utils';

type RoomProps = {
    room: { code: string; status: string };
    participantRole: string;
    participantToken: string;
    participantCount: number;
    messages?: InterviewMessageItem[];
};

const violationLabels: Record<string, string> = {
    tab_hidden: 'berpindah tab',
    window_blurred: 'meninggalkan jendela interview',
};

// The transcript panel sits beside the video from this width; below it opens as a sheet.
const desktopQuery = '(min-width: 1024px)';

function useIsDesktop(): boolean {
    return useSyncExternalStore(
        (callback) => {
            const mql = window.matchMedia(desktopQuery);
            mql.addEventListener('change', callback);
            return () => mql.removeEventListener('change', callback);
        },
        () => window.matchMedia(desktopQuery).matches,
        () => true,
    );
}

function getCsrfToken(): string {
    const metaTag = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]',
    );
    if (metaTag?.content) {
        return metaTag.content;
    }
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

export default function RoomShow({
    room,
    participantRole,
    participantToken,
    participantCount: initialParticipantCount,
    messages = [],
}: RoomProps) {
    const isCaller = participantRole === 'interviewer';
    const isApplicant = participantRole === 'applicant';
    const isDesktop = useIsDesktop();

    const [copied, setCopied] = useState(false);
    const [violationWarning, setViolationWarning] = useState<string | null>(
        null,
    );
    const [recordings, setRecordings] = useState<RecordingItem[]>([]);
    const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
    const [isRecordingsOpen, setIsRecordingsOpen] = useState(false);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [transcriptDraft, setTranscriptDraft] = useState('');
    const [isPanelOpen, setIsPanelOpen] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia(desktopQuery).matches,
    );

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
    const isLocalSpeaking = useVoiceActivity(stream);

    const handleSignal = useCallback((payload: SignalingPayload) => {
        if (payload.type === 'violation_warning') {
            const type =
                typeof payload.data.event_type === 'string'
                    ? payload.data.event_type
                    : 'unknown';
            const label = violationLabels[type] ?? type;
            setViolationWarning(label);
            toast.warning(`Kandidat ${label}.`);
        }
    }, []);

    useRoomSignaling(room.code, handleSignal);
    const {
        participantCount,
        error: presenceError,
        leave,
    } = useRoomPresence({
        roomCode: room.code,
        participantToken,
    });
    useProctoringEvents({ enabled: isApplicant, roomCode: room.code });

    // The lobby already enters full screen for applicants; start from the real state
    const [isFullscreen, setIsFullscreen] = useState(
        () =>
            !isApplicant ||
            (typeof document !== 'undefined' &&
                document.fullscreenElement !== null),
    );
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
    const isRemoteSpeaking = useVoiceActivity(remoteStream);

    // ---- Recordings (interviewer only) ----

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
            formData.append(
                'recording',
                blob,
                `rec_${room.code}_${Date.now()}.webm`,
            );
            formData.append('duration', String(durationSeconds));

            const toastId = toast.loading('Menyimpan rekaman…');
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
                        throw new Error(
                            'Ukuran rekaman melebihi batas upload server.',
                        );
                    }
                    if (response.status === 419) {
                        throw new Error(
                            'Sesi halaman kedaluwarsa. Silakan muat ulang halaman.',
                        );
                    }
                    const errorJson = await response.json().catch(() => ({}));
                    const validationErr =
                        errorJson.errors?.recording?.[0] || errorJson.message;
                    throw new Error(
                        validationErr || 'Gagal menyimpan rekaman.',
                    );
                }

                toast.success('Rekaman tersimpan.', { id: toastId });
                void fetchRecordings();
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Gagal mengunggah rekaman.';
                toast.error(message, { id: toastId });
                throw err;
            }
        },
        [room.code, fetchRecordings],
    );

    const {
        status: recordingStatus,
        formattedDuration,
        error: recordingError,
        isRecording,
        startRecording,
        pauseRecording,
        resumeRecording,
        stopRecording,
    } = useMeetingRecorder({
        localStream: stream,
        remoteStream,
        localVideoRef,
        remoteVideoRef,
        roomCode: room.code,
        autoDownload: true,
        onRecordingComplete: handleRecordingComplete,
    });

    useEffect(() => {
        if (isCaller) {
            void fetchRecordings();
        }
    }, [isCaller, fetchRecordings]);

    // ---- Speech-to-text (both roles; only applicant answers reach the AI) ----

    const {
        isActive: isSTTActive,
        isListening: isSTTListening,
        isSupported: isSTTSupported,
        currentLang: sttLang,
        setLang: setSTTLang,
        liveTranscript,
        interimTranscript,
        startListening: startSTT,
        stopListening: stopSTT,
        clearTranscript: clearSTT,
    } = useSpeechRecognition({
        lang: 'mixed',
        continuous: true,
        interimResults: true,
    });

    const sttEnabled = isSTTSupported;
    const sttUserPausedRef = useRef(false);
    const sttInitializedRef = useRef(false);

    useEffect(() => {
        if (liveTranscript) {
            setTranscriptDraft(liveTranscript);
        }
    }, [liveTranscript]);

    // Start once when the microphone first becomes ready
    useEffect(() => {
        if (!sttEnabled) return;

        if (mediaStatus === 'ready' && !isMuted && !sttInitializedRef.current) {
            sttInitializedRef.current = true;
            sttUserPausedRef.current = false;
            startSTT();
        }
    }, [sttEnabled, mediaStatus, isMuted, startSTT]);

    // Follow mute / unmute, unless the user paused detection manually
    useEffect(() => {
        if (!sttEnabled || !sttInitializedRef.current) return;

        if (isMuted) {
            stopSTT();
        } else if (!sttUserPausedRef.current) {
            startSTT();
        }
    }, [isMuted, sttEnabled, startSTT, stopSTT]);

    const handleToggleSTT = useCallback(() => {
        if (isSTTActive) {
            sttUserPausedRef.current = true;
            stopSTT();
        } else {
            sttUserPausedRef.current = false;
            startSTT();
        }
    }, [isSTTActive, startSTT, stopSTT]);

    const clearTranscript = useCallback(() => {
        clearSTT();
        setTranscriptDraft('');
    }, [clearSTT]);

    const sendMessageToAi = useCallback(() => {
        const text = (
            transcriptDraft + (interimTranscript ? ` ${interimTranscript}` : '')
        ).trim();

        if (!text) {
            toast.error(
                'Belum ada teks. Silakan bicara di mikrofon terlebih dahulu.',
            );
            return;
        }

        router.post(
            `/rooms/${room.code}/send-message`,
            { message: text },
            {
                preserveScroll: true,
                onStart: () => setIsProcessingAI(true),
                onSuccess: () => clearTranscript(),
                onError: (errors) => {
                    toast.error(
                        String(
                            Object.values(errors)[0] ||
                                'Gagal mengirim transkrip.',
                        ),
                    );
                },
                onFinish: () => setIsProcessingAI(false),
            },
        );
    }, [transcriptDraft, interimTranscript, room.code, clearTranscript]);

    // Both sides see each other's transcript lines and AI replies as they arrive
    useEffect(() => {
        const interval = window.setInterval(() => {
            router.reload({
                only: ['messages'],
                showProgress: false,
                async: true,
            });
        }, 5000);

        return () => window.clearInterval(interval);
    }, []);

    // ---- Media elements ----

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

    // ---- Applicant full-screen requirement ----

    useEffect(() => {
        if (!isApplicant) return;

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
                'Izin layar penuh tidak diberikan. Silakan coba lagi.',
            );
        }
    }

    async function copyRoomCode() {
        await navigator.clipboard.writeText(room.code);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    }

    async function leaveCall() {
        if (isRecording) {
            stopRecording();
        }
        await leave();
        await hangUp();
        router.visit('/rooms');
    }

    // ---- Derived UI state ----

    const mediaReady = mediaStatus === 'ready';
    const isConnected =
        Boolean(remoteStream) && connectionState === 'connected';
    const isConnecting =
        connectionState === 'new' || connectionState === 'connecting';
    const count = participantCount || initialParticipantCount;

    const status = isConnected
        ? { label: 'Terhubung', dot: 'bg-emerald-500' }
        : isConnecting
          ? { label: 'Menghubungkan…', dot: 'animate-pulse bg-amber-500' }
          : connectionState === 'failed' || connectionState === 'disconnected'
            ? { label: 'Koneksi terputus', dot: 'bg-destructive' }
            : count < 2
              ? { label: 'Menunggu peserta', dot: 'bg-muted-foreground/60' }
              : {
                    label: isCaller ? 'Siap dimulai' : 'Menunggu interviewer',
                    dot: 'bg-sky-500',
                };

    const remotePlaceholder = participantLeft
        ? 'Peserta lain telah keluar'
        : count < 2
          ? isCaller
              ? 'Bagikan kode room ke kandidat'
              : 'Menunggu interviewer bergabung'
          : isCaller
            ? 'Kandidat sudah masuk. Klik Mulai panggilan.'
            : 'Menunggu interviewer memulai panggilan';

    const alerts = [
        mediaError &&
            `${mediaError} Periksa izin kamera/mikrofon di browser, lalu muat ulang halaman.`,
        webrtcError,
        presenceError,
        recordingError && `Rekaman gagal: ${recordingError}`,
    ].filter(Boolean) as string[];

    const renderPanel = (inSheet: boolean) => (
        <TranscriptPanel
            inSheet={inSheet}
            messages={messages}
            isProcessingAI={isProcessingAI}
            viewerRole={isCaller ? 'interviewer' : 'applicant'}
            stt={{
                isSupported: isSTTSupported,
                isActive: isSTTActive,
                isListening: isSTTListening,
                lang: sttLang,
                setLang: setSTTLang,
                toggle: handleToggleSTT,
            }}
            draft={transcriptDraft}
            interim={interimTranscript}
            onDraftChange={setTranscriptDraft}
            onClear={clearTranscript}
            onSend={sendMessageToAi}
        />
    );

    return (
        <>
            <Head title={`Room ${room.code}`} />

            {isApplicant && !isFullscreen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm">
                    <section className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-lg sm:p-8">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                            <Maximize className="size-6" />
                        </div>
                        <h1 className="mt-5 text-xl font-semibold">
                            Mode layar penuh diperlukan
                        </h1>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            Interview berjalan dalam layar penuh. Interviewer
                            akan diberi tahu jika kamu keluar dari layar penuh
                            atau berpindah tab.
                        </p>
                        <Button
                            size="lg"
                            className="mt-6 w-full"
                            onClick={() => void enterFullscreen()}
                        >
                            Masuk layar penuh
                        </Button>
                        {fullscreenError && (
                            <p className="mt-3 text-sm text-destructive">
                                {fullscreenError}
                            </p>
                        )}
                    </section>
                </div>
            )}

            <div className="flex h-dvh flex-col bg-background text-foreground">
                {/* Top bar */}
                <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => void copyRoomCode()}
                            className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
                            title="Salin kode room"
                        >
                            <span className="hidden text-muted-foreground sm:inline">
                                Room
                            </span>
                            <span className="font-mono font-semibold tracking-[0.2em]">
                                {room.code}
                            </span>
                            {copied ? (
                                <Check className="size-3.5 text-emerald-600" />
                            ) : (
                                <Copy className="size-3.5 text-muted-foreground" />
                            )}
                        </button>

                        <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                            <span
                                className={cn(
                                    'size-2 shrink-0 rounded-full',
                                    status.dot,
                                )}
                            />
                            <span className="truncate">{status.label}</span>
                        </span>

                        {recordingStatus === 'recording' && (
                            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                                <span className="size-2 animate-pulse rounded-full bg-destructive" />
                                <span className="font-mono">
                                    {formattedDuration}
                                </span>
                            </span>
                        )}
                        {recordingStatus === 'paused' && (
                            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                <Pause className="size-3" />
                                <span className="font-mono">
                                    {formattedDuration}
                                </span>
                            </span>
                        )}
                        {recordingStatus === 'uploading' && (
                            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="size-3.5 animate-spin" />
                                <span className="hidden sm:inline">
                                    Menyimpan rekaman…
                                </span>
                            </span>
                        )}
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-1">
                        <span
                            className="mr-1 hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex"
                            title="Peserta di room"
                        >
                            <Users className="size-4" />
                            {count}/2
                        </span>
                        {isCaller && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="relative rounded-full"
                                aria-label="Rekaman"
                                title="Rekaman"
                                onClick={() => {
                                    void fetchRecordings();
                                    setIsRecordingsOpen(true);
                                }}
                            >
                                <Film />
                                {recordings.length > 0 && (
                                    <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                                        {recordings.length}
                                    </span>
                                )}
                            </Button>
                        )}
                        <Button
                            variant={isPanelOpen ? 'secondary' : 'ghost'}
                            size="icon"
                            className="rounded-full"
                            aria-label={
                                isPanelOpen
                                    ? 'Tutup transkrip'
                                    : 'Buka transkrip'
                            }
                            aria-pressed={isPanelOpen}
                            title="Transkrip & AI"
                            onClick={() => setIsPanelOpen((open) => !open)}
                        >
                            <MessageSquareText />
                        </Button>
                        <ThemeToggle />
                    </div>
                </header>

                <div className="flex min-h-0 flex-1">
                    <main className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
                        {(alerts.length > 0 ||
                            (isCaller && violationWarning)) && (
                            <div className="space-y-2">
                                {isCaller && violationWarning && (
                                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                        <span className="flex-1">
                                            Peringatan: kandidat{' '}
                                            {violationWarning}.
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setViolationWarning(null)
                                            }
                                            className="text-xs underline underline-offset-2"
                                        >
                                            Tutup
                                        </button>
                                    </div>
                                )}
                                {alerts.map((message) => (
                                    <div
                                        key={message}
                                        className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                                    >
                                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                        <span>{message}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Video stage: the other participant fills it, you appear as a picture-in-picture tile */}
                        <div
                            className={cn(
                                'relative min-h-0 flex-1 overflow-hidden rounded-2xl border-2 bg-neutral-900 transition-colors duration-150 dark:bg-neutral-800',
                                isRemoteSpeaking
                                    ? 'border-emerald-400'
                                    : 'border-transparent',
                            )}
                        >
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className={cn(
                                    'size-full object-contain',
                                    !remoteStream && 'hidden',
                                )}
                            />

                            {!remoteStream && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-neutral-300">
                                    <div className="flex size-16 items-center justify-center rounded-full bg-neutral-800 dark:bg-neutral-700">
                                        {isConnecting ? (
                                            <Loader2 className="size-7 animate-spin" />
                                        ) : (
                                            <User className="size-7" />
                                        )}
                                    </div>
                                    <p className="max-w-xs text-sm">
                                        {remotePlaceholder}
                                    </p>
                                </div>
                            )}

                            {remoteStream && (
                                <span className="absolute top-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
                                    {isCaller ? 'Kandidat' : 'Interviewer'}
                                </span>
                            )}

                            {/* Live subtitle of what the applicant is saying */}
                            {sttEnabled && interimTranscript && (
                                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center sm:bottom-4">
                                    <p className="max-w-[min(36rem,65%)] rounded-lg bg-black/75 px-3 py-1.5 text-center text-xs text-white sm:text-sm">
                                        {interimTranscript}
                                    </p>
                                </div>
                            )}

                            {/* Self view */}
                            <div
                                className={cn(
                                    'absolute right-3 bottom-3 aspect-video w-28 overflow-hidden rounded-xl border-2 bg-neutral-800 shadow-lg transition-colors duration-150 sm:w-44 md:w-56 dark:bg-neutral-700',
                                    isLocalSpeaking
                                        ? 'border-emerald-400'
                                        : 'border-white/20',
                                )}
                            >
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className={cn(
                                        'size-full -scale-x-100 object-cover',
                                        !cameraEnabled && 'invisible',
                                    )}
                                />
                                {!cameraEnabled && (
                                    <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                                        <CameraOff className="size-5" />
                                    </div>
                                )}
                                <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white sm:text-xs">
                                    {isMuted && <MicOff className="size-3" />}
                                    Kamu
                                </span>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 sm:gap-3">
                            <ControlButton
                                label={
                                    isMuted
                                        ? 'Nyalakan mikrofon'
                                        : 'Matikan mikrofon'
                                }
                                icon={isMuted ? <MicOff /> : <Mic />}
                                tone={isMuted ? 'active' : 'default'}
                                onClick={toggleMute}
                                disabled={!mediaReady}
                            />
                            <ControlButton
                                label={
                                    cameraEnabled
                                        ? 'Matikan kamera'
                                        : 'Nyalakan kamera'
                                }
                                icon={
                                    cameraEnabled ? <Camera /> : <CameraOff />
                                }
                                tone={cameraEnabled ? 'default' : 'active'}
                                onClick={toggleCamera}
                                disabled={!mediaReady}
                            />

                            {isCaller && (
                                <>
                                    {recordingStatus === 'idle' ||
                                    recordingStatus === 'stopped' ? (
                                        <ControlButton
                                            label="Mulai rekam"
                                            icon={
                                                <Circle className="fill-destructive text-destructive" />
                                            }
                                            onClick={startRecording}
                                            disabled={!mediaReady}
                                        />
                                    ) : recordingStatus === 'uploading' ? (
                                        <ControlButton
                                            label="Menyimpan rekaman"
                                            icon={
                                                <Loader2 className="animate-spin" />
                                            }
                                            onClick={() => {}}
                                            disabled
                                        />
                                    ) : (
                                        <>
                                            <ControlButton
                                                label={
                                                    recordingStatus === 'paused'
                                                        ? 'Lanjutkan rekam'
                                                        : 'Jeda rekam'
                                                }
                                                icon={
                                                    recordingStatus ===
                                                    'paused' ? (
                                                        <Play />
                                                    ) : (
                                                        <Pause />
                                                    )
                                                }
                                                onClick={
                                                    recordingStatus === 'paused'
                                                        ? resumeRecording
                                                        : pauseRecording
                                                }
                                            />
                                            <ControlButton
                                                label="Stop & simpan rekaman"
                                                icon={
                                                    <Square className="fill-current" />
                                                }
                                                tone="active"
                                                onClick={stopRecording}
                                            />
                                        </>
                                    )}

                                    {!isConnected && (
                                        <ControlButton
                                            label="Mulai panggilan"
                                            icon={<PhoneCall />}
                                            tone="success"
                                            showLabel
                                            onClick={() => void startCall()}
                                            disabled={
                                                !mediaReady || isConnecting
                                            }
                                        />
                                    )}
                                </>
                            )}

                            {isApplicant && (
                                <ControlButton
                                    label={
                                        isProcessingAI
                                            ? 'AI memproses…'
                                            : 'Kirim jawaban'
                                    }
                                    icon={
                                        isProcessingAI ? (
                                            <Loader2 className="animate-spin" />
                                        ) : (
                                            <Send />
                                        )
                                    }
                                    tone="success"
                                    showLabel
                                    onClick={sendMessageToAi}
                                    disabled={
                                        isProcessingAI ||
                                        !(transcriptDraft || interimTranscript)
                                    }
                                />
                            )}

                            <ControlButton
                                label="Keluar"
                                icon={<PhoneOff />}
                                tone="danger"
                                showLabel
                                onClick={() => void leaveCall()}
                            />
                        </div>
                    </main>

                    {isDesktop && isPanelOpen && (
                        <aside className="hidden w-[22rem] shrink-0 border-l lg:block xl:w-96">
                            {renderPanel(false)}
                        </aside>
                    )}
                </div>
            </div>

            {!isDesktop && (
                <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
                    <SheetContent
                        side="bottom"
                        className="h-[75dvh] gap-0 rounded-t-2xl p-0"
                    >
                        <SheetTitle className="sr-only">
                            Transkrip & AI
                        </SheetTitle>
                        <SheetDescription className="sr-only">
                            Transkrip jawaban kandidat dan respons AI
                            interviewer.
                        </SheetDescription>
                        {renderPanel(true)}
                    </SheetContent>
                </Sheet>
            )}

            {isCaller && (
                <RecordingsDialog
                    open={isRecordingsOpen}
                    onOpenChange={setIsRecordingsOpen}
                    roomCode={room.code}
                    recordings={recordings}
                    isLoading={isLoadingRecordings}
                />
            )}
        </>
    );
}
