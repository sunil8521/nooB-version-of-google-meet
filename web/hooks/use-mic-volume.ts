import { useEffect, useState } from "react";

export function useMicVolume(stream: MediaStream | null, enabled: boolean = true) {
    const [volume, setVolume] = useState(0);

    useEffect(() => {
        if (!stream || !enabled) {
            setVolume(0);
            return;
        }

        const audioContext = new window.AudioContext();
        let analyser: AnalyserNode | null = null;
        let microphone: MediaStreamAudioSourceNode | null = null;
        let animationFrameId: number;

        try {
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            
            // Note: MediaStreamAudioSourceNode sometimes throws if the stream doesn't have an audio track.
            // Ensure there is at least one audio track before creating the source.
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                setVolume(0);
                return;
            }

            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateVolume = () => {
                if (!analyser) return;
                analyser.getByteFrequencyData(dataArray);

                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                
                // Map the average (0-255) to a volume percentage (0-100)
                const percentage = Math.min(100, Math.max(0, (average / 255) * 100));
                
                // Add a small multiplier to make it more visually responsive to normal speech
                setVolume(Math.min(100, percentage * 2.5));

                animationFrameId = requestAnimationFrame(updateVolume);
            };

            updateVolume();

        } catch (e) {
            console.error("Error setting up audio visualizer:", e);
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (microphone) microphone.disconnect();
            if (analyser) analyser.disconnect();
            if (audioContext.state !== "closed") {
                audioContext.close();
            }
        };
    }, [stream, enabled]);

    return volume;
}
