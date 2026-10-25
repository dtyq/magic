import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ModelConnectivityTest } from "@magic-admin-v2/features/platform-model-list/components/model-connectivity-test";
import { DefaultModelIcon } from "@magic-admin-v2/features/platform-model-list/components/default-model-icon";
import { useProviderListQuery } from "@magic-admin-v2/features/platform-provider-list/queries";
import {
  providerCategory,
  providerType,
  type ProviderCategory,
  type ProviderType,
} from "@magic-admin-v2/features/platform-provider-list/types";
import {
  defaultProviderIcon,
  getProviderLogoSrc,
} from "@magic-admin-v2/features/platform-provider-list/utils/provider-icons";
import {
  providerModelCategory,
  providerModelStatus,
  providerModelType,
  type ProviderModelCategory,
  type ProviderModelGroup,
  type ProviderModelProvider,
  type ProviderModelStatus,
  type ProviderModelType,
} from "@magic-admin-v2/features/platform-model-list/types";
import { useProviderModelDataSource } from "@magic-admin-v2/features/platform-model-list/utils/data-source";
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render";
import { Badge } from "@magic-admin-v2/components/ui/badge";
import { Button } from "@magic-admin-v2/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@magic-admin-v2/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@magic-admin-v2/components/ui/table";

export function ModelDetailDialog({
  item,
  onOpenChange,
}: {
  item: ProviderModelGroup | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const dataSource = useProviderModelDataSource();
  const displayName = item?.name.trim() || t("modelList.editor.modelPreview");
  const providerListCategory: ProviderCategory = item?.model_type === providerModelType.embedding
    || item?.category === providerModelCategory.embedding
    ? providerCategory.llm
    : item?.category ?? providerCategory.llm;
  const providerListQuery = useProviderListQuery(providerListCategory, {
    enabled: Boolean(item),
    endpoint: dataSource.endpoints.providerList,
    key: dataSource.key,
  });
  const providerTypeById = useMemo(
    () => new Map(
      (providerListQuery.data ?? []).map((provider) => [provider.id, provider.provider_type]),
    ),
    [providerListQuery.data],
  );

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden sm:max-w-3xl" data-testid="platform-model-list-dialog-content" closeButtonTestId="model-detail-dialog-close-button">
        {item ? (
          <>
            <DialogHeader>
              <div className="flex min-w-0 items-center gap-3 pr-7">
                <EntityAvatarRender
                  alt=""
                  className="size-10"
                  fallbackIcon={<DefaultModelIcon />}
                  imageClassName="object-cover"
                  name={displayName}
                  src={item.icon}
                />
                <div className="min-w-0">
                  <DialogTitle className="truncate">{displayName}</DialogTitle>
                  <DialogDescription className="mt-1 truncate">
                    {t("modelList.detail.modelIdentifier")}：{item.model_id}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
              <section aria-labelledby="model-detail-basic-title">
                <h3 className="text-sm font-semibold text-foreground" id="model-detail-basic-title">
                  {t("modelList.detail.basicInfo")}
                </h3>
                <dl className="mt-3 grid overflow-hidden rounded-lg border sm:grid-cols-3">
                  <DetailField label={t("modelList.detail.category")}>
                    <CategoryBadge value={item.category} />
                  </DetailField>
                  <DetailField label={t("modelList.detail.modelType")}>
                    <ModelTypeBadge value={item.model_type} />
                  </DetailField>
                  <DetailField label={t("modelList.detail.providerCount")}>
                    <span className="text-sm font-medium text-foreground">
                      {t("modelList.providerCount", { count: item.provider_count })}
                    </span>
                  </DetailField>
                </dl>
              </section>

              <section aria-labelledby="model-detail-providers-title">
                <div>
                  <h3
                    className="text-sm font-semibold text-foreground"
                    id="model-detail-providers-title"
                  >
                    {t("modelList.detail.providers")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("modelList.detail.providersDescription")}
                  </p>
                </div>
                <div className="mt-3 overflow-hidden rounded-lg border">
                  {item.providers.length ? (
                    <Table className="min-w-[680px]">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent" data-testid="platform-model-list-header-row">
                          <TableHead>{t("modelList.detail.provider")}</TableHead>
                          <TableHead>{t("modelList.detail.alias")}</TableHead>
                          <TableHead>{t("modelList.detail.providerStatus")}</TableHead>
                          <TableHead>{t("modelList.detail.modelStatus")}</TableHead>
                          <TableHead className="text-right">
                            {t("modelList.column.actions")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {item.providers.map((provider) => (
                          <ProviderDetailRow
                            key={provider.service_provider_config_id}
                            provider={provider}
                            providerType={providerTypeById.get(provider.service_provider_config_id)}
                            providerTypeResolved={providerListQuery.isSuccess}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                      {t("modelList.detail.providersEmpty")}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} type="button" variant="outline" data-testid="platform-model-list-view-button">
                {t("modelList.action.closeDetail")}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="min-w-0 border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-2 min-w-0">{children}</dd>
    </div>
  );
}

function ProviderDetailRow({
  provider,
  providerType: providerTypeValue,
  providerTypeResolved,
}: {
  provider: ProviderModelProvider;
  providerType?: ProviderType;
  providerTypeResolved: boolean;
}) {
  const { t } = useTranslation();
  const displayName = provider.name || provider.provider_code || t("common.emptyValue");
  const canTestConnectivity = providerTypeResolved
    && providerTypeValue !== undefined
    && providerTypeValue !== providerType.official;

  return (
    <TableRow data-testid="platform-model-list-row">
      <TableCell>
        <div className="flex min-w-0 items-center gap-2.5">
          <EntityAvatarRender
            alt=""
            className="size-8"
            fallbackIcon={<DefaultProviderIcon />}
            imageClassName="object-cover"
            name={displayName}
            src={getProviderLogoSrc({
              code: provider.provider_code,
              icon: provider.icon,
            })}
          />
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{displayName}</div>
            <div className="truncate text-xs text-muted-foreground">{provider.provider_code}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-48 truncate text-muted-foreground">
        {provider.alias || t("common.emptyValue")}
      </TableCell>
      <TableCell>
        <StatusBadge value={provider.status} />
      </TableCell>
      <TableCell>
        <StatusBadge value={provider.model_status} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-right">
        {canTestConnectivity ? (
          <ModelConnectivityTest
            className="flex-nowrap gap-1.5"
            compact
            request={{ kind: "record", recordId: provider.model_record_id }}
          />
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function DefaultProviderIcon() {
  return <img alt="" className="size-full object-cover" src={defaultProviderIcon} />;
}

export function StatusBadge({ value }: { value: ProviderModelStatus }) {
  const { t } = useTranslation();
  const isEnabled = value === providerModelStatus.enabled;

  return (
    <Badge variant={isEnabled ? "success" : "secondary"}>
      {isEnabled ? t("modelList.status.enabled") : t("modelList.status.disabled")}
    </Badge>
  );
}

export function CategoryBadge({ value }: { value: ProviderModelCategory }) {
  const { t } = useTranslation();
  const labelByCategory: Record<ProviderModelCategory, string> = {
    [providerModelCategory.llm]: "modelList.category.llm",
    [providerModelCategory.vlm]: "modelList.category.vlm",
    [providerModelCategory.vgm]: "modelList.category.vgm",
    [providerModelCategory.embedding]: "modelList.category.embedding",
  };

  return <Badge variant="info">{t(labelByCategory[value])}</Badge>;
}

export function ModelTypeBadge({ value }: { value: ProviderModelType }) {
  const { t } = useTranslation();
  const labelByType: Record<ProviderModelType, string> = {
    [providerModelType.textToImage]: "modelList.type.textToImage",
    [providerModelType.imageToImage]: "modelList.type.imageToImage",
    [providerModelType.imageEnhancement]: "modelList.type.imageEnhancement",
    [providerModelType.largeLanguageModel]: "modelList.type.largeLanguageModel",
    [providerModelType.embedding]: "modelList.type.embedding",
    [providerModelType.textToVideo]: "modelList.type.textToVideo",
  };

  return <Badge variant="secondary">{t(labelByType[value])}</Badge>;
}
