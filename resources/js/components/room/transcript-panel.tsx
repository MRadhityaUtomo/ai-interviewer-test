import {
    Bot,
    Loader2,
    Mic,
    MicOff,
    Send,
    Trash2,
    User,
    UserRound,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { STTLanguageMode } from '@/hooks/use-speech-recognition';
import { cn } from '@/lib/utils';

type ParticipantRole = 'applicant' | 'interviewer';

export type InterviewMessageItem = {
    id: number;
    role: ParticipantRole | 'ai_assistant';
    message: string;
    created_at: string;
};

type TranscriptPanelProps = {
    messages: InterviewMessageItem[];
    isProcessingAI: boolean;
    /** Applicant answers go to the AI; interviewer lines are only saved to the transcript. */
    viewerRole: ParticipantRole;
    stt: {
        isSupported: boolean;
        isActive: boolean;
        isListening: boolean;
        lang: STTLanguageMode;
        setLang: (lang: STTLanguageMode) => void;
        toggle: () => void;
    };
    draft: string;
    interim: string;
    onDraftChange: (value: string) => void;
    onClear: () => void;
    onSend: () => void;
    /** Leaves room on the right of the header for the sheet's close button. */
    inSheet?: boolean;
};

const languages: { value: STTLanguageMode; label: string }[] = [
    { value: 'mixed', label: 'Campuran ID–EN' },
    { value: 'id-ID', label: 'Indonesia' },
    { value: 'en-US', label: 'English' },
];

const authors = {
    applicant: { label: 'Kandidat', icon: User },
    interviewer: { label: 'Interviewer', icon: UserRound },
    ai_assistant: { label: 'AI', icon: Bot },
};

export function TranscriptPanel({
    messages,
    isProcessingAI,
    viewerRole,
    stt,
    draft,
    interim,
    onDraftChange,
    onClear,
    onSend,
    inSheet = false,
}: TranscriptPanelProps) {
    const listRef = useRef<HTMLDivElement>(null);
    const hasText = Boolean(draft || interim);
    const isApplicant = viewerRole === 'applicant';
    // Only applicant answers trigger an AI reply
    const isWaitingForAI = isApplicant && isProcessingAI;

    // Keep the newest message in view
    useEffect(() => {
        listRef.current?.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: 'smooth',
        });
    }, [messages.length, isWaitingForAI]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div
                className={cn(
                    'flex items-center justify-between gap-2 border-b px-4 py-3',
                    inSheet && 'pr-12',
                )}
            >
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold">Transkrip & AI</h2>
                    {stt.isSupported && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                                className={cn(
                                    'size-1.5 rounded-full',
                                    stt.isListening
                                        ? 'animate-pulse bg-emerald-500'
                                        : 'bg-muted-foreground/50',
                                )}
                            />
                            {stt.isListening
                                ? 'Mendengarkan…'
                                : 'Deteksi suara dijeda'}
                        </p>
                    )}
                </div>
                {stt.isSupported && (
                    <div className="flex shrink-0 items-center gap-1.5">
                        <Select
                            value={stt.lang}
                            onValueChange={(value) =>
                                stt.setLang(value as STTLanguageMode)
                            }
                        >
                            <SelectTrigger
                                size="sm"
                                className="w-[9.5rem] text-xs"
                                aria-label="Bahasa deteksi suara"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {languages.map(({ value, label }) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={stt.toggle}
                            aria-label={
                                stt.isActive
                                    ? 'Jeda deteksi suara'
                                    : 'Mulai deteksi suara'
                            }
                            title={
                                stt.isActive
                                    ? 'Jeda deteksi suara'
                                    : 'Mulai deteksi suara'
                            }
                        >
                            {stt.isActive ? <MicOff /> : <Mic />}
                        </Button>
                    </div>
                )}
            </div>

            <div
                ref={listRef}
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
            >
                {messages.length === 0 && !isWaitingForAI ? (
                    <p className="m-auto max-w-[16rem] text-center text-sm text-muted-foreground">
                        Belum ada percakapan. Ucapanmu muncul di kotak bawah,
                        lalu kirim untuk menyimpannya di transkrip.
                    </p>
                ) : (
                    messages.map((msg) => {
                        const own = msg.role === viewerRole;
                        const author = authors[msg.role] ?? authors.applicant;
                        const Icon = author.icon;

                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    'flex max-w-[90%] gap-2',
                                    own
                                        ? 'flex-row-reverse self-end'
                                        : 'self-start',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex size-7 shrink-0 items-center justify-center rounded-full',
                                        own
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground',
                                    )}
                                >
                                    <Icon className="size-3.5" />
                                </span>
                                <div
                                    className={cn(
                                        'rounded-2xl px-3.5 py-2.5 text-sm',
                                        own
                                            ? 'rounded-tr-sm bg-primary text-primary-foreground'
                                            : 'rounded-tl-sm bg-muted',
                                    )}
                                >
                                    <p className="leading-relaxed whitespace-pre-wrap">
                                        {msg.message}
                                    </p>
                                    <p
                                        className={cn(
                                            'mt-1 text-[11px]',
                                            own
                                                ? 'text-primary-foreground/70'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {author.label} ·{' '}
                                        {new Date(
                                            msg.created_at,
                                        ).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}

                {isWaitingForAI && (
                    <div className="flex items-center gap-2 self-start rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        AI sedang menyiapkan pertanyaan…
                    </div>
                )}
            </div>

            <div className="border-t p-3">
                {!stt.isSupported && (
                    <p className="mb-2 text-xs text-muted-foreground">
                        Browser ini tidak mendukung deteksi suara. Gunakan
                        Chrome atau Edge, atau ketik secara manual.
                    </p>
                )}
                <textarea
                    value={
                        draft + (interim ? (draft ? ' ' : '') + interim : '')
                    }
                    onChange={(e) => onDraftChange(e.target.value)}
                    rows={3}
                    placeholder="Bicara di mikrofon, ucapanmu akan muncul di sini…"
                    className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                {!isApplicant && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        Ucapan interviewer disimpan di transkrip, tidak dikirim
                        ke AI.
                    </p>
                )}
                <div className="mt-2 flex items-center justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClear}
                        disabled={!hasText}
                    >
                        <Trash2 />
                        Hapus
                    </Button>
                    <Button
                        size="sm"
                        onClick={onSend}
                        disabled={isProcessingAI || !hasText}
                    >
                        {isProcessingAI ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <Send />
                        )}
                        {isApplicant ? 'Kirim ke AI' : 'Simpan ke transkrip'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
