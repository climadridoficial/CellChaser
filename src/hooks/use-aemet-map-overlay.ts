import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { AemetMapImage, RadarBounds } from '@/lib/aemet-overlay';

export function useAemetMapOverlay(mapRef: { current: L.Map | null }, value: AemetMapImage | null, onBounds: (bounds: RadarBounds) => void) {
  const imageRef = useRef<L.ImageOverlay | null>(null);
  const cornersRef = useRef<L.Marker[]>([]);
  const rectangleRef = useRef<L.Rectangle | null>(null);
  const valueRef = useRef(value);
  const handlerRef = useRef(onBounds);
  valueRef.current = value;
  handlerRef.current = onBounds;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    const image = L.imageOverlay(value.image, value.bounds, {
      opacity: value.editing ? value.opacity : 0.85,
      interactive: value.editing,
      zIndex: 450,
      className: value.editing ? 'radar-overlay aemet-align-image' : 'radar-overlay aemet-echo-image',
    }).addTo(map);
    imageRef.current = image;
    let endDrag: (() => void) | null = null;
    const element = image.getElement();
    const down = (event: PointerEvent) => {
      if (!valueRef.current?.editing || !element) return;
      event.preventDefault();
      event.stopPropagation();
      const start = map.mouseEventToContainerPoint(event);
      const bounds = image.getBounds();
      const nw = map.latLngToContainerPoint(bounds.getNorthWest());
      const se = map.latLngToContainerPoint(bounds.getSouthEast());
      const wasDragging = map.dragging.enabled();
      map.dragging.disable();
      const move = (e: PointerEvent) => {
        if (e.pointerId !== event.pointerId) return;
        const delta = map.mouseEventToContainerPoint(e).subtract(start);
        const a = map.containerPointToLatLng(nw.add(delta));
        const b = map.containerPointToLatLng(se.add(delta));
        handlerRef.current([[b.lat, a.lng], [a.lat, b.lng]]);
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
    element?.addEventListener('pointerdown', down);
    if (value.editing) {
      rectangleRef.current = L.rectangle(value.bounds, { className: 'aemet-align-border', fill: false, interactive: false, weight: 2 }).addTo(map);
      const b = L.latLngBounds(value.bounds);
      const positions = [b.getNorthWest(), b.getNorthEast(), b.getSouthEast(), b.getSouthWest()];
      cornersRef.current = positions.map((position, index) => {
        const marker = L.marker(position, { draggable: true, zIndexOffset: 2000, icon: L.divIcon({
          className: 'aemet-corner', html: `<span role="img" aria-label="Esquina ${index + 1}" title="Redimensionar"></span>`, iconSize: [24,24], iconAnchor: [12,12],
        }) }).addTo(map);
        let opposite: L.LatLng | null = null;
        marker.on('dragstart', () => {
          const current = image.getBounds();
          opposite = [current.getSouthEast(), current.getSouthWest(), current.getNorthWest(), current.getNorthEast()][index] ?? null;
        });
        marker.on('drag', () => {
          if (!opposite) return;
          const next = L.latLngBounds(marker.getLatLng(), opposite);
          if (Math.abs(next.getNorth() - next.getSouth()) < 0.05 || Math.abs(next.getEast() - next.getWest()) < 0.05) return;
          handlerRef.current([[next.getSouth(),next.getWest()],[next.getNorth(),next.getEast()]]);
        });
        return marker;
      });
      map.fitBounds(value.bounds, { paddingTopLeft: [35, 95], paddingBottomRight: [35, 130], animate: false });
    }
    return () => {
      endDrag?.();
      element?.removeEventListener('pointerdown', down);
      image.remove();
      imageRef.current = null;
      rectangleRef.current?.remove();
      rectangleRef.current = null;
      cornersRef.current.forEach(c => c.remove());
      cornersRef.current = [];
    };
    // Bounds and opacity update in place, never recreate during a drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.code, value?.image, value?.editing, mapRef]);

  useEffect(() => {
    if (!value) return;
    const b = L.latLngBounds(value.bounds);
    imageRef.current?.setBounds(b).setOpacity(value.editing ? value.opacity : 0.85);
    rectangleRef.current?.setBounds(b);
    const positions = [b.getNorthWest(), b.getNorthEast(), b.getSouthEast(), b.getSouthWest()];
    cornersRef.current.forEach((marker, i) => {
      const position = positions[i];
      if (position) marker.setLatLng(position);
    });
  }, [value]);
}