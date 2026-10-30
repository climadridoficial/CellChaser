import { useEffect, useRef, useState } from 'react';
import { Move, Save, X, RotateCcw, RotateCw, Pencil, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useRadarSession } from '@/components/RadarSession';
import { AEMET_REFRESH_MS, boundsOfCorners, cornersFromBounds, initialBounds, loadAemetImages, rotateCorners, validBounds, validCorners, type AemetMapImage, type Corners, type RadarBounds } from '@/lib/aemet-overlay';

export interface AlignmentTarget { code: string; name: string; lat: number; lon: number }
interface Props {
  target: AlignmentTarget;
  value: AemetMapImage | null;
  onChange: (value: AemetMapImage | null) => void;
  onClose: () => void;
}

export default function AemetAlignment({ target, value, onChange, onClose }: Props) {
  const { userId, ready } = useRadarSession();
  const [images, setImages] = useState<{ original: string; echoes: string } | null>(null);
  const [saved, setSaved] = useState<Corners | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(() => Math.floor(Date.now() / AEMET_REFRESH_MS));
  const [visible, setVisible] = useState(true);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const timer = setInterval(() => setTick(Math.floor(Date.now() / AEMET_REFRESH_MS)), AEMET_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let live = true;
    setImages(null);
    setError(null);
    loadAemetImages(target.code, tick).then(next => {
      if (live) setImages(next);
    }).catch(e => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [target.code, tick]);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    setSaved(null);
    setVisible(true);
    if (userId) {
      supabase.from('radar_alignments').select('south,west,north,east,corners').eq('user_id', userId).eq('radar_code', target.code).maybeSingle().then(({ data, error: err }) => {
        if (!live) return;
        if (err) setError('No se pudo recuperar la alineación guardada.');
        if (data) {
          const bounds: RadarBounds = [[data.south, data.west], [data.north, data.east]];
          if (validCorners(data.corners)) setSaved(data.corners);
          else if (validBounds(bounds)) setSaved(cornersFromBounds(bounds));
        }
      });
    }
    return () => { live = false; };
  }, [target.code, userId, ready, onChange]);

  useEffect(() => {
    if (!images || !ready || !visible) return;
    const current = valueRef.current;
    const editing = !saved || Boolean(current?.editing && current.code === target.code && current.image === images.original);
    const corners = saved ?? current?.corners ?? cornersFromBounds(current?.bounds ?? initialBounds(target.lat, target.lon));
    onChange({ code: target.code, corners, bounds: boundsOfCorners(corners), image: editing ? images.original : images.echoes, editing, opacity: current?.opacity ?? 0.5 });
  }, [images, saved, target.code, target.lat, target.lon, ready, visible, onChange]);

  const signIn = async (provider: 'google' | 'lovable') => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) setError('No se pudo iniciar sesión.');
    setBusy(false);
  };

  const save = async () => {
    const corners = value?.corners ?? (value ? cornersFromBounds(value.bounds) : null);
    if (!value || !userId || !corners || !validCorners(corners)) return;
    setBusy(true);
    setError(null);
    const [[south,west],[north,east]] = boundsOfCorners(corners);
    const { data, error: err } = await supabase.from('radar_alignments').upsert({ user_id: userId, radar_code: target.code, south,west,north,east, corners, updated_at: new Date().toISOString() }).select('corners').single();
    setBusy(false);
    if (err || !data) { setError('No se pudo guardar. La imagen sigue en modo de alineación.'); return; }
    const stored = validCorners(data.corners) ? data.corners : corners;
    if (images) onChange({ ...value, corners: stored, bounds: boundsOfCorners(stored), image: images.echoes, editing: false });
    setSaved(stored);
  };

  return <aside className="aemet-alignment-bar" aria-label="Alineación del radar AEMET">
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0"><h2 className="truncate text-sm font-semibold">{target.name}</h2><p className="text-xs text-muted-foreground">AEMET · {value?.editing ? 'Alinear imagen' : saved ? 'Alineación guardada · dBZ' : 'Cargando imagen…'}</p></div>
      <Button variant="ghost" size="icon" onClick={onClose} title="Cerrar" aria-label="Cerrar alineación"><X /></Button>
    </div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {value?.editing && <>
      <div className="flex items-center gap-3"><Move className="size-4 shrink-0 text-primary" /><label className="text-xs" htmlFor="alignment-opacity">Opacidad</label><input id="alignment-opacity" aria-label="Opacidad de la imagen" type="range" min="0.15" max="0.85" step="0.05" value={value.opacity} onChange={e => onChange({ ...value, opacity: Number(e.target.value) })} className="min-w-0 flex-1 accent-primary" /></div>
      <p className="text-xs text-muted-foreground">Arrastra la imagen para moverla, cada esquina para estirarla sola y ⟳ para girarla.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!userId || busy} onClick={save}><Save />{busy ? 'Guardando…' : 'Guardar'}</Button>
        <Button variant="outline" size="icon" title="Restablecer posición" aria-label="Restablecer posición" onClick={() => { const b = initialBounds(target.lat,target.lon); onChange({ ...value, bounds: b, corners: cornersFromBounds(b) }); }}><RotateCcw /></Button>
        {[-1, -0.1, 0.1, 1].map(deg => <Button key={deg} variant="outline" size="sm" title={`Girar ${deg}°`} onClick={() => { const c = rotateCorners(value.corners ?? cornersFromBounds(value.bounds), deg); onChange({ ...value, corners: c, bounds: boundsOfCorners(c) }); }}>{deg < 0 ? <RotateCcw /> : <RotateCw />}{Math.abs(deg)}°</Button>)}
        {saved && <Button variant="ghost" size="sm" onClick={() => images && onChange({ ...value, corners: saved, bounds: boundsOfCorners(saved), image: images.echoes, editing: false })}>Cancelar</Button>}
      </div>
      {!userId && ready && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => signIn('google')}>Google · Guardar</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => signIn('lovable')}>Lovable · Guardar</Button></div>}
    </>}
    {saved && !value?.editing && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { setVisible(true); if (images) onChange({ code: target.code, corners: saved, bounds: boundsOfCorners(saved), image: images.original, editing: true, opacity: 0.5 }); }}><Pencil />Ajustar</Button><Button variant="ghost" size="sm" onClick={() => { setVisible(v => !v); if (visible) onChange(null); }}><EyeOff />{visible ? 'Ocultar' : 'Mostrar'}</Button></div>}
  </aside>;
}