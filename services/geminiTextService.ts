import { GoogleGenAI, Type } from '@google/genai';
import { MODEL_TEXT } from '../constants';
import { AnalysisResult, GameEvent } from '../types';

export const generatePostGameReport = async (events: GameEvent[]): Promise<AnalysisResult> => {
  const client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Prepare a textual summary of events for the AI
  const eventsSummary = events.map(e => `Time: ${Math.floor(e.timestamp)}s, Type: ${e.type}, Detail: ${e.description}`).join('\n');
  
  // If no events, create dummy data to prevent crash
  const effectiveSummary = eventsSummary.length > 0 ? eventsSummary : "The match was standard play with no specific marked highlights.";

  const prompt = `
    You are an esports analyst. Based on the following log of gameplay events, generate a post-match summary card.
    
    Event Log:
    ${effectiveSummary}
    
    Return the result in JSON format.
  `;

  try {
    const response = await client.models.generateContent({
        model: MODEL_TEXT,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    highlights: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                timestamp: { type: Type.STRING },
                                description: { type: Type.STRING, description: "A catchy one-liner commentary about this moment" }
                            }
                        }
                    },
                    playStyle: {
                        type: Type.OBJECT,
                        properties: {
                            archetype: { type: Type.STRING, description: "e.g., 'The Aggressive Entry', 'The Silent Survivor'" },
                            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                            improvement: { type: Type.STRING }
                        }
                    }
                }
            }
        }
    });

    const text = response.text;
    if (text) {
        return JSON.parse(text) as AnalysisResult;
    }
    throw new Error("No data returned");
  } catch (error) {
    console.error("Failed to generate report", error);
    // Fallback data
    return {
        highlights: [],
        playStyle: {
            archetype: "Unknown Player",
            strengths: ["Consistency"],
            improvement: "Try to generate more distinct plays next time."
        }
    };
  }
};