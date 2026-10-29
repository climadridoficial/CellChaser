import { Languages } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LANGUAGES, useI18n, type Lang } from "@/lib/i18n";

export default function LanguageMenu() {
  const { lang, setLang, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="chip ml-auto gap-1.5" aria-label={t("language")}>
        <Languages className="size-3.5" />{lang.toUpperCase()}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[1300]">
        <DropdownMenuRadioGroup value={lang} onValueChange={(v) => setLang(v as Lang)}>
          {LANGUAGES.map((l) => <DropdownMenuRadioItem key={l.id} value={l.id}>{l.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}