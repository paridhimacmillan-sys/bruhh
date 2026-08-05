import { useEffect, useMemo, useState } from "react";
import { MessageCircle, RotateCcw, X } from "lucide-react";
import type { Batch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(value);
}

function playMessageSound() {
  try {
    const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    window.setTimeout(() => void context.close(), 300);
  } catch {
    // Audio is optional and may be blocked by browser or device settings.
  }
}

export function SmsPreviewPanel({ batch, onDismiss }: { batch: Batch; onDismiss: () => void }) {
  const [animationKey, setAnimationKey] = useState(0);
  const [timestamp, setTimestamp] = useState(() => new Date());
  const receiptUrl = useMemo(() => new URL(`/r/${batch.id}?lang=pa`, window.location.origin).toString(), [batch.id]);
  const weight = formatNumber(batch.weightTonnes);
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(batch.farmerPaidInr);

  useEffect(() => {
    setTimestamp(new Date());
    setAnimationKey((key) => key + 1);
  }, [batch.id]);

  useEffect(() => {
    playMessageSound();
  }, [animationKey]);

  const replay = () => {
    setTimestamp(new Date());
    setAnimationKey((key) => key + 1);
  };

  const timeLabel = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(timestamp);

  return (
    <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-sm items-center bg-background/95 px-4 py-6 shadow-[-24px_0_60px_-36px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:px-6" aria-label="SMS preview" aria-live="polite">
      <div key={animationKey} className="sms-panel-enter w-full">
        <div className="mb-3 flex items-center justify-between">
          <div><p className="eyebrow">Notification simulation</p><h2 className="mt-1 font-display text-2xl">Farmer SMS preview</h2></div>
          <button type="button" onClick={onDismiss} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground" aria-label="Dismiss SMS preview"><X className="h-4 w-4" /></button>
        </div>

        <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[2rem] border-[6px] border-foreground bg-[#f3f5f1] shadow-xl">
          <div className="flex h-7 items-center justify-between bg-foreground px-4 text-[0.6rem] text-background"><span>{timeLabel}</span><span>4G · 82%</span></div>
          <div className="border-b border-black/10 bg-white px-4 py-4 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><MessageCircle className="h-5 w-5" /></div>
            <p className="mt-2 text-sm font-bold text-black">UNPKOS</p>
            <p className="text-[0.65rem] text-black/55">{timeLabel}</p>
          </div>
          <div className="min-h-[310px] px-3 py-5">
            <div className="sms-bubble-shake max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[0.82rem] leading-relaxed text-black shadow-sm">
              <span>UnpackOS: Tuhada {weight} tonne parali vikeya — {amount} FPO khaate vich aa gaye. Raseed: </span>
              <a href={receiptUrl} target="_blank" rel="noreferrer" className="break-all font-medium text-blue-700 underline underline-offset-2">{receiptUrl}</a>
            </div>
            <p className="ml-2 mt-1 text-[0.6rem] text-black/45">{timeLabel}</p>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-[320px] text-center text-xs leading-relaxed text-muted-foreground">Sent to farmer&apos;s phone — no app or internet needed</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={replay}><RotateCcw className="mr-2 h-3.5 w-3.5" /> Replay</Button>
          <Button type="button" size="sm" onClick={onDismiss}>Dismiss</Button>
        </div>
      </div>
    </aside>
  );
}
