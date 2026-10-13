import { useCallback, useEffect, useRef, useState } from 'react';

export type DeviceInfo = {
    deviceId: string;
    label: string;
};

export type DeviceSetupStatus =
    | 'requesting'
    | 'ready'
    | 'denied'
    | 'unsupported';

export type UseDeviceSetupReturn = {
    stream: MediaStream | null;
    status: DeviceSetupStatus;
    error: string | null;
    cameras: DeviceInfo[];
    microphones: DeviceInfo[];
    selectedCamera: string;
    selectedMicrophone: string;
    micVolume: number; // 0–100
    setSelectedCamera: (deviceId: string) => void;
    setSelectedMicrophone: (deviceId: string) => void;
    stopStream: () => void;
};

function mapDevices(devices: MediaDeviceInfo[], kind: MediaDeviceKind): DeviceInfo[] {
    return devices
        .filter((d) => d.kind === kind)
        .map((d, i) => ({
            deviceId: d.deviceId,
            label:
                d.label ||
                `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${i + 1}`,
        }));
}

export function useDeviceSetup(): UseDeviceSetupReturn {
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [status, setStatus] = useState<DeviceSetupStatus>('requesting');
    const [error, setError] = useState<string | null>(null);
    const [cameras, setCameras] = useState<DeviceInfo[]>([]);
    const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
    const [selectedCamera, setSelectedCameraState] = useState('');
    const [selectedMicrophone, setSelectedMicrophoneState] = useState('');
    const [micVolume, setMicVolume] = useState(0);

    // ─── Volume analysis loop ────────────────────────────────────────────────
    const startVolumeAnalysis = useCallback((mediaStream: MediaStream) => {
        if (animFrameRef.current !== null) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        audioCtxRef.current?.close().catch(() => undefined);

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(mediaStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        function tick() {
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(tick);
        }

        animFrameRef.current = requestAnimationFrame(tick);
    }, []);

    // ─── Stop everything ─────────────────────────────────────────────────────
    const stopStream = useCallback(() => {
        if (animFrameRef.current !== null) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        audioCtxRef.current?.close().catch(() => undefined);
        audioCtxRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStream(null);
        setMicVolume(0);
    }, []);

    // ─── Acquire stream with given device IDs ────────────────────────────────
    const acquireStream = useCallback(
        async (cameraId?: string, micId?: string) => {
            streamRef.current?.getTracks().forEach((t) => t.stop());

            const constraints: MediaStreamConstraints = {
                video: cameraId ? { deviceId: { exact: cameraId } } : true,
                audio: micId ? { deviceId: { exact: micId } } : true,
            };

            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = newStream;
            setStream(newStream);
            startVolumeAnalysis(newStream);
            return newStream;
        },
        [startVolumeAnalysis],
    );

    // ─── Initial permission + device enumeration ─────────────────────────────
    useEffect(() => {
        let mounted = true;

        async function init() {
            if (!navigator.mediaDevices?.getUserMedia) {
                setStatus('unsupported');
                setError('This browser does not support camera and microphone access.');
                return;
            }

            try {
                const initialStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });

                if (!mounted) {
                    initialStream.getTracks().forEach((t) => t.stop());
                    return;
                }

                streamRef.current = initialStream;
                setStream(initialStream);
                setStatus('ready');

                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const cams = mapDevices(allDevices, 'videoinput');
                const mics = mapDevices(allDevices, 'audioinput');

                if (mounted) {
                    setCameras(cams);
                    setMicrophones(mics);

                    const activeVideoId =
                        initialStream.getVideoTracks()[0]?.getSettings().deviceId ?? '';
                    const activeMicId =
                        initialStream.getAudioTracks()[0]?.getSettings().deviceId ?? '';

                    setSelectedCameraState(activeVideoId || cams[0]?.deviceId || '');
                    setSelectedMicrophoneState(activeMicId || mics[0]?.deviceId || '');

                    startVolumeAnalysis(initialStream);
                }
            } catch (err) {
                if (!mounted) return;
                setStatus('denied');
                setError(
                    err instanceof DOMException && err.name === 'NotAllowedError'
                        ? 'Camera or microphone permission was denied.'
                        : 'Unable to access the camera or microphone.',
                );
            }
        }

        void init();

        return () => {
            mounted = false;
        };
    }, [startVolumeAnalysis]);

    // ─── Cleanup on unmount ───────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (animFrameRef.current !== null) {
                cancelAnimationFrame(animFrameRef.current);
            }
            audioCtxRef.current?.close().catch(() => undefined);
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    // ─── Switch camera ────────────────────────────────────────────────────────
    const setSelectedCamera = useCallback(
        (deviceId: string) => {
            setSelectedCameraState(deviceId);
            void acquireStream(deviceId, selectedMicrophone);
        },
        [acquireStream, selectedMicrophone],
    );

    // ─── Switch microphone ────────────────────────────────────────────────────
    const setSelectedMicrophone = useCallback(
        (deviceId: string) => {
            setSelectedMicrophoneState(deviceId);
            void acquireStream(selectedCamera, deviceId);
        },
        [acquireStream, selectedCamera],
    );

    return {
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
    };
}
