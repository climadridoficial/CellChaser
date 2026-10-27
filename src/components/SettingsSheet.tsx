import { COUNTRIES } from "@/lib/ord";
import type { RadarSettings } from "@/lib/settings";

interface Props {
  settings: RadarSettings;
  onChange: (patch: Partial<RadarSettings>) => void;
  onClose: () => void;
}

export default function SettingsSheet({ settings, onChange, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-start justify-center bg-background/70 px-4 py-10 backdrop-blur-sm">
      <div className="panel max-h-full w-full max-w-lg overflow-y-auto rounded-xl">
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <h2 className="font-display text-lg text-foreground">Settings</h2>
          <button onClick={onClose} className="chip">
            Done
          </button>
        </header>
        <div className="space-y-6 px-5 py-5">
          <section>
            <h3 className="section-title">Self-hosted LibreWXR base URL</h3>
            <input
              value={settings.librewxrUrl}
              onChange={(e) => onChange({ librewxrUrl: e.target.value })}
              placeholder="https://radar.my-domain.net"
              className="input mt-2"
              inputMode="url"
            />
            <p className="hint mt-2">
              LibreWXR exposes the same tile scheme as RainViewer but is fed by EUMETNET OPERA and
              other government sources, without the colour-scheme or zoom limits. Leave empty to use
              the public RainViewer tiles.
            </p>
          </section>

          <section>
            <h3 className="section-title">Meteogate API key (optional)</h3>
            <input
              value={settings.meteogateKey}
              onChange={(e) => onChange({ meteogateKey: e.target.value })}
              placeholder="Not required — anonymous access works"
              className="input mt-2"
              autoComplete="off"
            />
            <p className="hint mt-2">
              OPERA / OpenRadarData needs no key, but anonymous access is rate-limited. Add a key for
              heavier use; it is stored in this browser only.
            </p>
          </section>

          <section>
            <h3 className="section-title">AEMET API key (optional)</h3>
            <input
              value={settings.aemetKey}
              onChange={(e) => onChange({ aemetKey: e.target.value })}
              placeholder="Optional — built-in keys are used"
              className="input mt-2"
              autoComplete="off"
            />
            <p className="hint mt-2">
              Built-in keys already work; add your own to raise limits. Free at{" "}
              <a className="underline" href="https://opendata.aemet.es/centrodedescargas/altaUsuario" target="_blank" rel="noreferrer">opendata.aemet.es</a>. Stored in this browser only.
            </p>
          </section>

          <section>
            <h3 className="section-title">Radar station country</h3>
            <select
              value={settings.country}
              onChange={(e) => onChange({ country: e.target.value })}
              className="select mt-2"
            >
              <option value="all">All European stations</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </section>
        </div>
      </div>
    </div>
  );
}
