import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MODEL_LIVE } from '../constants';
import { decodeBase64, decodeAudioData } from '../utils/audioUtils';

interface LiveServiceCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onAudioData?: (analyser: AnalyserNode) => void;
  onInputAudioData?: (analyser: AnalyserNode) => void; 
  onSubtitle?: (text: string) => void;
  onResponse?: () => void; // Called when ANY message comes back (audio or text)
  onLog?: (message: string) => void; // For debug logging in UI
}

export class GeminiLiveService {
  private client: GoogleGenAI;
  private session: any = null;
  public audioContext: AudioContext | null = null;
  private audioQueueNextStartTime: number = 0;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private callbacks: LiveServiceCallbacks;
  private isConnected: boolean = false;
  private activeSources: AudioBufferSourceNode[] = [];

  // Input Audio State
  private inputAudioContext: AudioContext | null = null;
  private inputMediaStream: MediaStream | null = null;
  private inputProcessor: ScriptProcessorNode | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;

  constructor(callbacks: LiveServiceCallbacks) {
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.callbacks = callbacks;
  }

  private log(msg: string) {
      console.log(`[GeminiLive] ${msg}`);
      if (this.callbacks.onLog) {
          this.callbacks.onLog(msg);
      }
  }

  public async connect(systemInstruction: string) {
    try {
      this.log("Initializing Audio Context...");
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      this.gainNode = this.audioContext.createGain();
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      
      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);
      
      this.startVisualizer();

      const config = {
        model: MODEL_LIVE,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: systemInstruction,
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            this.isConnected = true;
            this.log("Session Opened.");
            if (this.callbacks.onOpen) this.callbacks.onOpen();
          },
          onclose: () => {
            this.isConnected = false;
            this.log("Session Closed.");
            if (this.callbacks.onClose) this.callbacks.onClose();
          },
          onerror: (err: any) => {
            this.log(`Error: ${err.message}`);
            if (this.callbacks.onError) this.callbacks.onError(new Error(err.message || 'Network error'));
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
        }
      };

      this.log("Connecting to Gemini Live API...");
      // @ts-ignore
      this.session = await this.client.live.connect(config);

