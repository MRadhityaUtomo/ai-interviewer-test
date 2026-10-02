import { useEffect, useRef } from 'react';

type ProctoringEvent = 'tab_hidden' | 'window_blurred';

type ProctoringOptions = {
    enabled: boolean;
    roomCode: string;
};

export function useProctoringEvents({
    enabled,
    roomCode,
}: ProctoringOptions) {
    const lastReportedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        async function report(eventType: ProctoringEvent) {
            const now = Date.now();
            const reportKey = `${eventType}:${Math.floor(now / 2000)}`;

            if (lastReportedRef.current === reportKey) {
                return;
            }

            lastReportedRef.current = reportKey;
            const token = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content');

            await fetch(`/rooms/${roomCode}/violations`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({ event_type: eventType }),
            });
        }

        function handleVisibilityChange() {
            if (document.hidden) {
                void report('tab_hidden');
            }
        }

        function handleBlur() {
            void report('window_blurred');
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            window.removeEventListener('blur', handleBlur);
        };
    }, [enabled, roomCode]);
}