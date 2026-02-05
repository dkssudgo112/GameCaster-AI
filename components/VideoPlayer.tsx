import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { blobToBase64 } from '../utils/audioUtils';

interface VideoPlayerProps {
  type: 'SAMPLE' | 'SCREEN' | 'LOCAL';
  src?: string | MediaStream; // Can be a URL string or a MediaStream object
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
}

export interface VideoPlayerRef {
  getFrame: () => Promise<string | null>;
  play: () => void;
  pause: () => void;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({ type, src, onEnded, onTimeUpdate }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => ({
    getFrame: async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return null;

      // Ensure video has data
      if (video.readyState < 2) return null;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // OPTIMIZATION: Drastically reduce resolution for AI analysis.
      // Sending 1080p/720p frames every 500ms kills bandwidth and latency.
      // 360px width is sufficient for the model to understand "Danger" or "Action".
      const MAX_WIDTH = 360;
      const scale = MAX_WIDTH / video.videoWidth;
      
      canvas.width = MAX_WIDTH;
      canvas.height = video.videoHeight * scale;
      
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob then base64
        return new Promise<string | null>((resolve) => {
          canvas.toBlob(async (blob) => {
            if (blob) {
              const base64 = await blobToBase64(blob);
              resolve(base64);
            } else {
              resolve(null);
            }
          }, 'image/jpeg', 0.5); // Quality 0.5 is enough for AI
        });
      } catch (e) {
        console.error("Frame capture failed (likely tainted canvas):", e);
        return null;
      }
    },
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
  }));

  // Handle Source Changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (type === 'SCREEN' && src instanceof MediaStream) {
      video.srcObject = src;
      video.play().catch(e => console.error("Auto-play failed:", e));
    } else if ((type === 'SAMPLE' || type === 'LOCAL') && typeof src === 'string') {
      video.srcObject = null;
      
      // Handle CORS for samples
      if (type === 'SAMPLE') {
         video.crossOrigin = "anonymous";
         const separator = src.includes('?') ? '&' : '?';
         const cacheBuster = `cb=${Date.now()}`;
         video.src = `${src}${separator}${cacheBuster}`;
      } else {
         // Local blob URLs don't need crossOrigin usually, but good to reset
         video.removeAttribute('crossorigin');
         video.src = src;
      }
      
      video.load();
    }
  }, [type, src]);

  const handleTimeUpdate = () => {
    if (videoRef.current && onTimeUpdate) {
        onTimeUpdate(videoRef.current.currentTime);
    }
  };

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden border border-slate-700 shadow-2xl flex items-center justify-center">
      {/* Hidden Canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {!src && (
        <div className="text-slate-500 font-mono text-sm animate-pulse">Waiting for video source...</div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted={true} // Mute source to prioritize AI commentary
        playsInline
        controls={type !== 'SCREEN'} // Hide controls for screen share
        onEnded={onEnded}
        onTimeUpdate={handleTimeUpdate}
      />
    </div>
  );
});

export default VideoPlayer;