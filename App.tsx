import React, { useState } from 'react';
import Home from './components/Home';
import LiveCaster from './components/LiveCaster';
import ResultReport from './components/ResultReport';
import { AppConfig, GameEvent } from './types';

type Screen = 'HOME' | 'LIVE' | 'RESULTS';

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('HOME');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [sessionEvents, setSessionEvents] = useState<GameEvent[]>([]);

  const handleStart = (cfg: AppConfig) => {
    setConfig(cfg);
    setScreen('LIVE');
  };

  const handleFinish = (events: GameEvent[]) => {
    setSessionEvents(events);
    setScreen('RESULTS');
  };

  const handleRestart = () => {
    setScreen('HOME');
    setSessionEvents([]);
    setConfig(null);
  };

  return (
    <div className="w-full min-h-screen bg-black text-white">
      {screen === 'HOME' && <Home onStart={handleStart} />}
      
      {screen === 'LIVE' && config && (
        <LiveCaster 
          config={config} 
          onFinish={handleFinish} 
        />
      )}
      
      {screen === 'RESULTS' && (
        <ResultReport 
          events={sessionEvents} 
          onRestart={handleRestart} 
        />
      )}
    </div>
  );
};

export default App;