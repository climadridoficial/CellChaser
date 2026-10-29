import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LANGUAGES, useI18n, isLanguage } from "@/lib/i18n";

export default function LanguageMenu() {
  const { lang, setLang, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="chip ml-auto gap-1.5 shrink-0" aria-label={t("language")} title={t("language")}>
        <Languages className="size-3.5" />{lang.toUpperCase()}
      </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[1300]">
        <DropdownMenuRadioGroup value={lang} onValueChange={(v) => { if (isLanguage(v)) setLang(v); }}>
          {LANGUAGES.map((l) => <DropdownMenuRadioItem key={l.id} value={l.id}>{l.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}