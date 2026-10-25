import { useTranslation } from "react-i18next";
import { Switch } from "@magic-admin-v2/components/ui/switch";
import {
  providerStatus,
  type ProviderListItem,
} from "@magic-admin-v2/features/platform-provider-list/types";

export function ProviderStatusSwitch({
  disabled = false,
  loading = false,
  onChange,
  provider,
}: {
  disabled?: boolean;
  loading?: boolean;
  onChange: (checked: boolean) => void;
  provider: ProviderListItem;
}) {
  const { t } = useTranslation();
  const checked = provider.status === providerStatus.enabled;

  return (
    <div className="flex items-center">
      <Switch
        aria-label={t("providerList.action.toggleStatus")}
        checked={checked}
        disabled={disabled}
        loading={loading}
        onCheckedChange={onChange}
      data-testid="platform-provider-list-switch" />
    </div>
  );
}
