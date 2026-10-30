import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { cornersFromBounds, quadMatrix, type AemetMapImage, type Corners } from '@/lib/aemet-overlay';

const W = 480, H = 460;
const cornersOf = (v: AemetMapImage): Corners => v.corners ?? cornersFromBounds(v.bounds);

/** Draws the AEMET image as a free quadrilateral (4 independent corners) with drag, per-corner stretch and rotation. */
export function useAemetMapOverlay(mapRef: { current: L.Map | null }, value: AemetMapImage | null, onCorners: (corners: Corners) => void) {
  const valueRef = useRef(value);
  const handlerRef = useRef(onCorners);
  const syncRef = useRef<(() => void) | null>(null);
  valueRef.current = value;
  handlerRef.current = onCorners;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    const editing = value.editing;
    const img = L.DomUtil.create('img', `leaflet-zoom-hide radar-overlay ${editing ? 'aemet-align-image' : 'aemet-echo-image'}`) as HTMLImageElement;
    img.src = value.image;
    img.draggable = false;
    Object.assign(img.style, { position: 'absolute', left: '0', top: '0', width: `${W}px`, height: `${H}px`, transformOrigin: '0 0', zIndex: '450', pointerEvents: editing ? 'auto' : 'none', touchAction: 'none' });
    map.getPanes().overlayPane.appendChild(img);

    const border = editing ? L.polygon([], { className: 'aemet-align-border', fill: false, interactive: false, weight: 2, noClip: true, smoothFactor: 0 } as L.PolylineOptions).addTo(map) : null;
    const corners: L.Marker[] = [];
    let rotator: L.Marker | null = null;
    const toPx = (c: Corners) => c.map(p => map.latLngToLayerPoint(p));
    const toLL = (pts: L.Point[]) => pts.map(p => { const l = map.layerPointToLatLng(p); return [l.lat, l.lng]; }) as Corners;
    const rotatorPos = (c: Corners) => {
      const px = toPx(c);
      const mid = px[0]!.add(px[1]!).divideBy(2);
      const centre = px.reduce((a, b) => a.add(b), L.point(0, 0)).divideBy(4);
      const dir = mid.subtract(centre);
      const len = Math.hypot(dir.x, dir.y) || 1;
      return map.layerPointToLatLng(mid.add(dir.multiplyBy(45 / len)));
    };

    const sync = () => {
      const v = valueRef.current;
      if (!v) return;
      const c = cornersOf(v);
      const px = toPx(c);
      img.style.transform = `matrix3d(${quadMatrix(W, H, px.map(p => [p.x, p.y])).join(',')})`;
      img.style.opacity = String(v.editing ? v.opacity : 0.85);
      border?.setLatLngs(c);
      corners.forEach((m, i) => m.setLatLng(c[i]!));
      rotator?.setLatLng(rotatorPos(c));
    };
    syncRef.current = sync;

    let endDrag: (() => void) | null = null;
    const down = (event: PointerEvent) => {
      const v = valueRef.current;
      if (!v?.editing) return;
      event.preventDefault();
      event.stopPropagation();
      const start = map.mouseEventToContainerPoint(event);
      const startPx = toPx(cornersOf(v));
      const wasDragging = map.dragging.enabled();
      map.dragging.disable();
      const move = (e: PointerEvent) => {
        if (e.pointerId !== event.pointerId) return;
        const delta = map.mouseEventToContainerPoint(e).subtract(start);
        handlerRef.current(toLL(startPx.map(p => p.add(delta))));
      };
      const finish = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        if (wasDragging) map.dragging.enable();
        endDrag = null;
      };
      endDrag = finish;
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    };
    img.addEventListener('pointerdown', down);

    if (editing) {
      const c0 = cornersOf(value);
      c0.forEach((position, index) => {
        const marker = L.marker(position, { draggable: true, zIndexOffset: 2000, icon: L.divIcon({
          className: 'aemet-corner', html: `<span role="img" aria-label="Esquina ${index + 1}" title="Estirar esquina"></span>`, iconSize: [28, 28], iconAnchor: [14, 14],
        }) }).addTo(map);
        marker.on('drag', () => {
          const v = valueRef.current;
          if (!v) return;
          const next = [...cornersOf(v)] as Corners;
          const l = marker.getLatLng();
          next[index] = [l.lat, l.lng];
          handlerRef.current(next);
        });
        corners.push(marker);
      });
      rotator = L.marker(rotatorPos(c0), { draggable: true, zIndexOffset: 2100, icon: L.divIcon({
        className: 'aemet-rotate', html: '<span role="img" aria-label="Girar" title="Girar">⟳</span>', iconSize: [30, 30], iconAnchor: [15, 15],
      }) }).addTo(map);
      let startPx: L.Point[] = [], centre = L.point(0, 0), startAngle = 0;
      rotator.on('dragstart', () => {
        const v = valueRef.current;
        if (!v) return;
        startPx = toPx(cornersOf(v));
        centre = startPx.reduce((a, b) => a.add(b), L.point(0, 0)).divideBy(4);
        const p = map.latLngToLayerPoint(rotator!.getLatLng());
        startAngle = Math.atan2(p.y - centre.y, p.x - centre.x);
      });
      rotator.on('drag', () => {
        if (!startPx.length) return;
        const p = map.latLngToLayerPoint(rotator!.getLatLng());
        const a = Math.atan2(p.y - centre.y, p.x - centre.x) - startAngle;
        const cos = Math.cos(a), sin = Math.sin(a);
        handlerRef.current(toLL(startPx.map(q => {
          const dx = q.x - centre.x, dy = q.y - centre.y;
          return L.point(centre.x + dx * cos - dy * sin, centre.y + dx * sin + dy * cos);
        })));
      });
      rotator.on('dragend', () => { startPx = []; sync(); });
      map.fitBounds(L.latLngBounds(c0), { paddingTopLeft: [35, 95], paddingBottomRight: [35, 130], animate: false });
    }
    sync();
    map.on('zoomend viewreset resize', sync);
    return () => {
      map.off('zoomend viewreset resize', sync);
      endDrag?.();
      img.removeEventListener('pointerdown', down);
      img.remove();
      border?.remove();
      corners.forEach(c => c.remove());
      rotator?.remove();
      syncRef.current = null;
    };
    // Corners and opacity update in place, never recreate during a drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.code, value?.image, value?.editing, mapRef]);

  useEffect(() => { syncRef.current?.(); }, [value]);
}

/** Rotates a quadrilateral by `degrees` around its centre in map pixel space. */
export function rotateCorners(map: L.Map, c: Corners, degrees: number): Corners {
  const px = c.map(p => map.latLngToLayerPoint(p));
  const centre = px.reduce((a, b) => a.add(b), L.point(0, 0)).divideBy(4);
  const r = degrees * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
  return px.map(q => {
    const dx = q.x - centre.x, dy = q.y - centre.y;
    const l = map.layerPointToLatLng(L.point(centre.x + dx * cos - dy * sin, centre.y + dx * sin + dy * cos));
    return [l.lat, l.lng];
  }) as Corners;
}
