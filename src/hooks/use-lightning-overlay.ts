import { useEffect } from "react";
import L from "leaflet";
import { quadMatrix } from "@/lib/aemet-overlay";
import { LIGHTNING_CORNERS, LIGHTNING_SIZE } from "@/lib/aemet-lightning";

/** Draws the AEMET lightning map as a static quadrilateral above radar echoes. */
export function useLightningOverlay(mapRef: { current: L.Map | null }, image: string | null) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !image) return;
    const img = L.DomUtil.create("img", "leaflet-zoom-hide lightning-overlay") as HTMLImageElement;
    img.src = image;
    img.draggable = false;
    Object.assign(img.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${LIGHTNING_SIZE.w}px`,
      height: `${LIGHTNING_SIZE.h}px`,
      maxWidth: "none",
      maxHeight: "none",
      transformOrigin: "0 0",
      zIndex: "460",
      pointerEvents: "none",
    });
    map.getPanes().overlayPane.appendChild(img);

    const sync = () => {
      const px = LIGHTNING_CORNERS.map((p) => map.latLngToLayerPoint(p));
      img.style.transform = `matrix3d(${quadMatrix(LIGHTNING_SIZE.w, LIGHTNING_SIZE.h, px.map((p) => [p.x, p.y])).join(",")})`;
    };
    sync();
    map.on("zoom move viewreset", sync);
    return () => {
      map.off("zoom move viewreset", sync);
      img.remove();
    };
  }, [mapRef, image]);
}
