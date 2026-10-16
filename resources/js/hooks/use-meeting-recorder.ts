import { useCallback, useEffect, useRef, useState } from 'react';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'uploading';

interface UseMeetingRecorderOptions {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    localVideoRef?: React.RefObject<HTMLVideoElement | null>;
    remoteVideoRef?: React.RefObject<HTMLVideoElement | null>;
    onRecordingComplete?: (blob: Blob, durationSeconds: number) => Promise<void> | void;
}

export function useMeetingRecorder({
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    onRecordingComplete,
}: UseMeetingRecorderOptions) {
    const [status, setStatus] = useState<RecordingStatus>('idle');
    const [duration, setDuration] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const canvasStreamRef = useRef<MediaStream | null>(null);

    // Format duration to mm:ss or hh:mm:ss
    const formattedDuration = formatSeconds(duration);

    // Cleanup recording resources
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

    // Create a composite media stream with canvas & mixed audio
    const createCompositeStream = useCallback((): MediaStream => {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const audioDestination = audioCtx.createMediaStreamDestination();

        // Mix local audio if available
        if (localStream && localStream.getAudioTracks().length > 0) {
            try {
                const localSource = audioCtx.createMediaStreamSource(localStream);
                localSource.connect(audioDestination);
            } catch (err) {
                console.warn('Could not connect local audio to recorder:', err);
            }
        }

        // Mix remote audio if available
        if (remoteStream && remoteStream.getAudioTracks().length > 0) {
            try {
                const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
                remoteSource.connect(audioDestination);
            } catch (err) {
                console.warn('Could not connect remote audio to recorder:', err);
            }
        }

        // Setup 1280x720 canvas for composite video
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
                // Side-by-side layout: 2 tiles
                const tileWidth = 620;
                const tileHeight = 465;
                const y = (canvas.height - tileHeight) / 2;

                // Left tile: Local / Interviewer
                if (localVideoRef?.current) {
                    ctx.drawImage(localVideoRef.current, 20, y, tileWidth, tileHeight);
                    // Label
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    ctx.fillRect(30, y + tileHeight - 40, 110, 30);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '14px sans-serif';
                    ctx.fillText('Interviewer', 40, y + tileHeight - 20);
                }

                // Right tile: Remote / Applicant
                if (remoteVideoRef?.current) {
                    ctx.drawImage(remoteVideoRef.current, 640, y, tileWidth, tileHeight);
                    // Label
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    ctx.fillRect(650, y + tileHeight - 40, 100, 30);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '14px sans-serif';
                    ctx.fillText('Applicant', 660, y + tileHeight - 20);
                }
            } else if (hasRemote && remoteVideoRef?.current) {
                // Remote full view
                ctx.drawImage(remoteVideoRef.current, 0, 0, canvas.width, canvas.height);
            } else if (hasLocal && localVideoRef?.current) {
                // Local full view
                ctx.drawImage(localVideoRef.current, 0, 0, canvas.width, canvas.height);
            } else {
                // Waiting screen
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

        const canvasStream = canvas.captureStream(24);
        canvasStreamRef.current = canvasStream;

        const combinedStream = new MediaStream();
        // Add video track
        canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));
        // Add mixed audio track
        audioDestination.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));

        return combinedStream;
    }, [localStream, remoteStream, localVideoRef, remoteVideoRef]);

    // Choose best supported MIME type
    const getMimeType = (): string => {
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

    // Start recording
    const startRecording = useCallback(() => {
        try {
            setError(null);
            recordedChunksRef.current = [];

            const streamToRecord = createCompositeStream();
            const mimeType = getMimeType();

            const options: MediaRecorderOptions = {
                videoBitsPerSecond: 750000, // 750 kbps: ~55% smaller file size with crisp 720p visual
                audioBitsPerSecond: 64000,  // 64 kbps: clear vocal audio compression
            };
            if (mimeType) {
                options.mimeType = mimeType;
            }

            const recorder = new MediaRecorder(streamToRecord, options);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event: BlobEvent) => {
                if (event.data && event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                const mime = recorder.mimeType || 'video/webm';
                const completeBlob = new Blob(recordedChunksRef.current, { type: mime });
                const recordedSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));

                cleanupResources();

                // Guard against accidental instant click (< 1KB)
                if (completeBlob.size < 1024) {
                    setStatus('idle');
                    setError('Durasi rekaman terlalu singkat.');
                    return;
                }

                setStatus('stopped');

                if (onRecordingComplete) {
                    setStatus('uploading');
                    try {
                        await onRecordingComplete(completeBlob, recordedSeconds);
                    } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : 'Upload failed';
                        setError(message);
                    } finally {
                        setStatus('idle');
                    }
                }
            };

            recorder.start(1000); // 1-second chunks
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
    }, [createCompositeStream, cleanupResources, onRecordingComplete]);

    // Pause recording
    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setStatus('paused');
        }
    }, []);

    // Resume recording
    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setStatus('recording');
            const pauseOffset = Date.now() - duration * 1000;
            startTimeRef.current = pauseOffset;
            timerRef.current = window.setInterval(() => {
                setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
        }
    }, [duration]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            cleanupResources();
        };
    }, [cleanupResources]);

    return {
        status,
        duration,
        formattedDuration,
        error,
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
