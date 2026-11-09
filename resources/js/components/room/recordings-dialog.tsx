import {
    Clock,
    Download,
    Film,
    HardDrive,
    Loader2,
    Play,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export type RecordingItem = {
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

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number | null): string {
    const total = seconds ?? 0;
    const mins = Math.floor(total / 60);
    const secs = String(total % 60).padStart(2, '0');
    return `${mins}:${secs}`;
}

type RecordingsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roomCode: string;
    recordings: RecordingItem[];
    isLoading: boolean;
};

export function RecordingsDialog({
    open,
    onOpenChange,
    roomCode,
    recordings,
    isLoading,
}: RecordingsDialogProps) {
    const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) setPlaybackUrl(null);
                onOpenChange(next);
            }}
        >
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Film className="size-5" />
                        Rekaman room {roomCode}
                    </DialogTitle>
                    <DialogDescription>
                        Rekaman tersimpan di server dan bisa diputar atau
                        diunduh.
                    </DialogDescription>
                </DialogHeader>

                {playbackUrl && (
                    <div className="space-y-2">
                        <video
                            src={playbackUrl}
                            controls
                            autoPlay
                            className="aspect-video w-full rounded-lg bg-black"
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPlaybackUrl(null)}
                        >
                            <X />
                            Tutup pemutar
                        </Button>
                    </div>
                )}

                <div className="space-y-2">
                    {isLoading && (
                        <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Memuat rekaman…
                        </p>
                    )}

                    {!isLoading && recordings.length === 0 && (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            Belum ada rekaman. Tekan tombol rekam di bawah video
                            untuk mulai merekam.
                        </p>
                    )}

                    {!isLoading &&
                        recordings.map((rec) => (
                            <div
                                key={rec.id}
                                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0 space-y-1">
                                    <p className="truncate text-sm font-medium">
                                        {new Date(
                                            rec.created_at,
                                        ).toLocaleString()}
                                    </p>
                                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="size-3" />
                                            {formatDuration(
                                                rec.duration_seconds,
                                            )}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <HardDrive className="size-3" />
                                            {formatBytes(rec.size_bytes)}
                                        </span>
                                        <span>
                                            {rec.user?.name ?? 'Interviewer'}
                                        </span>
                                    </p>
                                </div>

                                <div className="flex shrink-0 gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 sm:flex-none"
                                        onClick={() => setPlaybackUrl(rec.url)}
                                    >
                                        <Play />
                                        Putar
                                    </Button>
                                    <Button
                                        asChild
                                        size="sm"
                                        className="flex-1 sm:flex-none"
                                    >
                                        <a
                                            href={`/recordings/${rec.id}/download`}
                                            download
                                        >
                                            <Download />
                                            Unduh
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
