import { useCallback, useEffect, useRef, useState } from 'react';
import { echo } from '@laravel/echo-react';
import {
    type SignalingPayload,
    type SignalingType,
    useRoomSignaling,
} from '@/hooks/use-room-signaling';

type WebRTCConnectionState = RTCPeerConnectionState | 'idle';

type UseWebRTCOptions = {
    roomCode: string;
    localStream: MediaStream | null;
    isCaller: boolean;
};

function serializeDescription(
    description: RTCSessionDescriptionInit,
): Record<string, unknown> {
    return {
        type: description.type,
        sdp: description.sdp ?? null,
    };
}

function serializeCandidate(
    candidate: RTCIceCandidate,
): Record<string, unknown> {
    return {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        usernameFragment: candidate.usernameFragment,
    };
}

function deserializeDescription(
    data: Record<string, unknown>,
): RTCSessionDescriptionInit {
    if (typeof data.type !== 'string' || typeof data.sdp !== 'string') {
        throw new Error('The received SDP payload is invalid.');
    }

    const sdp = data.sdp
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\r\n|\r|\n/g, '\n')
        .split('\n')
        .join('\r\n');

    return {
        type: data.type as RTCSdpType,
        sdp: sdp.endsWith('\r\n') ? sdp : `${sdp}\r\n`,
    };
}

export function useWebRTC({
    roomCode,
    localStream,
    isCaller,
}: UseWebRTCOptions) {
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [connectionState, setConnectionState] =
        useState<WebRTCConnectionState>('idle');
    const [error, setError] = useState<string | null>(null);
    const [participantLeft, setParticipantLeft] = useState(false);

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

    const flushCandidates = useCallback(async (peer: RTCPeerConnection) => {
        const candidates = pendingCandidatesRef.current;
        pendingCandidatesRef.current = [];

        for (const candidate of candidates) {
            await peer.addIceCandidate(candidate);
        }
    }, []);

    const closePeer = useCallback(() => {
        peerRef.current?.close();
        peerRef.current = null;
        pendingCandidatesRef.current = [];
        setRemoteStream(null);
        setConnectionState('closed');
    }, []);

    const createPeer = useCallback(() => {
        if (peerRef.current) {
            return peerRef.current;
        }

        const peer = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        localStream?.getTracks().forEach((track) => {
            peer.addTrack(track, localStream);
        });

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                void sendSignal(
                    'ice-candidate',
                    serializeCandidate(event.candidate),
                );
            }
        };

        peer.ontrack = (event) => {
            setRemoteStream((currentStream) => {
                if (currentStream) {
                    return currentStream;
                }

                return event.streams[0] ?? new MediaStream([event.track]);
            });
        };

        peer.onconnectionstatechange = () => {
            setConnectionState(peer.connectionState);
        };

        peerRef.current = peer;
        setConnectionState(peer.connectionState);

        return peer;
    }, [localStream, sendSignal]);

    const handleSignal = useCallback(
        async (payload: SignalingPayload) => {
            try {
                if (payload.type === 'left_room') {
                    closePeer();
                    setParticipantLeft(true);
                    return;
                }

                const peer = createPeer();

                if (payload.type === 'offer' && !isCaller) {
                    await peer.setRemoteDescription(
                        deserializeDescription(payload.data),
                    );
                    await flushCandidates(peer);

                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);
                    await sendSignal('answer', serializeDescription(answer));
                    return;
                }

                if (payload.type === 'answer' && isCaller) {
                    await peer.setRemoteDescription(
                        deserializeDescription(payload.data),
                    );
                    await flushCandidates(peer);
                    return;
                }

                if (payload.type === 'ice-candidate') {
                    const candidate = payload.data as RTCIceCandidateInit;

                    if (peer.remoteDescription) {
                        await peer.addIceCandidate(candidate);
                    } else {
                        pendingCandidatesRef.current.push(candidate);
                    }
                }
            } catch (webrtcError) {
                setError(
                    webrtcError instanceof Error
                        ? webrtcError.message
                        : 'WebRTC connection failed.',
                );
            }
        },
        [closePeer, createPeer, flushCandidates, isCaller, sendSignal],
    );

    const { sendSignal: sendRoomSignal } = useRoomSignaling(
        roomCode,
        (payload) => {
            void handleSignal(payload);
        },
    );

    const startCall = useCallback(async () => {
        if (!isCaller || !localStream) {
            return;
        }

        try {
            const peer = createPeer();
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            await sendRoomSignal('offer', serializeDescription(offer));
        } catch (webrtcError) {
            setError(
                webrtcError instanceof Error
                    ? webrtcError.message
                    : 'Unable to start the call.',
            );
        }
    }, [createPeer, isCaller, localStream, sendRoomSignal]);

    const hangUp = useCallback(async () => {
        try {
            await sendSignal('left_room', { reason: 'hang_up' });
        } catch (hangUpError) {
            setError(
                hangUpError instanceof Error
                    ? hangUpError.message
                    : 'Unable to notify the other participant.',
            );
        } finally {
            localStream?.getTracks().forEach((track) => track.stop());
            closePeer();
        }
    }, [closePeer, localStream, sendSignal]);

    useEffect(() => {
        return () => {
            closePeer();
        };
    }, [closePeer]);

    return {
        remoteStream,
        connectionState,
        error,
        participantLeft,
        startCall,
        hangUp,
    };
}
