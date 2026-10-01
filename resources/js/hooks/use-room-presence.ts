import { useCallback, useEffect, useState } from 'react';

type RoomPresenceProps = {
    roomCode: string;
    participantToken: string;
};

type PresenceResult = {
    allowed: boolean;
    count: number;
};

export function useRoomPresence({
    roomCode,
    participantToken,
}: RoomPresenceProps) {
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
                    body: JSON.stringify({
                        participant_token: participantToken,
                    }),
                },
            );
            const result = (await response.json()) as PresenceResult;

            if (!response.ok && endpoint === 'heartbeat') {
                setIsAllowed(false);
                setError(
                    'This room is full. Only two participants are allowed.',
                );
            }

            if (typeof result.count === 'number') {
                setParticipantCount(result.count);
            }

            return result;
        },
        [participantToken, roomCode],
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
