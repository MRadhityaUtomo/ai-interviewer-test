// The camera / microphone picked in the lobby, reused when the room asks for media.

const STORAGE_KEY = 'media-devices';

export type MediaPreferences = {
    cameraId?: string;
    microphoneId?: string;
};

export function loadMediaPreferences(): MediaPreferences {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        return raw ? (JSON.parse(raw) as MediaPreferences) : {};
    } catch {
        return {};
    }
}

export function saveMediaPreferences(preferences: MediaPreferences): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
        // Storage can be unavailable (private mode, blocked site data); defaults still work
    }
}

/**
 * getUserMedia constraints for the saved devices. `ideal` (not `exact`) so a
 * device that was unplugged since falls back to the default instead of failing.
 */
export function preferredMediaConstraints(
    preferences: MediaPreferences = loadMediaPreferences(),
): MediaStreamConstraints {
    return {
        video: preferences.cameraId
            ? { deviceId: { ideal: preferences.cameraId } }
            : true,
        audio: preferences.microphoneId
            ? { deviceId: { ideal: preferences.microphoneId } }
            : true,
    };
}
