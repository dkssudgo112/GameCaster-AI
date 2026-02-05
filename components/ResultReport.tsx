import React, { useEffect, useState } from 'react';
import { AnalysisResult, GameEvent } from '../types';
import { generatePostGameReport } from '../services/geminiTextService';

interface ResultReportProps {
  events: GameEvent[];
  onRestart: () => void;
}

const ResultReport: React.FC<ResultReportProps> = ({ events, onRestart }) => {
  const [report, setReport] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      const data = await generatePostGameReport(events);
      setReport(data);
      setLoading(false);
    };
    fetchReport();
  }, [events]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-display animate-pulse">ANALYZING MATCH DATA...</h2>
        <p className="text-slate-400 mt-2">Gemini is crafting your player card</p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
            <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-500">
                MATCH SUMMARY
            </h1>
            <p className="text-slate-400">Analysis powered by Gemini 1.5 Flash</p>
        </div>

        {/* Player Card */}
        <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-indigo-600/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
                <div className="flex-1 text-center md:text-left">
                    <h2 className="text-sm uppercase tracking-widest text-indigo-400 font-bold mb-1">Your Archetype</h2>
                    <div className="text-5xl font-display font-bold text-white mb-6 leading-tight">
                        {report.playStyle.archetype}
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 mb-2">KEY STRENGTHS</h3>
                            <div className="flex flex-wrap gap-2">
                                {report.playStyle.strengths.map((s, i) => (
                                    <span key={i} className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-800/50 rounded-full text-sm">
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 mb-2">COACH'S NOTE</h3>
                            <p className="text-slate-300 italic">"{report.playStyle.improvement}"</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Highlights Grid */}
        <div>
            <h2 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
                <span className="w-8 h-1 bg-indigo-500 block"></span>
                TOP MOMENTS
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
                {report.highlights.map((hl, idx) => (
                    <div key={idx} className="bg-slate-950 p-6 rounded-xl border border-slate-800 hover:border-indigo-500 transition-colors group">
                        <div className="text-indigo-500 font-mono text-xs mb-2">{hl.timestamp}</div>
                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                            {hl.title}
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            {hl.description}
                        </p>
                    </div>
                ))}
                {report.highlights.length === 0 && (
                     <div className="col-span-3 text-center text-slate-500 py-12 bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
                        No significant highlights detected. Try playing more aggressively!
                     </div>
                )}
            </div>
        </div>

        {/* Footer Action */}
        <div className="flex justify-center pt-8">
            <button 
                onClick={onRestart}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold font-display tracking-wider shadow-lg shadow-indigo-900/50 transition-all hover:scale-105"
            >
                CAST ANOTHER MATCH
            </button>
        </div>

      </div>
    </div>
  );
};

export default ResultReport;