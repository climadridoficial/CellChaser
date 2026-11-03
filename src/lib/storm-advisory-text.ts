import { translate, type Lang, type MessageKey } from './i18n';
import type { StormTrack } from './storm-tracking';

const intensityKeys: Record<StormTrack['intensity'],MessageKey>={light:'stormLight',strong:'stormStrong',veryStrong:'stormVeryStrong',extreme:'stormExtreme'};
/** Same saved facts + language always produce the same text, without model calls. */
export function stormAdvisoryText(track:StormTrack,lang:Lang):string[] {
  const last=track.points.at(-1), a=track.advisory;
  if(!last) return [];
  const t=(key:MessageKey,vars:Record<string,string|number>={})=>translate(lang,key,vars);
  const lines=[t('stormAdvisory'),track.forecast?t('stormMotion',{intensity:t(intensityKeys[track.intensity]),dbz:Math.round(last.dbz),speed:track.speedKmh}):t('stormWaiting')];
  const v=a?.vrad;
  lines.push(v?.status==='available'?t('stormVradAvailable',{v:v.medianMs??0,coverage:v.coverage}):v?.status==='outOfRange'?t('stormVradOutside'):v?.status==='insufficient'?t('stormVradPoor',{coverage:v.coverage}):t('stormDbzOnly'));
  if (a && v?.status==='available' && v.observedAt !== undefined) lines.push(t('stormVradEarlier',{time:new Date(v.observedAt).toISOString().slice(11,16),minutes:Math.round((a.observedAt-v.observedAt)/60_000)}));
  const lightning=a?.lightning;
  const stamp=(time:number)=>new Date(time).toISOString().slice(5,16).replace('T',' ');
  lines.push(lightning?.interval && lightning.status!=='unknown'?t(lightning.status==='nearby'?'stormLightningNearby':'stormLightningNone',{interval:`${stamp(lightning.interval.start)}–${stamp(lightning.interval.end)}`}):t('stormLightningUnknown'));
  lines.push(t('stormDisclaimer'));
  return lines;
}