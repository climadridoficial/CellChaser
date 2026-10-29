import { useQuery } from "@tanstack/react-query";
import { getSharedStormTracks } from "@/lib/storm-results.functions";
import type { RadarStation } from "@/lib/ord";
import type { CompositeMode } from "@/lib/composite";
import { useRadarNow } from "./use-radar-now";
import { stormTargets, stormSource } from "@/lib/storm-selection";

export function useStormTracks(enabled: boolean, selectedId: string | null, stations: RadarStation[], at: number | null, mode: CompositeMode) {
  const now = useRadarNow();
  const radarIds = stormTargets(stations,selectedId), source = stormSource(mode);
  const query = useQuery({
    queryKey:["shared-storm-tracks",radarIds,source,at,at===null?Math.floor(now/30_000):0],
    enabled:enabled && radarIds.length>0,
    staleTime:30_000,
    refetchInterval:at===null?30_000:false,
    queryFn:()=>getSharedStormTracks({data:{radarIds,at,source}}),
  });
  return {tracks:enabled&&!query.isError?query.data?.tracks??[]:[],loading:enabled&&query.isFetching,incomplete:query.isError||query.data?.incomplete===true,supported:radarIds.length>0};
}