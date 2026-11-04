import { useEffect, useState } from 'react';

type UseVoiceActivityOptions = {
    /** RMS level (0..1) above which the stream counts as speaking. */
    threshold?: number;
    /** Keep "speaking" true this long after the level drops, to avoid flicker between words. */
    holdMs?: number;
};

const POLL_INTERVAL_MS = 100;

/**
 * Returns true while the given stream has audible audio. A muted track
 * (enabled = false) produces silence, so it naturally reports false.
 */
export function useVoiceActivity(
    stream: MediaStream | null,
    { threshold = 0.02, holdMs = 300 }: UseVoiceActivityOptions = {},
): boolean {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [hasAudio, setHasAudio] = useState(false);

    // A remote WebRTC stream can receive its audio track after the stream object is first exposed.
    useEffect(() => {
        if (!stream) {
            setHasAudio(false);
            return;
        }

        const update = () => setHasAudio(stream.getAudioTracks().length > 0);
        update();

        stream.addEventListener('addtrack', update);
        stream.addEventListener('removetrack', update);

        return () => {
            stream.removeEventListener('addtrack', update);
            stream.removeEventListener('removetrack', update);
        };
    }, [stream]);

    useEffect(() => {
        if (!stream || !hasAudio) {
            setIsSpeaking(false);
            return;
        }

        const AudioContextClass =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;

        if (!AudioContextClass) {
            return;
        }

        const context = new AudioContextClass();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const samples = new Float32Array(analyser.fftSize);
        let lastLoudAt = 0;
        let speaking = false;

        // The context may start suspended until a user gesture; joining the room usually counts.
        void context.resume().catch(() => undefined);

        // setInterval rather than requestAnimationFrame so detection keeps running in background tabs.
        const interval = window.setInterval(() => {
            analyser.getFloatTimeDomainData(samples);

            let sum = 0;
            for (const sample of samples) {
                sum += sample * sample;
            }
            const rms = Math.sqrt(sum / samples.length);

            const now = performance.now();
            if (rms > threshold) {
                lastLoudAt = now;
            }

            const next = now - lastLoudAt < holdMs;
            if (next !== speaking) {
                speaking = next;
                setIsSpeaking(next);
            }
        }, POLL_INTERVAL_MS);

        return () => {
            window.clearInterval(interval);
            source.disconnect();
            void context.close().catch(() => undefined);
            setIsSpeaking(false);
        };
    }, [stream, hasAudio, threshold, holdMs]);

    return isSpeaking;
}
