import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

function MapRecovery() {
  const { t } = useI18n();
  return <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background px-5 text-center">
    <p className="text-sm text-muted-foreground" role="alert">{t("mapFailed")}</p>
    <Button onClick={() => window.location.reload()}><RefreshCw />{t("reloadMap")}</Button>
  </div>;
}

/** Lazy module failures can occur when a preview update replaces old bundles.
 * Keep the rest of the radar app available instead of hitting the root boundary.
 */
export default class MapLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return <MapRecovery />;
    }
    return this.props.children;
  }
}