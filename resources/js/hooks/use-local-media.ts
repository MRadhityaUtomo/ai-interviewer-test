import { useCallback, useEffect, useRef, useState } from 'react';

type MediaStatus = 'requesting' | 'ready' | 'denied' | 'unsupported';

export function useLocalMedia() {
    const streamRef = useRef<MediaStream | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [status, setStatus] = useState<MediaStatus>('requesting');
    const [error, setError] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [cameraEnabled, setCameraEnabled] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function startMedia() {
            if (!navigator.mediaDevices?.getUserMedia) {
                setStatus('unsupported');
                setError(
                    'This browser does not support camera and microphone access.',
                );
                return;
            }

            try {
                const localStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true,
                });

                if (!mounted) {
                    localStream.getTracks().forEach((track) => track.stop());
                    return;
                }

                streamRef.current = localStream;
                setStream(localStream);
                setStatus('ready');
            } catch (mediaError) {
                if (!mounted) {
                    return;
                }

                setStatus('denied');
                setError(
                    mediaError instanceof DOMException &&
                        mediaError.name === 'NotAllowedError'
                        ? 'Camera or microphone permission was denied.'
                        : 'Unable to access the camera or microphone.',
                );
            }
        }

        void startMedia();

        return () => {
            mounted = false;
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        };
    }, []);

    const toggleMute = useCallback(() => {
        const nextMuted = !isMuted;
        streamRef.current?.getAudioTracks().forEach((track) => {
            track.enabled = !nextMuted;
        });
        setIsMuted(nextMuted);
    }, [isMuted]);

    const toggleCamera = useCallback(() => {
        const nextEnabled = !cameraEnabled;
        streamRef.current?.getVideoTracks().forEach((track) => {
            track.enabled = nextEnabled;
        });
        setCameraEnabled(nextEnabled);
    }, [cameraEnabled]);

    const pauseCamera = useCallback(() => {
        streamRef.current?.getVideoTracks().forEach((track) => {
            track.enabled = false;
        });
        setCameraEnabled(false);
    }, []);

    return {
        stream,
        status,
        error,
        isMuted,
        cameraEnabled,
        pauseCamera,
        toggleMute,
        toggleCamera,
    };
}
