import React, { useEffect, useRef } from 'react';

interface Props {
  analyser: AnalyserNode | null;
  colorMode?: 'AI' | 'MIC';
  width?: number;
  height?: number;
}

const AudioVisualizer: React.FC<Props> = ({ analyser, colorMode = 'AI', width = 300, height = 50 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // If no analyser, we still want to draw the "empty" state if canvas exists, 
    // but typically the parent component handles layout. 
    // We'll proceed if canvas is available.
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Config
    const barCount = 10;
    const barSpacing = 2;
    const barWidth = (canvas.width - ((barCount - 1) * barSpacing)) / barCount;

    let animationId: number;
    let dataArray: Uint8Array | null = null;
    
    if (analyser) {
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    }

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (analyser && dataArray) {
          analyser.getByteFrequencyData(dataArray);
          const step = Math.floor(dataArray.length / barCount);

          for (let i = 0; i < barCount; i++) {
            // Calculate Average volume for this bar
            let sum = 0;
            for(let j=0; j<step; j++) {
                sum += dataArray[i * step + j] || 0;
            }
            const avg = sum / step;
            const normalized = avg / 255; // 0 to 1

            const x = i * (barWidth + barSpacing);
            
            // Draw Background Bar (faint)
            ctx.fillStyle = colorMode === 'AI' ? 'rgba(129, 140, 248, 0.1)' : 'rgba(52, 211, 153, 0.1)';
            const maxBarHeight = canvas.height * 0.8; // Max height
            const yBase = (canvas.height - maxBarHeight) / 2;
            ctx.fillRect(x, yBase, barWidth, maxBarHeight);

            // Draw Active Bar
            const activeHeight = Math.max(4, normalized * maxBarHeight); // Min height 4px
            const yActive = (canvas.height - activeHeight) / 2; // Center vertically

            if (colorMode === 'AI') {
                ctx.fillStyle = `rgba(129, 140, 248, ${0.6 + normalized * 0.4})`; // Indigo
            } else {
                ctx.fillStyle = `rgba(52, 211, 153, ${0.6 + normalized * 0.4})`; // Emerald
            }
            ctx.fillRect(x, yActive, barWidth, activeHeight);
          }
      } else {
          // Draw "Off" state (just faint bars)
          for (let i = 0; i < barCount; i++) {
              const x = i * (barWidth + barSpacing);
              const h = 4; // Minimal height
              const y = (canvas.height - h) / 2;
              
              ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.fillRect(x, y, barWidth, h);
          }
      }
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [analyser, colorMode]);

  return (
    <canvas 
        ref={canvasRef} 
        width={width} 
        height={height} 
    />
  );
};

export default AudioVisualizer;