      // Start Input Audio (Microphone)
      await this.startAudioInput();

    } catch (error: any) {
      this.log(`Connection Failed: ${error.message}`);
      if (this.callbacks.onError) this.callbacks.onError(error);
      this.disconnect();
    }
  }

  private async startAudioInput() {
    try {
        this.inputMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        
        this.inputSource = this.inputAudioContext.createMediaStreamSource(this.inputMediaStream);
        this.inputAnalyser = this.inputAudioContext.createAnalyser();
        this.inputAnalyser.fftSize = 64; 
        this.inputAnalyser.smoothingTimeConstant = 0.5;
        
        this.inputProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
        
        this.inputProcessor.onaudioprocess = (e) => {
            if (!this.isConnected || !this.session) return;
            
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmData = this.createPcmData(inputData);
            
            this.session.sendRealtimeInput({ 
                media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: pcmData
                } 
            });
        };
        
        this.inputSource.connect(this.inputAnalyser);
        this.inputAnalyser.connect(this.inputProcessor);
        
        if (this.callbacks.onInputAudioData) {
            this.callbacks.onInputAudioData(this.inputAnalyser);
        }

        const muteNode = this.inputAudioContext.createGain();
        muteNode.gain.value = 0;
        this.inputProcessor.connect(muteNode);
        muteNode.connect(this.inputAudioContext.destination);
        
        this.log("Microphone connected & streaming.");

    } catch (e) {
        this.log("Microphone access denied or error. (Check permissions)");
    }
  }

  private createPcmData(data: Float32Array): string {
      const l = data.length;
      const int16 = new Int16Array(l);
      for (let i = 0; i < l; i++) {
        const s = Math.max(-1, Math.min(1, data[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      let binary = '';
      const bytes = new Uint8Array(int16.buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
  }

  public get isAudioSuspended(): boolean {
    return this.audioContext?.state === 'suspended';
  }

  public async resumeAudio() {
    // Resume Output Audio
    if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
            await this.audioContext.resume();
            this.log("Output Audio Context Resumed.");
        } catch (e) {
            console.error("Failed to resume AudioContext", e);
        }
    }
    // Resume Input Audio (Fix for dead mic visualizer)
    if (this.inputAudioContext && this.inputAudioContext.state === 'suspended') {
        try {
            await this.inputAudioContext.resume();
            this.log("Input Audio Context Resumed.");
        } catch (e) {
            console.error("Failed to resume Input AudioContext", e);
        }
    }
  }

  public async ensureAudioRunning() {
    await this.resumeAudio();
  }

  private async handleMessage(message: LiveServerMessage) {
    if (this.callbacks.onResponse) {
        this.callbacks.onResponse();
    }

    // 1. Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        this.log(`Received Audio Chunk`);
        
        if (this.audioContext && this.gainNode) {
            try {
                const audioData = decodeBase64(base64Audio);
                const audioBuffer = await decodeAudioData(audioData, this.audioContext, 24000, 1);
                
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.gainNode);

                const currentTime = this.audioContext.currentTime;
                if (this.audioQueueNextStartTime < currentTime) {
                    this.audioQueueNextStartTime = currentTime;
                }
                
                source.start(this.audioQueueNextStartTime);
                this.audioQueueNextStartTime += audioBuffer.duration;

                this.activeSources.push(source);
                source.onended = () => {
                    const index = this.activeSources.indexOf(source);
                    if (index > -1) this.activeSources.splice(index, 1);
                };

            } catch (e) {
                console.error("Error decoding audio", e);
                this.log("Error decoding audio chunk");
            }
        }
    }

    // 2. Handle Text (Subtitles)
    if (message.serverContent?.outputTranscription?.text) {
        const text = message.serverContent.outputTranscription.text;
        if (this.callbacks.onSubtitle) {
            this.callbacks.onSubtitle(text);
        }
    }
    
    // 3. Handle Interruption
    if (message.serverContent?.interrupted) {
       this.log("Model Interrupted.");
       this.activeSources.forEach(source => {
           try { source.stop(); } catch(e) {}
       });
       this.activeSources = [];
       if (this.audioContext) {
           this.audioQueueNextStartTime = this.audioContext.currentTime;
       }
    }
  }

  public async sendVideoFrame(base64Data: string) {
    if (!this.isConnected || !this.session) return;
    try {
        await this.session.sendRealtimeInput({
            media: {
                mimeType: 'image/jpeg',
                data: base64Data
            }
        });
    } catch (e: any) {
        this.log(`Error sending frame: ${e.message}`);
    }
  }

  public mute(muted: boolean) {
    if (this.gainNode && this.audioContext) {
        this.gainNode.gain.setValueAtTime(muted ? 0 : 1, this.audioContext.currentTime);
        if (!muted && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
  }

  public async disconnect() {
    this.isConnected = false;
    
    this.activeSources.forEach(s => {
        try { s.stop(); } catch(e) {}
    });
    this.activeSources = [];

    if (this.inputMediaStream) {
        this.inputMediaStream.getTracks().forEach(t => t.stop());
        this.inputMediaStream = null;
    }
    if (this.inputAudioContext) {
        try { await this.inputAudioContext.close(); } catch(e) {}
        this.inputAudioContext = null;
    }

    if (this.session) {
        try {
            this.log("Closing session...");
            if (this.session && typeof this.session.close === 'function') {
                await this.session.close();
            }
        } catch (e) {
            console.error("Error closing Live session", e);
        }
        this.session = null;
    }

    if (this.audioContext) {
        try {
            await this.audioContext.close();
        } catch (e) {
            console.error("Error closing audio context", e);
        }
        this.audioContext = null;
    }
  }

  private startVisualizer() {
    if (!this.isConnected || !this.analyserNode) return;
    requestAnimationFrame(() => this.startVisualizer());
    if (this.callbacks.onAudioData && this.analyserNode) {
        this.callbacks.onAudioData(this.analyserNode);
    }
  }
}