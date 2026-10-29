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
  stormTracks: r("Movimiento de células", "Movimento das células", "Moviment de cèl·lules", "Movemento das células", "Zelulen mugimendua", "Cell movement"),
  stormForecast: r("Previsión experimental · 30 min", "Previsão experimental · 30 min", "Previsió experimental · 30 min", "Previsión experimental · 30 min", "Iragarpen esperimentala · 30 min", "Experimental forecast · 30 min"),
  stormDisclaimer: r("Estimación por reflectividad; no es un aviso oficial. AEMET: posición e intensidad aproximadas.", "Estimativa por refletividade; não é um aviso oficial. AEMET: posição e intensidade aproximadas.", "Estimació per reflectivitat; no és un avís oficial. AEMET: posició i intensitat aproximades.", "Estimación por reflectividade; non é un aviso oficial. AEMET: posición e intensidade aproximadas.", "Islagarritasunaren araberako estimazioa; ez da abisu ofiziala. AEMET: gutxi gorabeherako kokapena eta intentsitatea.", "Reflectivity estimate, not an official warning. AEMET position and intensity are approximate."),
  stormLight: r("Ligera", "Ligeira", "Lleugera", "Lixeira", "Arina", "Light"),
  stormStrong: r("Fuerte", "Forte", "Forta", "Forte", "Indartsua", "Strong"),
  stormVeryStrong: r("Muy fuerte", "Muito forte", "Molt forta", "Moi forte", "Oso indartsua", "Very strong"),
  stormExtreme: r("Extrema", "Extrema", "Extrema", "Extrema", "Muturrekoa", "Extreme"),
  stormWaiting: r("Se necesitan dos escaneos para estimar movimiento", "São necessárias duas varreduras para estimar movimento", "Calen dos escaneigs per estimar moviment", "Precísanse dous escaneos para estimar movemento", "Bi eskaneatze behar dira mugimendua kalkulatzeko", "Two scans needed to estimate movement"),
  stormNone: r("Sin células detectadas", "Sem células detetadas", "Sense cèl·lules detectades", "Sen células detectadas", "Ez da zelularik hauteman", "No cells detected"),
  stormUnsupported: r("Sin reflectividad disponible; selecciona DBZH o un compuesto", "Sem refletividade disponível; selecione DBZH ou uma composição", "Sense reflectivitat disponible; selecciona DBZH o un compost", "Sen reflectividade dispoñible; selecciona DBZH ou un composto", "Islagarritasunik ez; hautatu DBZH edo konposatua", "No reflectivity available; select DBZH or a composite"),
  stormPartial: r("Faltan escaneos; seguimiento incompleto", "Faltam varreduras; seguimento incompleto", "Falten escaneigs; seguiment incomplet", "Faltan escaneos; seguimento incompleto", "Eskaneatzeak falta dira; jarraipen osatugabea", "Missing scans; incomplete tracking"),
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
  baseUrl: r("URL base LibreWXR", "URL base LibreWXR", "URL base LibreWXR", "URL base LibreWXR", "LibreWXR oinarrizko URLa", "LibreWXR base URL"),
  baseHelp: r("Se usa api.librewxr.net por defecto, sin clave. Cambia esto solo si tienes tu propio servidor LibreWXR.", "Usa-se api.librewxr.net por padrão, sem chave. Altere apenas se tiver o seu próprio servidor LibreWXR.", "S’utilitza api.librewxr.net per defecte, sense clau. Canvia-ho només si tens un servidor LibreWXR propi.", "Úsase api.librewxr.net por defecto, sen clave. Cambia isto só se tes o teu propio servidor LibreWXR.", "api.librewxr.net erabiltzen da lehenespenez, gakorik gabe. Aldatu zure LibreWXR zerbitzaria baduzu soilik.", "Uses api.librewxr.net by default, with no key. Change only for your own LibreWXR server."),
  optionalKey: r("Clave {name} (opcional)", "Chave {name} (opcional)", "Clau {name} (opcional)", "Clave {name} (opcional)", "{name} gakoa (aukerakoa)", "{name} key (optional)"),
  noKey: r("No necesaria: acceso anónimo", "Não necessária: acesso anónimo", "No cal: accés anònim", "Non necesaria: acceso anónimo", "Ez da behar: sarbide anonimoa", "Not required — anonymous access"),
  keyHelp: r("OPERA permite acceso sin clave con límites. La clave se guarda solo en este navegador.", "OPERA permite acesso sem chave, com limites. A chave fica apenas neste navegador.", "OPERA permet accés sense clau, amb límits. La clau es desa només en aquest navegador.", "OPERA permite acceso sen clave, con límites. A clave gárdase só neste navegador.", "OPERA gakorik gabe erabil daiteke, mugekin. Gakoa nabigatzaile honetan soilik gordetzen da.", "OPERA allows key-free access with limits. The key is stored only in this browser."),
  builtIn: r("Opcional: se usan claves integradas", "Opcional: usam-se chaves integradas", "Opcional: s’utilitzen claus integrades", "Opcional: úsanse claves integradas", "Aukerakoa: gako integratuak erabiltzen dira", "Optional — built-in keys are used"),
  aemetHelp: r("Las claves integradas ya funcionan. Añade la tuya para ampliar los límites; se guarda solo en este navegador. Gratis en", "As chaves integradas já funcionam. Adicione a sua para aumentar os limites; fica apenas neste navegador. Grátis em", "Les claus integrades ja funcionen. Afegeix la teva per ampliar els límits; es desa només en aquest navegador. Gratuïta a", "As claves integradas xa funcionan. Engade a túa para ampliar os límites; gárdase só neste navegador. Gratis en", "Gako integratuek funtzionatzen dute. Gehitu zurea mugak handitzeko; nabigatzaile honetan soilik gordetzen da. Doan hemen", "Built-in keys work already. Add yours for higher limits; stored only in this browser. Free at"),
  country: r("País de los radares", "País dos radares", "País dels radars", "País dos radares", "Radarren herrialdea", "Radar station country"),
  allStations: r("Todas las estaciones europeas", "Todas as estações europeias", "Totes les estacions europees", "Todas as estacións europeas", "Europako estazio guztiak", "All European stations"),
  minmax: r("Mín. / máx.", "Mín. / máx.", "Mín. / màx.", "Mín. / máx.", "Gutx. / geh.", "Min / max"),
  dew: r("Punto de rocío", "Ponto de orvalho", "Punt de rosada", "Punto de orballo", "Ihintz-puntua", "Dew point"),
  visibility: r("Visibilidad", "Visibilidade", "Visibilitat", "Visibilidade", "Ikuspena", "Visibility"),
  altitude: r("Altitud", "Altitude", "Altitud", "Altitude", "Altitudea", "Altitude"),
  range: r("Alcance", "Alcance", "Abast", "Alcance", "Irismena", "Range"),
  observed: r("Observado", "Observado", "Observat", "Observado", "Behatua", "Observed"),
  latest: r("último", "último", "darrer", "último", "azkena", "latest"),
  lastHours: r("Últimas {h}", "Últimas {h}", "Darreres {h}", "Últimas {h}", "Azken {h}", "Last {h}"),
  noProducts: r("No hay productos publicados para este radar.", "Não há produtos publicados para este radar.", "No hi ha productes publicats per a aquest radar.", "Non hai produtos publicados para este radar.", "Ez dago radar honetarako produkturik argitaratuta.", "No products published for this radar."),
  notPublished: r("No publicado: {p}", "Não publicado: {p}", "No publicat: {p}", "Non publicado: {p}", "Argitaratu gabe: {p}", "Not published: {p}"),
  queryProducts: r("Consultando productos…", "A consultar produtos…", "Consultant productes…", "Consultando produtos…", "Produktuak kontsultatzen…", "Querying products…"),
  queryScans: r("Buscando escaneos…", "A procurar varreduras…", "Cercant escaneigs…", "Buscando escaneos…", "Eskaneatzeak bilatzen…", "Looking up scans…"),
  decode: r("Procesando escaneo…", "A processar varredura…", "Processant escaneig…", "Procesando escaneo…", "Eskaneatzea prozesatzen…", "Processing scan…"),
  noScans: r("No hay escaneos en este intervalo.", "Não há varreduras neste intervalo.", "No hi ha escaneigs en aquest interval.", "Non hai escaneos neste intervalo.", "Ez dago eskaneatzerik tarte honetan.", "No scans in this time range."),
  expand: r("Expandir", "Expandir", "Amplia", "Expandir", "Zabaldu", "Expand"),
  collapse: r("Contraer", "Recolher", "Contrau", "Contraer", "Tolestu", "Collapse"),
  noOpera: r("AEMET (sin OPERA)", "AEMET (sem OPERA)", "AEMET (sense OPERA)", "AEMET (sen OPERA)", "AEMET (OPERA gabe)", "AEMET (no OPERA)"),
  noSaved: r("Sin imágenes guardadas para esa hora", "Sem imagens guardadas para essa hora", "Sense imatges desades per a aquesta hora", "Sen imaxes gardadas para esa hora", "Ez dago gordetako irudirik ordu horretarako", "No saved images for that time"),
  aemetError: r("No se pudo cargar AEMET. Se reintentará en 10 min.", "Não foi possível carregar AEMET. Nova tentativa em 10 min.", "No s’ha pogut carregar AEMET. Es reintentarà en 10 min.", "Non se puido cargar AEMET. Reintentarase en 10 min.", "Ezin izan da AEMET kargatu. 10 minutu barru berriro saiatuko da.", "Could not load AEMET. Retrying in 10 min."),
  imageAt: r("Imagen de las {time}", "Imagem das {time}", "Imatge de les {time}", "Imaxe das {time}", "{time} orduko irudia", "Image at {time}"),
  aemetImage: r("Reflectividad del radar AEMET", "Refletividade do radar AEMET", "Reflectivitat del radar AEMET", "Reflectividade do radar AEMET", "AEMET radarraren islagarritasuna", "AEMET radar reflectivity"),
  locationOn: r("Ubicación activada (modo brújula)", "Localização ativa (modo bússola)", "Ubicació activa (mode brúixola)", "Localización activa (modo compás)", "Kokapena aktibatuta (iparrorratz modua)", "Location on (switch to compass)"),
  locationHeading: r("Modo brújula (desactivar)", "Modo bússola (desativar)", "Mode brúixola (desactiva)", "Modo compás (desactivar)", "Iparrorratz modua (desaktibatu)", "Compass mode (switch off)"),
  locationOff: r("Ubicación desactivada (activar)", "Localização desativada (ativar)", "Ubicació desactivada (activa)", "Localización desactivada (activar)", "Kokapena desaktibatuta (aktibatu)", "Location off (switch on)"),
  loadStations: r("Cargando estaciones europeas…", "A carregar estações europeias…", "Carregant estacions europees…", "Cargando estacións europeas…", "Europako estazioak kargatzen…", "Loading European stations…"),
  loadFailed: r("No se pudieron cargar los datos.", "Não foi possível carregar os dados.", "No s’han pogut carregar les dades.", "Non se puideron cargar os datos.", "Ezin izan dira datuak kargatu.", "Could not load data."),
  reflectivity: r("Reflectividad", "Refletividade", "Reflectivitat", "Reflectividade", "Islagarritasuna", "Reflectivity"),
  rawReflectivity: r("Reflectividad bruta", "Refletividade bruta", "Reflectivitat bruta", "Reflectividade bruta", "Islagarritasun gordina", "Raw reflectivity"),
  velocity: r("Velocidad radial", "Velocidade radial", "Velocitat radial", "Velocidade radial", "Abiadura erradiala", "Radial velocity"),
  spectrum: r("Ancho espectral", "Largura espectral", "Amplada espectral", "Anchura espectral", "Espektro-zabalera", "Spectrum width"),
  diffReflectivity: r("Reflectividad diferencial", "Refletividade diferencial", "Reflectivitat diferencial", "Reflectividade diferencial", "Islagarritasun diferentziala", "Differential reflectivity"),
  correlation: r("Coeficiente de correlación", "Coeficiente de correlação", "Coeficient de correlació", "Coeficiente de correlación", "Korrelazio-koefizientea", "Correlation coefficient"),
  phase: r("Fase diferencial", "Fase diferencial", "Fase diferencial", "Fase diferencial", "Fase diferentziala", "Differential phase"),
  specificPhase: r("Fase diferencial específica", "Fase diferencial específica", "Fase diferencial específica", "Fase diferencial específica", "Fase diferentzial espezifikoa", "Specific differential phase"),
  quality: r("Calidad de señal", "Qualidade do sinal", "Qualitat del senyal", "Calidade do sinal", "Seinalearen kalitatea", "Signal quality"),
  clutter: r("Corrección de ecos no meteorológicos", "Correção de ecos não meteorológicos", "Correcció d’ecos no meteorològics", "Corrección de ecos non meteorolóxicos", "Oihartzun ez-meteorologikoen zuzenketa", "Clutter correction"),
  depolarization: r("Relación de despolarización", "Razão de despolarização", "Relació de despolarització", "Relación de despolarización", "Despolarizazio-erlazioa", "Depolarization ratio"),
  echoHeight: r("Altura del eco", "Altura do eco", "Alçada de l’eco", "Altura do eco", "Oihartzunaren altuera", "Echo height"),
  signalNoise: r("Relación señal-ruido", "Relação sinal-ruído", "Relació senyal-soroll", "Relación sinal-ruído", "Seinale-zarata erlazioa", "Signal-to-noise"),
  rainRate: r("Intensidad de lluvia", "Intensidade da chuva", "Intensitat de pluja", "Intensidade da choiva", "Euri-intentsitatea", "Rain rate"),
  accumulated: r("Lluvia acumulada", "Chuva acumulada", "Pluja acumulada", "Choiva acumulada", "Euri metatua", "Accumulated rain"),
  tileHistory: r("{name} solo guarda ~2 h", "{name} só guarda ~2 h", "{name} només desa ~2 h", "{name} só garda ~2 h", "{name}: ~2 orduko historia soilik", "{name} stores only ~2 h"),
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
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLanguage(saved)) setLangState(saved);
    } catch { /* Storage may be disabled; switching still works. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Use this session's choice. */ }
  }, []);
  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const locale = LANGUAGES.find((l) => l.id === lang)?.locale ?? "es-ES";
  return <LanguageContext.Provider value={{ lang, locale, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function isLanguage(value: unknown): value is Lang { return LANGUAGES.some((l) => l.id === value); }

export const useI18n = () => useContext(LanguageContext);
const PRODUCT_MESSAGES: Record<string, MessageKey> = { DBZH: "reflectivity", DBZV: "reflectivity", TH: "rawReflectivity", TV: "rawReflectivity", VRAD: "velocity", VRADH: "velocity", VRADV: "velocity", WRAD: "spectrum", WRADH: "spectrum", WRADV: "spectrum", ZDR: "diffReflectivity", UZDR: "diffReflectivity", RHOHV: "correlation", URHOHV: "correlation", PHIDP: "phase", UPHIDP: "phase", KDP: "specificPhase", SQIH: "quality", SQIV: "quality", CCORH: "clutter", CCORV: "clutter", LDR: "depolarization", HGHT: "echoHeight", SNRH: "signalNoise", RATE: "rainRate", ACRR: "accumulated" };
export function translatedProduct(lang: Lang, code: string) { const key = PRODUCT_MESSAGES[code]; return key ? `${code} — ${translate(lang, key)}` : code; }
const REGIONS: Record<string, string> = { "724": "ES", "620": "PT", "250": "FR", "276": "DE", "380": "IT", "528": "NL", "056": "BE", "756": "CH", "040": "AT", "208": "DK", "246": "FI", "578": "NO", "752": "SE", "191": "HR", "203": "CZ", "233": "EE", "352": "IS", "372": "IE", "440": "LT", "470": "MT", "616": "PL", "705": "SI", "642": "RO" };
export function translatedCountry(locale: string, code: string, fallback: string) { const region = REGIONS[code.padStart(3, "0")]; return region ? new Intl.DisplayNames([locale], { type: "region" }).of(region) ?? fallback : fallback; }
