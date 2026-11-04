import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeJakselSpeech } from '@/lib/jaksel-normalizer';

// Extend window interface for browser Speech Recognition API
declare global {
    interface Window {
        SpeechRecognition?: any;
        webkitSpeechRecognition?: any;
    }
}

export type STTLanguageMode = 'mixed' | 'id-ID' | 'en-US';

export interface UseSpeechRecognitionOptions {
    lang?: STTLanguageMode;
    continuous?: boolean;
    interimResults?: boolean;
    onTranscript?: (transcript: string, isFinal: boolean) => void;
}

export interface UseSpeechRecognitionReturn {
    /** True whenever the user or system has enabled STT. Stable and does not flicker. */
    isActive: boolean;
    /** True while the browser's speech recognition engine is actively listening. */
    isListening: boolean;
    /** True if the browser supports SpeechRecognition or webkitSpeechRecognition. */
    isSupported: boolean;
    /** Current language mode: 'mixed' (Jaksel / ID-EN), 'id-ID', or 'en-US'. */
    currentLang: STTLanguageMode;
    /** Switch language mode on the fly. */
    setLang: (lang: STTLanguageMode) => void;
    /** Accumulated final transcript string. */
    liveTranscript: string;
    /** Current in-flight interim transcript string. */
    interimTranscript: string;
    /** Start or resume speech recognition. */
    startListening: (overrideLang?: STTLanguageMode) => void;
    /** Stop speech recognition. */
    stopListening: () => void;
    /** Clear both live and interim transcripts. */
    clearTranscript: () => void;
    /** Manual setter for live transcript. */
    setLiveTranscript: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * useSpeechRecognition
 *
 * Utilizes the Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * to transcribe speech in real-time on the client side without external API keys.
 * Supports auto-restart on silence, language switching ('mixed' | 'id-ID' | 'en-US'),
 * and automatic Jaksel / bilingual code-switching phonetic normalization.
 */
export function useSpeechRecognition(
    options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
    const {
        lang: initialLang = 'mixed',
        continuous = true,
        interimResults = true,
        onTranscript,
    } = options;

    const [currentLang, setCurrentLang] = useState<STTLanguageMode>(initialLang);
    const [isActive, setIsActive] = useState<boolean>(false);
    const [isListening, setIsListening] = useState<boolean>(false);
    const [liveTranscript, setLiveTranscript] = useState<string>('');
    const [interimTranscript, setInterimTranscript] = useState<string>('');

    const isSupported =
        typeof window !== 'undefined' &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition);

    // Refs to hold state without causing unnecessary effect/callback re-creations
    const recognitionRef = useRef<any>(null);
    const isActiveRef = useRef<boolean>(false);
    const currentLangRef = useRef<STTLanguageMode>(initialLang);
    const restartTimerRef = useRef<any>(null);
    const sessionCountRef = useRef<number>(0);
    const onTranscriptRef = useRef(onTranscript);

    // Keep onTranscript callback fresh
    useEffect(() => {
        onTranscriptRef.current = onTranscript;
    }, [onTranscript]);

    useEffect(() => {
        currentLangRef.current = currentLang;
    }, [currentLang]);

