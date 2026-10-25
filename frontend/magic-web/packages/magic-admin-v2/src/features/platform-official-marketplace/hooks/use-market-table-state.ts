import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type {
  MarketRecord,
  MarketTableState,
  UpdateMarketInfoParams,
} from "@magic-admin-v2/features/platform-official-marketplace/types";
import {
  getApiErrorMessage,
  normalizeAgentMarketCategorySortOrder,
} from "@magic-admin-v2/features/platform-official-marketplace/utils";

/**
 * Coordinates shared row editing for employee and skill markets.
 * List filtering and pagination are managed by useListQueryParams in each panel.
 */
export function useMarketTableState<
  TRecord extends MarketRecord,
>({
  canEdit = true,
  updateMarketInfo,
}: {
  canEdit?: boolean;
  updateMarketInfo: (payload: { id: string; values: UpdateMarketInfoParams }) => Promise<unknown>;
}): MarketTableState<TRecord> {
  const { t } = useTranslation();
  const [sortSavingIds, setSortSavingIds] = useState<Set<string>>(new Set());
  const [featuredSavingIds, setFeaturedSavingIds] = useState<Set<string>>(new Set());
  const [hiddenSavingIds, setHiddenSavingIds] = useState<Set<string>>(new Set());

  async function saveMarketInfo(
    record: TRecord,
    values: UpdateMarketInfoParams,
    savingType: "featured" | "hidden" | "sort",
  ) {
    const setBusy =
      savingType === "featured"
        ? setFeaturedSavingIds
        : savingType === "hidden"
          ? setHiddenSavingIds
          : setSortSavingIds;

    setBusy((previous) => new Set(previous).add(record.id));

    try {
      await updateMarketInfo({ id: record.id, values });
      if (savingType !== "sort") {
        toast.success(t("officialMarketplace.message.updateSuccess"));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("officialMarketplace.error.updateFailed")));
    } finally {
      setBusy((previous) => {
        const next = new Set(previous);
        next.delete(record.id);
        return next;
      });
    }
  }

  function saveFeatured(record: TRecord, value: boolean) {
    if (!canEdit || value === Boolean(record.is_featured)) return;
    void saveMarketInfo(record, { is_featured: value }, "featured");
  }

  function saveHidden(record: TRecord, value: boolean) {
    if (!canEdit || value === Boolean(record.is_hidden)) return;
    void saveMarketInfo(record, { is_hidden: value }, "hidden");
  }

  function updateSortOrder(record: TRecord, value: number) {
    if (!canEdit) return;

    const sortOrder = normalizeAgentMarketCategorySortOrder(value);
    if (sortOrder === (record.sort_order ?? 0)) return;

    void saveMarketInfo(record, { sort_order: sortOrder }, "sort");
  }

  return {
    canEdit,
    featuredSavingIds,
    hiddenSavingIds,
    saveFeatured,
    saveHidden,
    sortSavingIds,
    updateSortOrder,
  };
}
