import { useCallback, useEffect, useRef, useState } from 'react';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'uploading';

interface UseMeetingRecorderOptions {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    localVideoRef?: React.RefObject<HTMLVideoElement | null>;
    remoteVideoRef?: React.RefObject<HTMLVideoElement | null>;
    roomCode?: string;
    autoDownload?: boolean;
    onRecordingComplete?: (videoBlob: Blob, durationSeconds: number, audioBlob: Blob | null) => Promise<void> | void;
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 150);
}

export function useMeetingRecorder({
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    roomCode,
    autoDownload = true,
    onRecordingComplete,
}: UseMeetingRecorderOptions) {
    const [status, setStatus] = useState<RecordingStatus>('idle');
    const [duration, setDuration] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [aiAudioBlob, setAiAudioBlob] = useState<Blob | null>(null);

    // Phase 19: Dual recorder instances and chunks
    const videoRecorderRef = useRef<MediaRecorder | null>(null);
    const audioRecorderRef = useRef<MediaRecorder | null>(null);
    const videoChunksRef = useRef<Blob[]>([]);
    const audioChunksRef = useRef<Blob[]>([]);

    const timerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const canvasStreamRef = useRef<MediaStream | null>(null);

    // Format duration to mm:ss
    const formattedDuration = formatSeconds(duration);

    // Cleanup all media resources
    const cleanupResources = useCallback(() => {
        if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (canvasStreamRef.current) {
            canvasStreamRef.current.getTracks().forEach((track) => track.stop());
            canvasStreamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
    }, []);

    // Create mixed audio stream from interviewer and applicant
    const createMixedAudioStream = useCallback((): { audioContext: AudioContext; mixedStream: MediaStream } => {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const audioDestination = audioCtx.createMediaStreamDestination();

        // Connect local audio
        if (localStream && localStream.getAudioTracks().length > 0) {
            try {
                const localSource = audioCtx.createMediaStreamSource(localStream);
                localSource.connect(audioDestination);
            } catch (err) {
                console.warn('Could not connect local audio to recorder:', err);
            }
        }

        // Connect remote audio
        if (remoteStream && remoteStream.getAudioTracks().length > 0) {
            try {
                const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
                remoteSource.connect(audioDestination);
            } catch (err) {
                console.warn('Could not connect remote audio to recorder:', err);
            }
        }

        return { audioContext: audioCtx, mixedStream: audioDestination.stream };
    }, [localStream, remoteStream]);

    // Create 1280x720 canvas stream
    const createCanvasStream = useCallback((): MediaStream => {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        const drawFrame = () => {
            if (!ctx) return;

            // Background
            ctx.fillStyle = '#0f172a'; // slate-900
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const hasRemote = Boolean(remoteStream && remoteVideoRef?.current && remoteStream.getVideoTracks().length > 0);
            const hasLocal = Boolean(localStream && localVideoRef?.current && localStream.getVideoTracks().length > 0);

            if (hasLocal && hasRemote) {
                // Side-by-side 2-tile layout
                const tileWidth = 620;
                const tileHeight = 465;
                const y = (canvas.height - tileHeight) / 2;

                // Left tile: Interviewer
                if (localVideoRef?.current) {
                    ctx.drawImage(localVideoRef.current, 20, y, tileWidth, tileHeight);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    ctx.fillRect(30, y + tileHeight - 40, 110, 30);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '14px sans-serif';
                    ctx.fillText('Interviewer', 40, y + tileHeight - 20);
                }

                // Right tile: Applicant
                if (remoteVideoRef?.current) {
                    ctx.drawImage(remoteVideoRef.current, 640, y, tileWidth, tileHeight);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    ctx.fillRect(650, y + tileHeight - 40, 100, 30);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '14px sans-serif';
                    ctx.fillText('Applicant', 660, y + tileHeight - 20);
                }
            } else if (hasRemote && remoteVideoRef?.current) {
                ctx.drawImage(remoteVideoRef.current, 0, 0, canvas.width, canvas.height);
            } else if (hasLocal && localVideoRef?.current) {
                ctx.drawImage(localVideoRef.current, 0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = '#94a3b8';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Waiting for video feeds...', canvas.width / 2, canvas.height / 2);
            }

            // Watermark / Brand Header
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(0, 0, canvas.width, 40);
            ctx.fillStyle = '#e2e8f0';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('AI Interview Session Recording', 20, 26);

            animationFrameRef.current = requestAnimationFrame(drawFrame);
        };

        drawFrame();

        const canvasStream = canvas.captureStream(24); // 24 FPS
        canvasStreamRef.current = canvasStream;
        return canvasStream;
    }, [localStream, remoteStream, localVideoRef, remoteVideoRef]);

    const getVideoMimeType = (): string => {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm',
            'video/mp4',
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return '';
    };

    const getAudioMimeType = (): string => {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return '';
    };

    // Start recording both video and audio streams simultaneously (Phase 19)
    const startRecording = useCallback(() => {
        try {
            setError(null);
            setAiAudioBlob(null);
            videoChunksRef.current = [];
            audioChunksRef.current = [];

            // 1. Setup mixed audio from both interviewer and applicant
            const { mixedStream } = createMixedAudioStream();

            // 2. Setup video stream (composite canvas + mixed audio for video archive)
            const canvasStream = createCanvasStream();
            const archiveVideoStream = new MediaStream();
            canvasStream.getVideoTracks().forEach((track) => archiveVideoStream.addTrack(track));
            mixedStream.getAudioTracks().forEach((track) => archiveVideoStream.addTrack(track));

            // 3. Setup separate audio stream for AI input
            const aiAudioStream = new MediaStream();
            mixedStream.getAudioTracks().forEach((track) => aiAudioStream.addTrack(track));

            const videoMime = getVideoMimeType();
            const audioMime = getAudioMimeType();

            // Video Recorder (Stream 1: Video Archive)
            const videoOptions: MediaRecorderOptions = {
                videoBitsPerSecond: 750000,
                audioBitsPerSecond: 64000,
            };
            if (videoMime) videoOptions.mimeType = videoMime;
            const videoRecorder = new MediaRecorder(archiveVideoStream, videoOptions);
            videoRecorderRef.current = videoRecorder;

            videoRecorder.ondataavailable = (event: BlobEvent) => {
                if (event.data && event.data.size > 0) {
                    videoChunksRef.current.push(event.data);
                }
            };

            // Audio Recorder (Stream 2: AI Input)
            const audioOptions: MediaRecorderOptions = {
                audioBitsPerSecond: 64000,
            };
            if (audioMime) audioOptions.mimeType = audioMime;
            const audioRecorder = new MediaRecorder(aiAudioStream, audioOptions);
            audioRecorderRef.current = audioRecorder;

            audioRecorder.ondataavailable = (event: BlobEvent) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            // Shared completion handler when both recorders stop
            let videoBlobResult: Blob | null = null;
            let audioBlobResult: Blob | null = null;

            const finalizeRecording = async () => {
                if (!videoBlobResult || !audioBlobResult) return;

                const recordedSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
                cleanupResources();

                // Guard against instant click (< 1KB)
                if (videoBlobResult.size < 1024) {
                    setStatus('idle');
                    setError('Durasi rekaman terlalu singkat.');
                    return;
                }

                // Phase 20: Store audio blob in state for AI processing
                setAiAudioBlob(audioBlobResult);

                // Phase 19: Auto download both files if enabled
                const fileId = roomCode || Date.now().toString();
                if (autoDownload) {
                    downloadBlob(videoBlobResult, `interview-video-${fileId}.webm`);
                    downloadBlob(audioBlobResult, `interview-audio-${fileId}.webm`);
                }

                setStatus('stopped');

                // Trigger server upload / custom callback
                if (onRecordingComplete) {
                    setStatus('uploading');
                    try {
                        await onRecordingComplete(videoBlobResult, recordedSeconds, audioBlobResult);
                    } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : 'Upload failed';
                        setError(message);
                    } finally {
                        setStatus('idle');
                    }
                }
            };

            videoRecorder.onstop = () => {
                const mime = videoRecorder.mimeType || 'video/webm';
                videoBlobResult = new Blob(videoChunksRef.current, { type: mime });
                finalizeRecording();
            };

            audioRecorder.onstop = () => {
                const mime = audioRecorder.mimeType || 'audio/webm';
                audioBlobResult = new Blob(audioChunksRef.current, { type: mime });
                finalizeRecording();
            };

            // Start both recorders in 1-second chunks
            videoRecorder.start(1000);
            audioRecorder.start(1000);

            startTimeRef.current = Date.now();
            setStatus('recording');
            setDuration(0);

            timerRef.current = window.setInterval(() => {
                setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
        } catch (err: unknown) {
            console.error('Failed to start recording:', err);
            const message = err instanceof Error ? err.message : 'Failed to start recording';
            setError(message);
            cleanupResources();
            setStatus('idle');
        }
    }, [createMixedAudioStream, createCanvasStream, cleanupResources, autoDownload, roomCode, onRecordingComplete]);

    // Pause recording
    const pauseRecording = useCallback(() => {
        if (videoRecorderRef.current && videoRecorderRef.current.state === 'recording') {
            videoRecorderRef.current.pause();
        }
        if (audioRecorderRef.current && audioRecorderRef.current.state === 'recording') {
            audioRecorderRef.current.pause();
        }
        if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setStatus('paused');
    }, []);

    // Resume recording
    const resumeRecording = useCallback(() => {
        if (videoRecorderRef.current && videoRecorderRef.current.state === 'paused') {
            videoRecorderRef.current.resume();
        }
        if (audioRecorderRef.current && audioRecorderRef.current.state === 'paused') {
            audioRecorderRef.current.resume();
        }
        setStatus('recording');
        const pauseOffset = Date.now() - duration * 1000;
        startTimeRef.current = pauseOffset;
        timerRef.current = window.setInterval(() => {
            setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
    }, [duration]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
            videoRecorderRef.current.stop();
        }
        if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
            audioRecorderRef.current.stop();
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
                videoRecorderRef.current.stop();
            }
            if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
                audioRecorderRef.current.stop();
            }
            cleanupResources();
        };
    }, [cleanupResources]);

    return {
        status,
        duration,
        formattedDuration,
        error,
        aiAudioBlob,
        isRecording: status === 'recording',
        isPaused: status === 'paused',
        isUploading: status === 'uploading',
        startRecording,
        pauseRecording,
        resumeRecording,
        stopRecording,
    };
}

function formatSeconds(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(mins)}:${pad(secs)}`;
}
