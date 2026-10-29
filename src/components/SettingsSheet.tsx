import { useI18n } from "@/lib/i18n";
import { COUNTRIES } from "@/lib/ord";
import type { RadarSettings } from "@/lib/settings";

interface Props {
  settings: RadarSettings;
  onChange: (patch: Partial<RadarSettings>) => void;
  onClose: () => void;
}

export default function SettingsSheet({ settings, onChange, onClose }: Props) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[1200] flex items-start justify-center bg-background/70 px-4 py-10 backdrop-blur-sm">
      <div className="panel max-h-full w-full max-w-lg overflow-y-auto rounded-xl">
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <h2 className="font-display text-lg text-foreground">{t("settings")}</h2>
          <button onClick={onClose} className="chip">
            {t("done")}
          </button>
        </header>
        <div className="space-y-6 px-5 py-5">
          <section>
            <h3 className="section-title">{t("baseUrl")}</h3>
            <input
              value={settings.librewxrUrl}
              onChange={(e) => onChange({ librewxrUrl: e.target.value })}
              placeholder="https://api.librewxr.net"
              className="input mt-2"
              inputMode="url"
            />
            <p className="hint mt-2">
              {t("baseHelp")}
            </p>
          </section>

          <section>
            <h3 className="section-title">{t("optionalKey", { name: "Meteogate API" })}</h3>
            <input
              value={settings.meteogateKey}
              onChange={(e) => onChange({ meteogateKey: e.target.value })}
              placeholder={t("noKey")}
              className="input mt-2"
              autoComplete="off"
            />
            <p className="hint mt-2">
              {t("keyHelp")}
            </p>
          </section>

          <section>
            <h3 className="section-title">{t("optionalKey", { name: "AEMET API" })}</h3>
            <input
              value={settings.aemetKey}
              onChange={(e) => onChange({ aemetKey: e.target.value })}
              placeholder={t("builtIn")}
              className="input mt-2"
              autoComplete="off"
            />
            <p className="hint mt-2">
              {t("aemetHelp")}{" "}
              <a className="underline" href="https://opendata.aemet.es/centrodedescargas/altaUsuario" target="_blank" rel="noreferrer">opendata.aemet.es</a>.
            </p>
          </section>

          <section>
            <h3 className="section-title">{t("country")}</h3>
            <select
              value={settings.country}
              onChange={(e) => onChange({ country: e.target.value })}
              className="select mt-2"
            >
              <option value="all">{t("allStations")}</option>
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
