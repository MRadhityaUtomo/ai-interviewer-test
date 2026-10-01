import { Head, router } from '@inertiajs/react';
import {
    Camera,
    CameraOff,
    Copy,
    Mic,
    MicOff,
    PhoneCall,
    PhoneOff,
    Video,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocalMedia } from '@/hooks/use-local-media';
import { useRoomPresence } from '@/hooks/use-room-presence';
import { useWebRTC } from '@/hooks/use-webrtc';

type Room = {
    code: string;
    status: string;
};

type RoomProps = {
    room: Room;
    participantRole: string;
    participantToken: string;
    participantCount: number;
};

export default function RoomShow({
    room,
    participantRole,
    participantToken,
    participantCount: initialParticipantCount,
}: RoomProps) {
    const [copied, setCopied] = useState(false);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const {
        stream,
        status: mediaStatus,
        error: mediaError,
        isMuted,
        cameraEnabled,
        toggleMute,
        toggleCamera,
    } = useLocalMedia();
    const {
        participantCount,
        error: presenceError,
        leave,
    } = useRoomPresence({
        roomCode: room.code,
        participantToken,
    });
    const isCaller = participantRole === 'interviewer';
    const {
        remoteStream,
        connectionState,
        error: webrtcError,
        participantLeft,
        startCall,
        hangUp,
    } = useWebRTC({
        roomCode: room.code,
        localStream: stream,
        isCaller,
    });

    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }
    }, [stream]);

    useEffect(() => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    async function copyRoomCode() {
        await navigator.clipboard.writeText(room.code);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    }

    async function endCall() {
        await leave();
        await hangUp();
        router.visit('/');
    }

    async function leaveRoom() {
        await leave();
        router.visit('/rooms');
    }

    return (
        <>
            <Head title={`Room ${room.code}`} />
            <div className="min-h-full flex-1 bg-[#101214] p-4 text-white md:p-8">
                <div className="mx-auto flex max-w-6xl flex-col gap-6">
                    <header className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-sm text-white/60">
                                Interview room
                            </p>
                            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                                Waiting room
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm">
                            <span className="text-white/60">Code</span>
                            <strong className="tracking-[0.2em]">
                                {room.code}
                            </strong>
                            <button
                                type="button"
                                onClick={copyRoomCode}
                                className="ml-1 text-white/70 hover:text-white"
                                title="Copy room code"
                            >
                                <Copy className="size-4" />
                            </button>
                            {copied && (
                                <span className="text-xs text-emerald-300">
                                    Copied
                                </span>
                            )}
                        </div>
                    </header>

                    <section className="grid gap-4 md:grid-cols-2">
                        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className={`size-full object-cover ${cameraEnabled ? '' : 'opacity-0'}`}
                            />
                            {!cameraEnabled && (
                                <div className="absolute inset-0 flex items-center justify-center text-white/60">
                                    <CameraOff className="size-8" />
                                </div>
                            )}
                            <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs">
                                You
                            </span>
                        </div>
                        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.03]">
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className={`size-full object-cover ${remoteStream ? '' : 'hidden'}`}
                            />
                            {!remoteStream && (
                                <p className="text-sm text-white/50">
                                    {participantLeft
                                        ? 'The other participant has left the room'
                                        : 'Waiting for the second participant'}
                                </p>
                            )}
                            {remoteStream && (
                                <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs">
                                    Other participant
                                </span>
                            )}
                        </div>
                    </section>

                    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
                        <div className="flex items-center gap-3 text-sm text-white/70">
                            {mediaStatus === 'ready' ? (
                                <Video className="size-4 text-emerald-300" />
                            ) : (
                                <Video className="size-4 text-amber-300" />
                            )}
                            <span>
                                {mediaStatus === 'ready'
                                    ? 'Camera and microphone ready'
                                    : mediaStatus === 'requesting'
                                      ? 'Requesting camera and microphone access...'
                                      : 'Camera and microphone unavailable'}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-md border border-white/15 px-3 py-2 text-sm text-white/70">
                                WebRTC: {connectionState}
                            </span>
                            {isCaller && (
                                <button
                                    type="button"
                                    onClick={() => void startCall()}
                                    disabled={mediaStatus !== 'ready'}
                                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <PhoneCall className="size-4" />
                                    Start call
                                </button>
                            )}
                            {!isCaller && connectionState === 'idle' && (
                                <span className="rounded-md border border-white/15 px-3 py-2 text-sm text-white/70">
                                    Waiting for interviewer to start
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => void endCall()}
                                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
                            >
                                <PhoneOff className="size-4" />
                                End call
                            </button>
                            <button
                                type="button"
                                onClick={toggleMute}
                                disabled={mediaStatus !== 'ready'}
                                className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {isMuted ? (
                                    <MicOff className="size-4" />
                                ) : (
                                    <Mic className="size-4" />
                                )}
                                {isMuted ? 'Unmute' : 'Mute'}
                            </button>
                            <button
                                type="button"
                                onClick={toggleCamera}
                                disabled={mediaStatus !== 'ready'}
                                className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {cameraEnabled ? (
                                    <Camera className="size-4" />
                                ) : (
                                    <CameraOff className="size-4" />
                                )}
                                {cameraEnabled ? 'Camera off' : 'Camera on'}
                            </button>
                        </div>
                    </section>

                    {mediaError && (
                        <p className="rounded-md border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100">
                            {mediaError} Check the browser permission and reload
                            the room.
                        </p>
                    )}

                    {webrtcError && (
                        <p className="rounded-md border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100">
                            {webrtcError}
                        </p>
                    )}

                    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
                        <div>
                            <p className="text-sm font-medium">Room active</p>
                            <p className="mt-1 text-sm text-white/60">
                                You joined as {participantRole}. Participants:{' '}
                                {participantCount || initialParticipantCount}/2
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => void leaveRoom()}
                                className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10"
                            >
                                Leave room
                            </button>
                        </div>
                    </section>

                    {presenceError && (
                        <p className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                            {presenceError}
                        </p>
                    )}

                </div>
            </div>
        </>
    );
}
