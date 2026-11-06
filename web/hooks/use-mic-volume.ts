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

                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                
                let percentage = (average / 255) * 100;
                
                percentage = Math.pow(percentage / 100, 0.5) * 100;
                
                setVolume(Math.min(100, percentage * 1.5));

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
