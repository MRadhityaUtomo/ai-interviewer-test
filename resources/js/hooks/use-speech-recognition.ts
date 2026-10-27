import { useCallback, useEffect, useRef, useState } from 'react';

// Extend window interface for browser Speech Recognition API
declare global {
    interface Window {
        SpeechRecognition?: any;
        webkitSpeechRecognition?: any;
    }
}

export interface UseSpeechRecognitionOptions {
    lang?: string;
    continuous?: boolean;
    interimResults?: boolean;
    onTranscript?: (transcript: string, isFinal: boolean) => void;
}

export interface UseSpeechRecognitionReturn {
    isListening: boolean;
    isSupported: boolean;
    liveTranscript: string;
    interimTranscript: string;
    startListening: () => void;
    stopListening: () => void;
    clearTranscript: () => void;
    setLiveTranscript: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * useSpeechRecognition
 *
 * Utilizes the Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * to transcribe speech in real-time on the client side without external API keys.
 */
export function useSpeechRecognition(
    options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
    const {
        lang = 'id-ID',
        continuous = true,
        interimResults = true,
        onTranscript,
    } = options;

    const recognitionRef = useRef<any>(null);
    const shouldListenRef = useRef<boolean>(false);

    const [isListening, setIsListening] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');

    const isSupported =
        typeof window !== 'undefined' &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition);

    const stopListening = useCallback(() => {
        shouldListenRef.current = false;
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch {
                // ignore
            }
            recognitionRef.current = null;
        }
        setIsListening(false);
        setInterimTranscript('');
    }, []);

    const startListening = useCallback(() => {
        if (!isSupported) {
            console.warn('[useSpeechRecognition] SpeechRecognition is not supported in this browser.');
            return;
        }

        stopListening();

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRec();

        recognition.lang = lang;
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            let interim = '';
            let finalPart = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalPart += (finalPart ? ' ' : '') + transcript;
                } else {
                    interim += (interim ? ' ' : '') + transcript;
                }
            }

            if (finalPart) {
                setLiveTranscript((prev) => {
                    const updated = prev ? `${prev} ${finalPart}`.trim() : finalPart.trim();
                    onTranscript?.(updated, true);
                    return updated;
                });
            }

            setInterimTranscript(interim);
            if (interim) {
                onTranscript?.(interim, false);
            }
        };

        recognition.onerror = (event: any) => {
            // Ignore normal non-fatal speech events
            if (event.error === 'no-speech') {
                return;
            }
            console.warn('[useSpeechRecognition] error:', event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                shouldListenRef.current = false;
                setIsListening(false);
            }
        };

        recognition.onend = () => {
            // Auto restart if continuous listening is requested and still intended
            if (shouldListenRef.current) {
                try {
                    recognition.start();
                } catch {
                    setIsListening(false);
                }
            } else {
                setIsListening(false);
            }
        };

        recognitionRef.current = recognition;
        shouldListenRef.current = true;

        try {
            recognition.start();
            setIsListening(true);
        } catch (err) {
            console.error('[useSpeechRecognition] start error:', err);
            setIsListening(false);
            shouldListenRef.current = false;
        }
    }, [continuous, interimResults, isSupported, lang, onTranscript, stopListening]);

    const clearTranscript = useCallback(() => {
        setLiveTranscript('');
        setInterimTranscript('');
    }, []);

    useEffect(() => {
        return () => {
            shouldListenRef.current = false;
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch {
                    // ignore
                }
            }
        };
    }, []);

    return {
        isListening,
        isSupported,
        liveTranscript,
        interimTranscript,
        startListening,
        stopListening,
        clearTranscript,
        setLiveTranscript,
    };
}
