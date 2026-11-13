import { useCallback, useEffect, useState } from 'react';

type RoomPresenceProps = {
    roomCode: string;
};

type PresenceResult = {
    allowed: boolean;
    count: number;
};

/**
 * Heartbeats keep this participant listed in the room. The server knows who we
 * are from the per-room participant cookie, so nothing identifying is sent.
 */
export function useRoomPresence({ roomCode }: RoomPresenceProps) {
    const [participantCount, setParticipantCount] = useState(0);
    const [isAllowed, setIsAllowed] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const request = useCallback(
        async (endpoint: 'heartbeat' | 'leave'): Promise<PresenceResult> => {
            const token = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content');
            const response = await fetch(
                `/rooms/${roomCode}/presence/${endpoint}`,
                {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                    },
                },
            );
            const result = (await response
                .json()
                .catch(() => ({}))) as Partial<PresenceResult>;

            if (!response.ok && endpoint === 'heartbeat') {
                setIsAllowed(false);
                setError(
                    response.status === 403
                        ? 'Sesi room tidak lagi berlaku. Muat ulang halaman untuk masuk kembali.'
                        : 'Room penuh. Hanya dua peserta yang diizinkan.',
                );
            }

            if (typeof result.count === 'number') {
                setParticipantCount(result.count);
            }

            return {
                allowed: response.ok,
                count: result.count ?? 0,
            };
        },
        [roomCode],
    );

    useEffect(() => {
        void request('heartbeat');
        const interval = window.setInterval(() => {
            void request('heartbeat');
        }, 15000);

        return () => window.clearInterval(interval);
    }, [request]);

    const leave = useCallback(() => request('leave'), [request]);

    return { participantCount, isAllowed, error, leave };
}