    // Cleanup helper to abort current browser recognition instance
    const cleanupCurrentSession = useCallback(() => {
        if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
            restartTimerRef.current = null;
        }

        if (recognitionRef.current) {
            try {
                // Clear handlers first to avoid firing onend during explicit abort
                recognitionRef.current.onstart = null;
                recognitionRef.current.onresult = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.onend = null;
                recognitionRef.current.abort();
            } catch {
                // Ignore abort errors
            }
            recognitionRef.current = null;
        }
    }, []);

    // Helper to format/normalize transcript according to current mode
    const formatTranscriptText = useCallback((text: string, mode: STTLanguageMode) => {
        if (!text) return '';
        if (mode === 'mixed') {
            return normalizeJakselSpeech(text);
        }
        return text;
    }, []);

    // Create and start a brand-new SpeechRecognition instance
    const createAndStartInstance = useCallback(
        (targetLang?: STTLanguageMode) => {
            if (!isSupported) {
                console.warn('[useSpeechRecognition] Web Speech API is not supported in this browser.');
                return;
            }

            cleanupCurrentSession();

            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRec();
            const sessionNum = ++sessionCountRef.current;

            const modeToUse = targetLang || currentLangRef.current || 'mixed';
            
            // For 'mixed' (Jaksel), we base on 'id-ID' as grammar anchor, supplemented with normalizer
            const bcpLang = modeToUse === 'en-US' ? 'en-US' : 'id-ID';
            recognition.lang = bcpLang;
            recognition.continuous = continuous;
            recognition.interimResults = interimResults;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                if (sessionCountRef.current === sessionNum) {
                    setIsListening(true);
                }
            };

            recognition.onresult = (event: any) => {
                if (sessionCountRef.current !== sessionNum) return;

                let rawInterim = '';
                let rawFinal = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const item = event.results[i];
                    const transcript = item[0]?.transcript || '';
                    if (item.isFinal) {
                        rawFinal += (rawFinal ? ' ' : '') + transcript;
                    } else {
                        rawInterim += (rawInterim ? ' ' : '') + transcript;
                    }
                }

                const currentMode = currentLangRef.current;
                const newFinal = formatTranscriptText(rawFinal, currentMode);
                const processedInterim = formatTranscriptText(rawInterim, currentMode);

                if (newFinal) {
                    setLiveTranscript((prev) => {
                        const updated = prev ? `${prev} ${newFinal}`.trim() : newFinal.trim();
                        onTranscriptRef.current?.(updated, true);
                        return updated;
                    });
                }

                setInterimTranscript(processedInterim);
                if (processedInterim) {
                    onTranscriptRef.current?.(processedInterim, false);
                }
            };

            recognition.onerror = (event: any) => {
                if (sessionCountRef.current !== sessionNum) return;

                // 'no-speech' and 'aborted' are normal lifecycle events; ignore
                if (event.error === 'no-speech' || event.error === 'aborted') {
                    return;
                }

                console.warn('[useSpeechRecognition] warning/error:', event.error);

                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    isActiveRef.current = false;
                    setIsActive(false);
                    setIsListening(false);
                }
            };

            recognition.onend = () => {
                if (sessionCountRef.current !== sessionNum) return;

                setIsListening(false);

                // Auto-restart if user still wants STT to be active (and continuous is requested)
                if (isActiveRef.current && continuous) {
                    // Slight debounce to allow browser audio resources to cycle cleanly
                    restartTimerRef.current = setTimeout(() => {
                        if (isActiveRef.current) {
                            createAndStartInstance();
                        }
                    }, 200);
                }
            };

            recognitionRef.current = recognition;

            try {
                recognition.start();
            } catch (err: any) {
                // If it fails with an invalid state, schedule a quick retry if still active
                console.warn('[useSpeechRecognition] Start caught error:', err?.message || err);
                setIsListening(false);
                if (isActiveRef.current) {
                    restartTimerRef.current = setTimeout(() => {
                        if (isActiveRef.current) {
                            createAndStartInstance();
                        }
                    }, 300);
                }
            }
        },
        [cleanupCurrentSession, continuous, formatTranscriptText, interimResults, isSupported],
    );

    const startListening = useCallback(
        (overrideLang?: STTLanguageMode) => {
            if (!isSupported) return;

            if (overrideLang && overrideLang !== currentLangRef.current) {
                currentLangRef.current = overrideLang;
                setCurrentLang(overrideLang);
            }

            isActiveRef.current = true;
            setIsActive(true);
            createAndStartInstance(overrideLang);
        },
        [createAndStartInstance, isSupported],
    );

    const stopListening = useCallback(() => {
        isActiveRef.current = false;
        setIsActive(false);
        setIsListening(false);
        setInterimTranscript('');
        cleanupCurrentSession();
    }, [cleanupCurrentSession]);

    const setLang = useCallback(
        (newLang: STTLanguageMode) => {
            currentLangRef.current = newLang;
            setCurrentLang(newLang);
            if (isActiveRef.current) {
                // Restart with new language mode
                createAndStartInstance(newLang);
            }
        },
        [createAndStartInstance],
    );

    const clearTranscript = useCallback(() => {
        setLiveTranscript('');
        setInterimTranscript('');
    }, []);

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            isActiveRef.current = false;
            cleanupCurrentSession();
        };
    }, [cleanupCurrentSession]);

    return {
        isActive,
        isListening,
        isSupported,
        currentLang,
        setLang,
        liveTranscript,
        interimTranscript,
        startListening,
        stopListening,
        clearTranscript,
        setLiveTranscript,
    };
}
