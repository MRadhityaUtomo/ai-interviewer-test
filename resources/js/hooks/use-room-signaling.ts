import { echo, useEchoPublic } from '@laravel/echo-react';
import { useCallback } from 'react';

export type SignalingType = 'offer' | 'answer' | 'ice-candidate' | 'left_room';

export type SignalingPayload = {
    room_code: string;
    type: SignalingType;
    data: Record<string, unknown>;
};

export function useRoomSignaling(
    roomCode: string,
    onSignal: (payload: SignalingPayload) => void,
) {
    const channel = `room.${roomCode}`;

    useEchoPublic<SignalingPayload>(channel, 'WebRTCSignal', onSignal, [
        roomCode,
        onSignal,
    ]);

    const sendSignal = useCallback(
        async (type: SignalingType, data: Record<string, unknown>) => {
            const token = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content');

            const response = await fetch(`/rooms/${roomCode}/signals`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    ...(echo().socketId()
                        ? { 'X-Socket-ID': echo().socketId() }
                        : {}),
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({ type, data }),
            });

            if (!response.ok) {
                throw new Error('Unable to send WebRTC signal.');
            }
        },
        [roomCode],
    );

    return { sendSignal };
}
