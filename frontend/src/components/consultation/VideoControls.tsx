import { useState } from 'react';

interface VideoControlsProps {
  onEndCall?: () => void;
  micOn?: boolean;
  camOn?: boolean;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
}

export default function VideoControls({
  onEndCall,
  micOn: externalMicOn,
  camOn: externalCamOn,
  onToggleMic,
  onToggleCamera,
}: VideoControlsProps) {
  // Use internal state as fallback when no external control is provided
  const [internalMicOn, setInternalMicOn] = useState(true);
  const [internalCamOn, setInternalCamOn] = useState(true);

  const micOn = externalMicOn ?? internalMicOn;
  const camOn = externalCamOn ?? internalCamOn;

  const handleMicToggle = () => {
    if (onToggleMic) {
      onToggleMic();
    } else {
      setInternalMicOn(!internalMicOn);
    }
  };

  const handleCamToggle = () => {
    if (onToggleCamera) {
      onToggleCamera();
    } else {
      setInternalCamOn(!internalCamOn);
    }
  };

  return (
    <div className="flex items-center justify-center gap-3">
      {/* Mic Toggle */}
      <button
        onClick={handleMicToggle}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          micOn
            ? 'bg-slate-700 text-white hover:bg-slate-600'
            : 'bg-slate-500 text-slate-300 hover:bg-slate-400'
        }`}
        aria-label={micOn ? '마이크 끄기' : '마이크 켜기'}
      >
        {micOn ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <line x1="1" y1="1" x2="23" y2="23" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .33-.02.65-.07.97" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      {/* Camera Toggle */}
      <button
        onClick={handleCamToggle}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          camOn
            ? 'bg-slate-700 text-white hover:bg-slate-600'
            : 'bg-slate-500 text-slate-300 hover:bg-slate-400'
        }`}
        aria-label={camOn ? '카메라 끄기' : '카메라 켜기'}
      >
        {camOn ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
            <rect x="2" y="5" width="15" height="14" rx="2" />
            <path d="M17 9l5-3v12l-5-3" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <line x1="1" y1="1" x2="23" y2="23" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-5 3v3l5 3zM6.73 3H17a2 2 0 012 2v7.73" />
            <rect x="2" y="5" width="15" height="14" rx="2" />
          </svg>
        )}
      </button>

      {/* End Call */}
      <button
        onClick={onEndCall}
        className="w-12 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition-colors"
        aria-label="통화 종료"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          <line x1="1" y1="1" x2="23" y2="23" strokeWidth={2.5} />
        </svg>
      </button>
    </div>
  );
}
