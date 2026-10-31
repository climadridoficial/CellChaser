import { ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function ToolbarAdjustment({ onSave, onCancel }: { onSave: () => void; onCancel?: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <div className="toolbar-adjust-backdrop" />
      <section className="toolbar-adjust-prompt" role="dialog" aria-modal="true" aria-labelledby="toolbar-adjust-title">
        <ArrowDownUp className="size-5 text-primary" aria-hidden />
        <h2 id="toolbar-adjust-title" className="font-display text-base">{t("adjustToolbar")}</h2>
        <p className="text-sm text-muted-foreground">{t("adjustToolbarHelp")}</p>
        <div className="flex justify-end gap-2">
          {onCancel && <Button variant="ghost" onClick={onCancel}>{t("close")}</Button>}
          <Button onClick={onSave}>{t("done")}</Button>
        </div>
      </section>
    </>
  );
}