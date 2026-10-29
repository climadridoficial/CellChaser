import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export const LANGUAGES = [
  { id: "es", label: "Español", locale: "es-ES" },
  { id: "pt", label: "Português", locale: "pt-PT" },
  { id: "ca", label: "Català", locale: "ca-ES" },
  { id: "gl", label: "Galego", locale: "gl-ES" },
  { id: "eu", label: "Euskara", locale: "eu-ES" },
  { id: "en", label: "English", locale: "en-GB" },
] as const;
export type Lang = (typeof LANGUAGES)[number]["id"];

type Row = Record<Lang, string>;
const r = (es: string, pt: string, ca: string, gl: string, eu: string, en: string): Row => ({ es, pt, ca, gl, eu, en });

export const MESSAGES = {
  language: r("Idioma", "Idioma", "Idioma", "Idioma", "Hizkuntza", "Language"),
  layers: r("Capas", "Camadas", "Capes", "Capas", "Geruzak", "Layers"),
  composite: r("Compuesto radares España", "Composição de radares de Espanha", "Compost de radars d'Espanya", "Composto de radares de España", "Espainiako radar konposatua", "Spain radar composite"),
  modeOpendata: r("Solo AEMET OpenData", "Só AEMET OpenData", "Només AEMET OpenData", "Só AEMET OpenData", "AEMET OpenData soilik", "AEMET OpenData only"),
  noteOpendata: r("Los 15 radares de AEMET, cada 10 min.", "Os 15 radares da AEMET, a cada 10 min.", "Els 15 radars d'AEMET, cada 10 min.", "Os 15 radares da AEMET, cada 10 min.", "AEMETen 15 radarrak, 10 minuturo.", "All 15 AEMET radars, every 10 min."),
  modeFallback: r("OPERA y si no, OpenData", "OPERA; se não, OpenData", "OPERA i, si no, OpenData", "OPERA e, se non, OpenData", "OPERA, bestela OpenData", "OPERA, otherwise OpenData"),
  noteFallback: r("Datos brutos de OPERA; AEMET si el radar no transmite.", "Dados brutos OPERA; AEMET se o radar não transmitir.", "Dades brutes d'OPERA; AEMET si el radar no transmet.", "Datos brutos de OPERA; AEMET se o radar non transmite.", "OPERAren datu gordinak; AEMET radarrak transmititzen ez badu.", "Raw OPERA data; AEMET if the radar is not transmitting."),
  modeOpera: r("Solo OPERA", "Só OPERA", "Només OPERA", "Só OPERA", "OPERA soilik", "OPERA only"),
  noteOpera: r("Solo radares que transmiten a OPERA.", "Só radares que transmitem para a OPERA.", "Només radars que transmeten a OPERA.", "Só radares que transmiten a OPERA.", "OPERAra transmititzen duten radarrak soilik.", "Only radars transmitting to OPERA."),
  off: r("Apagado", "Desligado", "Desactivat", "Apagado", "Itzalita", "Off"),
  noteOff: r("Muestra la capa de mosaicos elegida.", "Mostra a camada de mosaicos escolhida.", "Mostra la capa de mosaics triada.", "Mostra a capa de mosaicos escollida.", "Aukeratutako lauza-geruza erakusten du.", "Shows the selected tile layer."),
  loadingRadars: r("Cargando radares…", "A carregar radares…", "Carregant radars…", "Cargando radares…", "Radarrak kargatzen…", "Loading radars…"),
  updating: r("actualizando…", "a atualizar…", "actualitzant…", "actualizando…", "eguneratzen…", "updating…"),
  tileLayer: r("Capa de mosaicos", "Camada de mosaicos", "Capa de mosaics", "Capa de mosaicos", "Lauza-geruza", "Tile layer"),
  tileHidden: r("Oculta mientras el compuesto está activo.", "Oculta enquanto a composição estiver ativa.", "Amagada mentre el compost és actiu.", "Oculta mentres o composto está activo.", "Ezkutatuta konposatua aktibo dagoen bitartean.", "Hidden while the composite is active."),
  rainviewer: r("Mosaicos RainViewer", "Mosaicos RainViewer", "Mosaics RainViewer", "Mosaicos RainViewer", "RainViewer lauzak", "RainViewer tiles"),
  rainviewerNote: r("Alternativa rápida: reflectividad, solo azul (gratis).", "Alternativa rápida: refletividade, só azul (grátis).", "Alternativa ràpida: reflectivitat, només blau (gratuït).", "Alternativa rápida: reflectividade, só azul (gratis).", "Ordezko azkarra: islagarritasuna, urdina soilik (doan).", "Fast fallback — reflectivity, blue only (free)."),
  librewxr: r("Mosaicos LibreWXR", "Mosaicos LibreWXR", "Mosaics LibreWXR", "Mosaicos LibreWXR", "LibreWXR lauzak", "LibreWXR tiles"),
  librewxrNote: r("Datos OPERA, todos los colores y zooms. Sin configurar.", "Dados OPERA, todas as cores e zooms. Sem configuração.", "Dades OPERA, tots els colors i zooms. Sense configurar.", "Datos OPERA, todas as cores e zooms. Sen configurar.", "OPERA datuak, kolore eta zoom guztiak. Konfiguratu gabe.", "OPERA-fed, all colours and zooms. No setup needed."),
  noTiles: r("Sin capa de mosaicos", "Sem camada de mosaicos", "Sense capa de mosaics", "Sen capa de mosaicos", "Lauza-geruzarik ez", "No tile layer"),
  baseOnly: r("Solo mapa base.", "Só mapa base.", "Només mapa base.", "Só mapa base.", "Oinarrizko mapa soilik.", "Base map only."),
  overlays: r("Superposiciones", "Sobreposições", "Superposicions", "Superposicións", "Gainjarriak", "Overlays"),
  operaStations: r("Estaciones OPERA brutas", "Estações OPERA brutas", "Estacions OPERA brutes", "Estacións OPERA brutas", "OPERA estazio gordinak", "OPERA raw stations"),
  stationsInspect: r("{n} estaciones · pulsa para ver", "{n} estações · toque para ver", "{n} estacions · toca per veure", "{n} estacións · preme para ver", "{n} estazio · sakatu ikusteko", "{n} stations · click to inspect"),
  aemetStations: r("Estaciones meteorológicas AEMET", "Estações meteorológicas AEMET", "Estacions meteorològiques AEMET", "Estacións meteorolóxicas AEMET", "AEMET estazio meteorologikoak", "AEMET weather stations"),
  aemetDefault: r("Temperatura, viento, lluvia y presión", "Temperatura, vento, chuva e pressão", "Temperatura, vent, pluja i pressió", "Temperatura, vento, choiva e presión", "Tenperatura, haizea, euria eta presioa", "Live temp, wind, rain, pressure"),
  aemetCount: r("{n} estaciones · cada hora", "{n} estações · a cada hora", "{n} estacions · cada hora", "{n} estacións · cada hora", "{n} estazio · orduro", "{n} stations · updates hourly"),
  loading: r("Cargando…", "A carregar…", "Carregant…", "Cargando…", "Kargatzen…", "Loading…"),
  settings: r("Ajustes", "Definições", "Configuració", "Axustes", "Ezarpenak", "Settings"),
  done: r("Hecho", "Concluído", "Fet", "Feito", "Eginda", "Done"),
  close: r("Cerrar", "Fechar", "Tanca", "Pechar", "Itxi", "Close"),
  now: r("Ahora", "Agora", "Ara", "Agora", "Orain", "Now"),
  live: r("En directo", "Em direto", "En directe", "En directo", "Zuzenean", "Live"),
  every: r("cada {n} min", "a cada {n} min", "cada {n} min", "cada {n} min", "{n} minuturo", "every {n} min"),
  ago: r("hace {t}", "há {t}", "fa {t}", "hai {t}", "duela {t}", "{t} ago"),
  timeline: r("Línea de tiempo del radar", "Linha temporal do radar", "Línia temporal del radar", "Liña temporal do radar", "Radarraren denbora-lerroa", "Radar timeline"),
  play: r("Reproducir las últimas horas", "Reproduzir as últimas horas", "Reprodueix les darreres hores", "Reproducir as últimas horas", "Azken orduak erreproduzitu", "Play recent hours"),
  pause: r("Pausar animación", "Pausar animação", "Pausa l'animació", "Pausar animación", "Animazioa pausatu", "Pause animation"),
  radarTime: r("Hora del radar", "Hora do radar", "Hora del radar", "Hora do radar", "Radarraren ordua", "Radar time"),
  product: r("Producto", "Produto", "Producte", "Produto", "Produktua", "Product"),
  elevation: r("Elevación", "Elevação", "Elevació", "Elevación", "Altuera", "Elevation"),
  timeRange: r("Intervalo", "Intervalo", "Interval", "Intervalo", "Tartea", "Time range"),
  scanTime: r("Hora del escaneo", "Hora da varredura", "Hora de l'escaneig", "Hora do escaneo", "Eskaneatze ordua", "Scan time"),
  backupWarning: r("⚠️ Usando datos de respaldo de AEMET: este radar no está transmitiendo a OPERA (posiblemente en renovación). Reflectividad (dBZ), actualizada cada 10 min.", "⚠️ A usar dados de reserva da AEMET: este radar não está a transmitir para a OPERA (possivelmente em renovação). Refletividade (dBZ), atualizada a cada 10 min.", "⚠️ S'utilitzen dades de reserva d'AEMET: aquest radar no transmet a OPERA (possiblement en renovació). Reflectivitat (dBZ), actualitzada cada 10 min.", "⚠️ Usando datos de reserva da AEMET: este radar non transmite a OPERA (posiblemente en renovación). Reflectividade (dBZ), actualizada cada 10 min.", "⚠️ AEMETen ordezko datuak erabiltzen: radar hau ez dago OPERAra transmititzen (agian berritzen). Islagarritasuna (dBZ), 10 minuturo eguneratua.", "⚠️ Using AEMET backup data: this radar is not transmitting to OPERA (possibly being renewed). Reflectivity (dBZ), updated every 10 min."),
  noCurrent: r("No hay datos actuales. Las imágenes anteriores solo están disponibles en el historial.", "Não há dados atuais. As imagens anteriores só estão disponíveis no histórico.", "No hi ha dades actuals. Les imatges anteriors només són a l'historial.", "Non hai datos actuais. As imaxes anteriores só están no historial.", "Ez dago egungo daturik. Aurreko irudiak historian soilik daude.", "No current data. Earlier images are available only in history."),
  weatherStation: r("Estación meteorológica AEMET", "Estação meteorológica AEMET", "Estació meteorològica AEMET", "Estación meteorolóxica AEMET", "AEMET estazio meteorologikoa", "AEMET weather station"),
  temperature: r("Temperatura", "Temperatura", "Temperatura", "Temperatura", "Tenperatura", "Temperature"),
  humidity: r("Humedad", "Humidade", "Humitat", "Humidade", "Hezetasuna", "Humidity"),
  rain: r("Lluvia (1 h)", "Chuva (1 h)", "Pluja (1 h)", "Choiva (1 h)", "Euria (1 h)", "Rain (1 h)"),
  wind: r("Viento", "Vento", "Vent", "Vento", "Haizea", "Wind"),
  gust: r("Racha", "Rajada", "Ratxa", "Refacho", "Bolada", "Gust"),
  pressure: r("Presión", "Pressão", "Pressió", "Presión", "Presioa", "Pressure"),
  mapFailed: r("No se pudo cargar el mapa.", "Não foi possível carregar o mapa.", "No s'ha pogut carregar el mapa.", "Non se puido cargar o mapa.", "Ezin izan da mapa kargatu.", "The map could not load."),
  reloadMap: r("Recargar mapa", "Recarregar mapa", "Torna a carregar el mapa", "Recargar mapa", "Mapa berriro kargatu", "Reload map"),
} satisfies Record<string, Row>;
export type MessageKey = keyof typeof MESSAGES;

export function translate(lang: Lang, key: MessageKey, vars: Record<string, string | number> = {}): string {
  return MESSAGES[key][lang].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}

const STORAGE_KEY = "radares-language";
const LanguageContext = createContext<{ lang: Lang; locale: string; setLang: (lang: Lang) => void; t: (key: MessageKey, vars?: Record<string, string | number>) => string }>({
  lang: "es", locale: "es-ES", setLang: () => {}, t: (key, vars) => translate("es", key, vars),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.id === saved)) setLangState(saved as Lang);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);
  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const locale = LANGUAGES.find((l) => l.id === lang)!.locale;
  return <LanguageContext.Provider value={{ lang, locale, setLang, t }}>{children}</LanguageContext.Provider>;
}

export const useI18n = () => useContext(LanguageContext);