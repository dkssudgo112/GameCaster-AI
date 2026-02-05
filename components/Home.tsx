import React, { useState, useRef, useEffect } from 'react';
import { AppConfig, CasterStyle } from '../types';
import { ComputerDesktopIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

interface HomeProps {
  onStart: (config: AppConfig) => void;
}

type WizardStep = 'IDLE' | 'GUIDE' | 'PREVIEW';

const Home: React.FC<HomeProps> = ({ onStart }) => {
  // Config State
  const [style, setStyle] = useState<CasterStyle>(CasterStyle.PRO);
  const [hypeLevel, setHypeLevel] = useState(50);
  const [subtitles, setSubtitles] = useState(true);
  
  // Input Data State - Only Screen Stream needed now
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  // UI State
  const [screenStep, setScreenStep] = useState<WizardStep>('IDLE');
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  
  // Ref to track if we are handing off the stream to the next component
  const streamKeepAliveRef = useRef(false);

  // Clean up stream on unmount ONLY if we aren't keeping it alive for the next screen
  useEffect(() => {
    return () => {
      if (screenStream && !streamKeepAliveRef.current) {
        screenStream.getTracks().forEach(track => track.stop());
        console.log("Screen stream stopped on cleanup");
      }
    };
  }, [screenStream]);

  // Handle Screen Share Selection
  const startScreenShare = async () => {
    try {
      // We request audio: true to capture system audio. 
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: true 
      });
      
      // If there was an previous stream, stop it
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
      }

      setScreenStream(stream);
      setScreenStep('PREVIEW');
      streamKeepAliveRef.current = false; // Reset keep alive
      
      // Auto-play preview
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }
      
      // Handle user stopping stream via browser UI
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        setScreenStep('IDLE');
      };

    } catch (e) {
      console.error("Screen share cancelled", e);
      setScreenStep('IDLE');
    }
  };

  const handleStart = () => {
    if (screenStream) {
        streamKeepAliveRef.current = true; // Mark as kept alive for transition
        onStart({
            style,
            hypeLevel,
            inputType: 'SCREEN',
            mediaSource: screenStream,
            showSubtitles: subtitles
        });
    }
  };

  // --------------------------------------------------------------------------
  // RENDER: Screen Share Wizard Modal
  // --------------------------------------------------------------------------
  const renderScreenWizard = () => {
    if (screenStep === 'IDLE') return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-fade-in-up">
                
                {/* Header */}
                <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-display font-bold text-white">
                        {screenStep === 'GUIDE' ? 'SCREEN SHARE SETUP' : 'PREVIEW CAPTURE'}
                    </h2>
                    <button 
                        onClick={() => {
                            if (screenStream) screenStream.getTracks().forEach(t => t.stop());
                            setScreenStream(null);
                            setScreenStep('IDLE');
                        }}
                        className="text-slate-400 hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-8">
                    {screenStep === 'GUIDE' && (
                        <div className="space-y-6">
                            <div className="grid gap-4">
                                <div className="flex gap-4 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl">
                                    <ComputerDesktopIcon className="w-8 h-8 text-indigo-400 shrink-0" />
                                    <div>
                                        <h3 className="font-bold text-indigo-300 mb-1">Option A: Entire Screen (Recommended)</h3>
                                        <p className="text-sm text-slate-400">Captures everything. Best performance, no black screens. Good for full-screen games.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                                    <div className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 font-bold text-slate-400 shrink-0">WIN</div>
                                    <div>
                                        <h3 className="font-bold text-slate-300 mb-1">Option B: Window / Application</h3>
                                        <p className="text-sm text-slate-400">Cleanest, but some games block capture. <span className="text-yellow-400 font-bold">Use "Windowed" or "Bordered" mode in-game.</span></p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded text-xs text-yellow-200">
                                <strong>Tip:</strong> Please check "Share Audio" in the browser popup if you want to capture game sound (feature coming soon).
                            </div>

                            <button 
                                onClick={startScreenShare}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold font-display tracking-wider shadow-lg transition-all"
                            >
                                SELECT SCREEN TO SHARE
                            </button>
                        </div>
                    )}

                    {screenStep === 'PREVIEW' && (
                        <div className="space-y-6">
                             <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700">
                                 <video 
                                    ref={el => {
                                        if (el && screenStream) el.srcObject = screenStream;
                                    }} 
                                    autoPlay 
                                    muted 
                                    playsInline 
                                    className="w-full h-full object-contain"
                                 />
                                 <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 rounded text-xs font-bold text-white animate-pulse">LIVE PREVIEW</div>
                             </div>
                             
                             <div className="flex gap-4">
                                 <button 
                                     onClick={() => {
                                         if (screenStream) screenStream.getTracks().forEach(t => t.stop());
                                         setScreenStream(null);
                                         setScreenStep('GUIDE');
                                     }}
                                     className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
                                 >
                                     RETAKE
                                 </button>
                                 <button 
                                     onClick={() => {
                                         handleStart(); // Start the app with current stream
                                     }}
                                     className="flex-[2] py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold font-display"
                                 >
                                     LOOKS GOOD - START CASTING
                                 </button>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: Main Home
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {renderScreenWizard()}

      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8 bg-slate-950 rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
        
        {/* Left: Branding & Info */}
        <div className="p-12 bg-gradient-to-br from-indigo-900 to-slate-900 flex flex-col justify-center relative overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
           {/* Decorative blurred glow */}
           <div className="absolute -top-24 -left-24 w-64 h-64 bg-purple-600/30 rounded-full blur-3xl"></div>
           <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-600/30 rounded-full blur-3xl"></div>

           <div className="relative z-10">
             <h1 className="text-5xl md:text-6xl font-display font-bold text-white mb-4">
                GAME<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-500">CASTER AI</span>
             </h1>
             <p className="text-indigo-200 text-lg mb-8 leading-relaxed">
                Experience the future of streaming. Your personal AI shoutcaster that watches your gameplay and provides real-time, high-energy commentary.
             </p>
             <div className="flex gap-4 text-sm font-mono text-indigo-300">
                <span className="px-3 py-1 bg-indigo-950/50 rounded border border-indigo-500/30">Gemini Live</span>
                <span className="px-3 py-1 bg-indigo-950/50 rounded border border-indigo-500/30">Computer Vision</span>
             </div>
           </div>
        </div>

        {/* Right: Controls */}
        <div className="p-8 md:p-12 flex flex-col gap-8">
            
            {/* Screen Share Section - Main Focus */}
            <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Input Source</label>
                 <div className="animate-fade-in bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <ComputerDesktopIcon className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-bold text-indigo-200 text-sm">Screen Capture</h3>
                                {screenStream ? (
                                    <div className="mt-2 mb-3 bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                        <p className="text-xs text-green-400 font-bold flex items-center gap-1.5">
                                            <CheckCircleIcon className="w-4 h-4" />
                                            Screen Ready
                                        </p>
                                        <button 
                                            onClick={() => setScreenStep('PREVIEW')}
                                            className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 underline"
                                        >
                                            View Preview
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-1 mb-3 leading-relaxed">
                                        Share your game window or entire screen. <br/>
                                        <span className="text-indigo-400">AI will watch and commentate in real-time.</span>
                                    </p>
                                )}
                                
                                <button 
                                    onClick={() => setScreenStep('GUIDE')}
                                    className={`w-full py-3 text-xs font-bold rounded border transition-colors ${screenStream ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-lg shadow-indigo-900/20'}`}
                                >
                                    {screenStream ? 'CHANGE SCREEN' : 'SELECT SCREEN TO SHARE'}
                                </button>
                            </div>
                        </div>
                    </div>
            </div>

            {/* Configs */}
            <div className="border-t border-slate-800 pt-6 space-y-6">
                 <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Commentary Style</label>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.values(CasterStyle).map((s) => (
                            <button
                                key={s}
                                onClick={() => setStyle(s)}
                                className={`px-3 py-2 rounded text-sm font-bold transition-all ${style === s ? 'bg-white text-indigo-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hype Level</label>
                        <span className="text-xs text-indigo-400 font-bold">{hypeLevel}%</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={hypeLevel} 
                        onChange={(e) => setHypeLevel(Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                </div>
                
                <div className="flex items-center gap-3">
                   <div 
                     onClick={() => setSubtitles(!subtitles)}
                     className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${subtitles ? 'bg-indigo-600' : 'bg-slate-700'}`}
                   >
                     <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${subtitles ? 'translate-x-6' : 'translate-x-0'}`} />
                   </div>
                   <span className="text-sm text-slate-300">Show Real-time Subtitles</span>
                </div>
            </div>

            <button 
                onClick={handleStart}
                disabled={!screenStream}
                className={`w-full py-4 rounded-xl font-bold font-display tracking-wider text-lg shadow-lg transition-all transform hover:-translate-y-1 
                    ${!screenStream
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none' 
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-900/50'}`}
            >
                {!screenStream ? 'SELECT SCREEN FIRST' : 'START CASTING'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default Home;