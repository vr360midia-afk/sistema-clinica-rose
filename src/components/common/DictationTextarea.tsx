import React, { useRef, useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DictationTextareaProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

const MAX_SECONDS = 120;

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const DictationTextarea: React.FC<DictationTextareaProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
}) => {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };

      recorder.onstop = () => {
        setRecording(false);
        if (!chunks.length) return;
        setTranscribing(true);

        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const result = reader.result as string;
            const base64 = result.split(',')[1];

            const { data, error } = await supabase.functions.invoke('transcrever-audio', {
              body: { audioBase64: base64, mimeType },
            });
            if (error) throw error;

            const text = (data?.text || '').trim();
            if (text) {
              const el = textareaRef.current;
              const start = el ? el.selectionStart : value.length;
              const end = el ? el.selectionEnd : value.length;
              const spacer = value.length && start > 0 ? ' ' : '';
              const newValue = value.slice(0, start) + spacer + text + value.slice(end);
              onChange(newValue);
              toast.success('Ditado inserido');
            } else {
              toast.info('Nenhum texto identificado no áudio');
            }
          } catch (err: any) {
            toast.error('Erro ao transcrever áudio', { description: err.message });
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

      setTimeout(() => {
        if (recorderRef.current?.state === 'recording') stopRecording();
      }, MAX_SECONDS * 1000);
    } catch (err: any) {
      toast.error('Não foi possível acessar o microfone', { description: err.message });
    }
  }, [value, onChange, stopRecording]);

  const toggle = () => {
    if (transcribing) return;
    if (recording) stopRecording();
    else startRecording();
  };

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="pr-12"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8"
          onClick={toggle}
          disabled={transcribing}
          title={recording ? 'Parar gravação' : 'Ditar por voz'}
        >
          {transcribing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : recording ? (
            <Square className="h-4 w-4 text-destructive fill-current" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      </div>
      {recording && (
        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
          </span>
          Gravando… {formatTime(seconds)} (máx {formatTime(MAX_SECONDS)})
        </p>
      )}
    </div>
  );
};

export default DictationTextarea;
