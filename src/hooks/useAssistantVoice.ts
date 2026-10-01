/**
 * Voice I/O for the EI Assistant on mobile.
 *
 * Input: record with expo-audio, upload to the gateway's /assistant/transcribe
 * (server-side Whisper). Output: speak replies with on-device expo-speech
 * (free, works offline). Both degrade gracefully to text-only.
 */

import { useCallback, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as Speech from 'expo-speech';

import { assistantApi } from '../services/api/assistant';

export function useAssistantVoiceInput(onTranscript: (text: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone access was denied. You can keep typing instead.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch {
      setError('Could not start recording. Please type your question instead.');
      setIsRecording(false);
    }
  }, [recorder]);

  const stopAndTranscribe = useCallback(async () => {
    if (!isRecording) return;
    setIsRecording(false);
    try {
      await recorder.stop();
      // Recording no longer needs the mic; restore playback mode
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) return;

      setIsTranscribing(true);
      const result = await assistantApi.transcribe({
        uri,
        name: 'voice-input.m4a',
        type: 'audio/m4a',
      });
      if (result.text) onTranscript(result.text);
    } catch {
      setError('Transcription failed. Please type your question instead.');
    } finally {
      setIsTranscribing(false);
    }
  }, [isRecording, onTranscript, recorder]);

  const cancel = useCallback(async () => {
    if (!isRecording) return;
    setIsRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      // nothing useful to do; next start() re-prepares
    }
  }, [isRecording, recorder]);

  return {
    isRecording,
    isTranscribing,
    error,
    clearError: () => setError(null),
    start,
    stopAndTranscribe,
    cancel,
  };
}

/** Speak an assistant reply aloud (on-device, free). */
export function speakReply(text: string) {
  const plain = text
    .replace(/[*_#`>|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return;
  Speech.stop();
  Speech.speak(plain.slice(0, 1200), {
    // Devanagari content → Hindi voice
    language: /[ऀ-ॿ]/.test(plain) ? 'hi-IN' : 'en-IN',
  });
}

export function stopSpeaking() {
  Speech.stop();
}
