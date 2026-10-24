import { useEffect, useState } from 'react';
export function VoiceSourceNotice() {
  const [source, setSource] = useState('');
  useEffect(() => {
    const onSource = (event: Event) => setSource((event as CustomEvent<string>).detail);
    window.addEventListener('misu:voice-source', onSource);
    return () => window.removeEventListener('misu:voice-source', onSource);
  }, []);
  return source ? (
    <p className="voice-source-notice" role="status">
      {source}
    </p>
  ) : null;
}
