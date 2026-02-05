import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import AudioVisualizer from './AudioVisualizer';
import { GeminiLiveService } from '../services/geminiLiveService';
import { AppConfig, GameEvent, GameEventType } from '../types';
import { SYSTEM_INSTRUCTIONS, HYPE_MODIFIER } from '../constants';
import { 
  SpeakerWaveIcon, 
  SpeakerXMarkIcon,
  BookmarkIcon,
  BoltIcon,
  ExclamationCircleIcon,
  PlayCircleIcon,
  MicrophoneIcon,
  CommandLineIcon
} from '@heroicons/react/24/solid';

interface LiveCasterProps {
  config: AppConfig;
  onFinish: (events: GameEvent[]) => void;
}

const LiveCaster: React.FC<LiveCasterProps> = ({ config, onFinish }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isAudioSuspended, setIsAudioSuspended] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [subtitles, setSubtitles] = useState<string>("");
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [aiAnalyser, setAiAnalyser] = useState<AnalyserNode | null>(null);
  const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Stats & Debug
  const [framesSent, setFramesSent] = useState(0);
  const [responsesReceived, setResponsesReceived] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const videoRef = useRef<VideoPlayerRef>(null);
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const addLog = useCallback((msg: string) => {
      setLogs(prev => [msg, ...prev].slice(0, 50));
  }, []);

  // Initialize Gemini Live Service
  useEffect(() => {
    const initService = async () => {
      const instructions = SYSTEM_INSTRUCTIONS[config.style] + HYPE_MODIFIER(config.hypeLevel);
      addLog("Starting service...");
      
      const service = new GeminiLiveService({
        onOpen: async () => {
            setIsConnected(true);
            setConnectionError(null);
            addLog("Connected to Gemini.");

            // Check audio state
            if (service.isAudioSuspended) {
                setIsAudioSuspended(true);
            } else {
                setIsAudioSuspended(false);
            }
        },
        onClose: () => {
            setIsConnected(false);
            addLog("Disconnected.");
        },
        onError: (err) => {
            console.error(err);
            setConnectionError(err.message);
            setIsConnected(false);
            addLog(`Error: ${err.message}`);
        },
        onSubtitle: (text) => setSubtitles(prev => {
            const next = prev + " " + text;
            return next.length > 150 ? "..." + next.slice(next.length - 150) : next;
        }),
        onAudioData: (node) => setAiAnalyser(node),
        onInputAudioData: (node) => setInputAnalyser(node),
        onResponse: () => {
            setResponsesReceived(prev => prev + 1);
        },
        onLog: (msg) => addLog(msg)
      });

      liveServiceRef.current = service;
      await service.connect(instructions);
    };

    initService();

    // Safety timeout
    const timeout = setTimeout(() => {
        if (!liveServiceRef.current?.audioContext) {
            setConnectionError("Connection timed out. Check API Key.");
        }
    }, 15000);

    return () => {
      clearTimeout(timeout);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      liveServiceRef.current?.disconnect();
      
      if (config.inputType === 'SCREEN' && config.mediaSource instanceof MediaStream) {
        config.mediaSource.getTracks().forEach(track => track.stop());
      }
    };
  }, [config.style, config.hypeLevel, config.inputType, config.mediaSource, addLog]);

  // Handle Video Frame Streaming - FIRE AND FORGET STRATEGY
  useEffect(() => {
    if (isConnected) {
      
      const sendFrame = async () => {
          if (videoRef.current && liveServiceRef.current) {
            // Capture frame
            const frameBase64 = await videoRef.current.getFrame();
            if (frameBase64) {
                // Just send it. Don't wait for response to avoid deadlock.
                await liveServiceRef.current.sendVideoFrame(frameBase64);
                setFramesSent(prev => prev + 1);
            }
          }
      };

      // Send a frame every 1.5 seconds.
      frameIntervalRef.current = window.setInterval(async () => {
           await sendFrame();
      }, 1500);
    }

    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
  }, [isConnected, addLog]);

  // Enable Audio (Fix Autoplay Policy)
  const enableAudio = async () => {
    if (liveServiceRef.current) {
        await liveServiceRef.current.resumeAudio();
        setIsAudioSuspended(false);
        videoRef.current?.play();
    }
  };

  const addEvent = (type: GameEventType, desc: string) => {
    const newEvent: GameEvent = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: currentTime,
        type,
        description: desc
    };
    setEvents(prev => [...prev, newEvent]);
  };

  const toggleMute = async () => {
    const next = !isMuted;
    setIsMuted(next);
    if (liveServiceRef.current) {
        await liveServiceRef.current.ensureAudioRunning();
        liveServiceRef.current.mute(next);
    }
  };

  const handleManualHighlight = () => {
    addEvent(GameEventType.USER_PICK, "User Highlight");
  };

  const handleForceStart = async () => {
      if(liveServiceRef.current && videoRef.current) {
          addLog("Manual Poke: Sending Frame...");
          // Manually send a frame to "wake up" the vision model
          const frame = await videoRef.current.getFrame();
          if (frame) {
              await liveServiceRef.current.sendVideoFrame(frame);
              setFramesSent(prev => prev + 1);
          }
      }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-900 overflow-hidden relative">
      
      {/* Audio Autoplay Blocker Overlay */}
      {isConnected && isAudioSuspended && (
          <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in">
              <BoltIcon className="w-16 h-16 text-yellow-400 mb-4 animate-bounce" />
              <h2 className="text-3xl font-display font-bold text-white mb-2">READY TO CAST</h2>
              <p className="text-slate-300 mb-8 max-w-md">
                  Gemini is ready. Click below to start the audio stream.
              </p>
              <button 
                onClick={enableAudio}
                className="group flex items-center gap-3 px-8 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full font-bold text-xl text-white shadow-2xl hover:scale-105 transition-all"
              >
                  <PlayCircleIcon className="w-8 h-8 group-hover:animate-pulse" />
                  START BROADCAST
              </button>
          </div>
      )}

      {/* Header */}
      <header className="h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full animate-pulse-fast ${isConnected ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
            <h1 className="text-xl font-display font-bold text-white tracking-widest">
                GAMECASTER <span className="text-indigo-500">LIVE</span>
            </h1>
        </div>
        <div className="flex items-center gap-4">
             <div className="px-3 py-1 rounded bg-slate-800 text-xs font-mono text-indigo-300 border border-indigo-900/50">
                STATUS: {isConnected ? 'LIVE STREAMING' : 'CONNECTING'}
            </div>
            <div className="px-3 py-1 rounded bg-slate-800 text-xs font-mono text-indigo-300 border border-indigo-900/50">
                STYLE: {config.style}
            </div>
            <button 
                onClick={() => onFinish(events)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold text-sm transition-colors"
            >
                STOP CASTING
            </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Video Area */}
        <div className="flex-1 relative bg-black flex flex-col">
            <div className="flex-1 relative h-full flex items-center justify-center">
                <VideoPlayer 
                    ref={videoRef}
                    type={config.inputType}
                    src={config.mediaSource}
                    onEnded={() => onFinish(events)}
                    onTimeUpdate={setCurrentTime}
                />
                
                {/* Connection Error Overlay */}
                {connectionError && (
                    <div className="absolute inset-0 z-40 bg-black/90 flex flex-col items-center justify-center text-red-500">
                         <ExclamationCircleIcon className="w-12 h-12 mb-2" />
                         <p className="font-bold text-xl">CONNECTION ERROR</p>
                         <p className="text-sm text-red-300 mt-1">{connectionError}</p>
                         <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-slate-800 rounded text-white text-sm">Reload</button>
                    </div>
                )}
                
                {/* Subtitles */}
                {config.showSubtitles && subtitles && (
                    <div className="absolute bottom-24 left-0 right-0 px-8 flex justify-center pointer-events-none z-50">
                        <div className="bg-black/80 backdrop-blur-md px-6 py-4 rounded-2xl border-l-4 border-indigo-500 max-w-3xl text-center shadow-2xl">
                            <p className="text-xl font-medium text-white drop-shadow-lg leading-relaxed font-sans">
                                {subtitles}
                            </p>
                        </div>
                    </div>
                )}

                {/* DEBUG LOG OVERLAY (Toggleable) */}
                {showLogs && (
                    <div className="absolute bottom-24 right-4 w-80 h-48 bg-black/80 backdrop-blur font-mono text-[10px] text-green-400 p-2 overflow-y-auto border border-green-900 rounded z-40">
                         <div className="sticky top-0 bg-black/90 border-b border-green-900 mb-1 font-bold text-xs flex justify-between">
                            <span>DEBUG LOG</span>
                            <button onClick={() => setShowLogs(false)}>X</button>
                         </div>
                         {logs.map((l, i) => (
                             <div key={i} className="mb-0.5 border-b border-white/5 pb-0.5">{l}</div>
                         ))}
                    </div>
                )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="h-24 bg-slate-900 border-t border-slate-800 flex items-center px-6 gap-6 z-20">
                <button 
                    onClick={toggleMute}
                    className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors text-white ring-1 ring-slate-700"
                    title={isMuted ? "Unmute Audio" : "Mute Audio"}
                >
                    {isMuted ? <SpeakerXMarkIcon className="w-6 h-6"/> : <SpeakerWaveIcon className="w-6 h-6"/>}
                </button>

                {/* AI Voice Visualizer */}
                <div className="flex-1 bg-slate-950 rounded-xl h-16 flex items-center px-4 overflow-hidden border border-slate-800 shadow-inner">
                   <AudioVisualizer analyser={aiAnalyser} colorMode="AI" />
                </div>

                <div className="flex gap-2 items-center">
                    {/* Mic Visualizer Area (WIDER: w-32) */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-800 h-14">
                        <div className="flex flex-col items-center justify-center">
                            <MicrophoneIcon className={`w-4 h-4 ${isConnected ? 'text-green-400' : 'text-slate-600'}`} />
                            <span className="text-[10px] font-bold text-slate-500 mt-0.5">MIC</span>
                        </div>
                        {/* Widen from w-20 to w-32 (128px) for visibility */}
                        <div className="w-32 h-full flex items-center">
                             <AudioVisualizer analyser={inputAnalyser} colorMode="MIC" width={128} height={40} />
                        </div>
                    </div>

                    <button 
                        onClick={handleForceStart}
                        className="flex flex-col items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold h-14 border border-slate-700 active:bg-indigo-600 active:text-white"
                        title="Force AI to speak by sending a new frame"
                    >
                        <BoltIcon className="w-5 h-5" />
                        <span className="text-[10px]">POKE AI</span>
                    </button>
                    
                    <button 
                        onClick={() => setShowLogs(!showLogs)}
                        className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl font-bold h-14 border transition-colors ${showLogs ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                        title="Toggle Logs"
                    >
                        <CommandLineIcon className="w-5 h-5" />
                        <span className="text-[10px]">LOGS</span>
                    </button>

                    <button 
                        onClick={handleManualHighlight}
                        className="flex items-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-indigo-900/50 h-14"
                    >
                        <BookmarkIcon className="w-5 h-5" />
                        SAVE
                    </button>
                </div>
            </div>
        </div>

        {/* Right: Event Feed & Timeline */}
        <div className="w-80 bg-slate-950 border-l border-slate-800 flex flex-col z-20">
            <div className="p-4 border-b border-slate-900">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Live Events</h2>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {/* Simulated "Live" Cards */}
                    {events.length === 0 && (
                        <div className="text-slate-600 text-sm italic text-center py-4">Waiting for action...</div>
                    )}
                    {events.slice().reverse().map((evt) => (
                        <div key={evt.id} className="bg-slate-900 p-3 rounded border border-slate-800 flex items-start gap-3 animate-fade-in-left">
                            <div className={`mt-1 w-2 h-2 rounded-full ${
                                evt.type === GameEventType.DANGER ? 'bg-red-500' :
                                evt.type === GameEventType.CLUTCH ? 'bg-yellow-500' :
                                evt.type === GameEventType.USER_PICK ? 'bg-indigo-500' : 'bg-slate-500'
                            }`} />
                            <div>
                                <div className="text-xs text-slate-500 font-mono">{Math.floor(evt.timestamp)}s</div>
                                <div className="text-sm font-bold text-slate-200">{evt.type}</div>
                                <div className="text-xs text-slate-400">{evt.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* AI Status */}
            <div className="mt-auto p-4 border-t border-slate-900 bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
                    <span className="text-xs text-slate-400 font-mono">
                        {isConnected ? 'GEMINI LIVE CONNECTED' : 'CONNECTING...'}
                    </span>
                </div>
                
                <div className="flex justify-between items-center mt-3">
                   <span className="text-[10px] text-slate-500">FRAMES SENT</span>
                   <span className="text-xs font-mono text-indigo-400">{framesSent}</span>
                </div>
                
                <div className="flex justify-between items-center mt-1">
                   <span className="text-[10px] text-slate-500">RESPONSES</span>
                   <span className={`text-xs font-mono ${responsesReceived > 0 ? 'text-green-400' : 'text-slate-600'}`}>
                      {responsesReceived}
                   </span>
                </div>
                
                {/* Warning: No response received after sending many frames */}
                {isConnected && framesSent > 10 && responsesReceived === 0 && (
                     <div className="mt-2 text-[10px] text-red-400 font-bold border border-red-900/50 bg-red-900/20 p-2 rounded animate-pulse">
                        ⚠ NO AUDIO YET? <br/>
                        AI might be thinking. Click "POKE AI" to force a response.
                     </div>
                )}

                {isConnected && isAudioSuspended && (
                    <div className="text-[10px] text-yellow-500 mt-2 font-bold p-2 bg-yellow-900/20 border border-yellow-800/50 rounded">
                        ⚠ AUDIO WAITING FOR INTERACTION
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default LiveCaster;