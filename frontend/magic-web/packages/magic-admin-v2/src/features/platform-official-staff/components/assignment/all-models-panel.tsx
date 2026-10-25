import { Fragment, useEffect, useMemo, useState } from "react";
import { GripVertical, List, Plus, SquareEqual } from "lucide-react";
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input";
import { Button } from "@magic-admin-v2/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@magic-admin-v2/components/ui/dropdown-menu";
import { ModelAvatar } from "@magic-admin-v2/features/platform-official-staff/components/avatars";
import { getCategoryModels } from "@magic-admin-v2/features/platform-official-staff/utils/assignment-models";
import { staffDragType, getI18nText, isDynamicModel, isDynamicModelOption, type AddModelTarget, type AddModelTargetGroup, type StaffDragData } from "@magic-admin-v2/features/platform-official-staff/utils/page-utils";
import type { OfficialStaffDetail, OfficialStaffModelOption, StaffDynamicModel, StaffModelCategory } from "@magic-admin-v2/features/platform-official-staff/types";
import { useI18n } from "@magic-admin-v2/i18n/use-i18n";
import { useTranslation } from "react-i18next";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@magic-admin-v2/utils/cn";

export function AllModelsPanel({
  detail,
  category,
  disabled,
  modelOptions,
  onAddModel,
  onCreateGroupForModel,
  onFloatingOpenChange,
  openFloatingId,
}: {
  category: StaffModelCategory;
  detail: OfficialStaffDetail;
  disabled: boolean;
  modelOptions: OfficialStaffModelOption[];
  onAddModel: (option: OfficialStaffModelOption, target: AddModelTarget) => void;
  onCreateGroupForModel: (model: OfficialStaffModelOption) => void;
  onFloatingOpenChange: (id: string | null) => void;
  openFloatingId: string | null;
}) {
  const { t } = useTranslation();
  const { language } = useI18n();
  const [keyword, setKeyword] = useState("");
  const normalizedKeyword = keyword.trim().toLowerCase();
  const visibleModels = useMemo(
    () =>
      modelOptions.filter((model) => {
        if (!normalizedKeyword) return true;
        return (
          model.name?.toLowerCase().includes(normalizedKeyword) ||
          model.model_id.toLowerCase().includes(normalizedKeyword) ||
          model.description?.toLowerCase().includes(normalizedKeyword)
        );
      }),
    [modelOptions, normalizedKeyword],
  );
  useEffect(() => {
    if (!openFloatingId?.startsWith("add-model-")) return;
    const hasOpenModel = visibleModels.some((model) => `add-model-${model.id}-${model.model_id}` === openFloatingId);
    if (!hasOpenModel) onFloatingOpenChange(null);
  }, [onFloatingOpenChange, openFloatingId, visibleModels]);
  const targetGroups = useMemo<AddModelTargetGroup[]>(
    () =>
      detail.groups.map((entry) => {
        const groupName = getI18nText(entry.group.name_i18n, language);
        return {
          dynamicTargets: getCategoryModels(entry, category)
            .filter((model): model is StaffDynamicModel => isDynamicModel(model))
            .map((model) => ({
              dynamicId: model.id,
              groupId: entry.group.id,
              label: getI18nText(model.model_translate.name, language) || model.model_name,
              type: "dynamic" as const,
            })),
          groupId: entry.group.id,
          label: groupName,
          type: "group" as const,
        };
      }),
    [category, detail.groups, language],
  );

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4">
      <div className="shrink-0">
        <div className="font-medium text-foreground">
          {category === "text"
            ? t("officialStaff.category.text")
            : category === "image"
              ? t("officialStaff.category.image")
              : t("officialStaff.category.video")}
        </div>
        <div className="text-xs text-muted-foreground">{t("officialStaff.assign.allModelsDesc")}</div>
      </div>
      <FilterSearchInput
        clearLabel={t("common.clear")}
        containerClassName="shrink-0"
        onValueChange={setKeyword}
        placeholder={t("officialStaff.placeholder.modelSearch")}
        value={keyword}
       inputTestId="platform-official-staff-search-input" clearButtonTestId="platform-official-staff-search-clear-button"/>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
        {visibleModels.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center p-4 text-sm text-muted-foreground">
            {t("officialStaff.assign.noModelsFound")}
          </div>
        ) : (
          visibleModels.map((model) => (
            <AvailableModelRow
              disabled={disabled}
              key={`${model.id}-${model.model_id}`}
              model={model}
              onAddModel={onAddModel}
              onCreateGroupForModel={onCreateGroupForModel}
              onMenuOpenChange={(open) =>
                onFloatingOpenChange(open ? `add-model-${model.id}-${model.model_id}` : null)
              }
              openMenuId={openFloatingId}
              targetGroups={targetGroups}
              category={category}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function AvailableModelRow({
  disabled,
  model,
  onAddModel,
  onCreateGroupForModel,
  onMenuOpenChange,
  openMenuId,
  targetGroups,
  category,
}: {
  disabled: boolean;
  model: OfficialStaffModelOption;
  onAddModel: (option: OfficialStaffModelOption, target: AddModelTarget) => void;
  onCreateGroupForModel: (model: OfficialStaffModelOption) => void;
  onMenuOpenChange: (open: boolean) => void;
  openMenuId: string | null;
  targetGroups: AddModelTargetGroup[];
  category: StaffModelCategory;
}) {
  const { t } = useTranslation();
  const canAddToDynamic = !isDynamicModelOption(model);
  const menuId = `add-model-${model.id}-${model.model_id}`;
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    data: {
      item: model,
      category,
      type: staffDragType.leftModel,
    } satisfies StaffDragData,
    disabled,
    id: `left-model-${model.id}-${model.model_id}`,
  });

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b p-2 last:border-b-0",
        disabled && "opacity-60",
        isDragging && "opacity-40",
      )}
      ref={setNodeRef}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button data-testid="platform-official-staff-model-action-button"
          aria-label={t("officialStaff.aria.dragModel")}
          className="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <ModelAvatar item={model} />
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">
            {model.name || (isDynamicModelOption(model) ? t("officialStaff.model.dynamic") : model.model_id)}
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">
            {isDynamicModelOption(model) ? "dynamic" : model.model_id}
          </div>
        </div>
      </div>
      <DropdownMenu onOpenChange={onMenuOpenChange} open={openMenuId === menuId}>
        <DropdownMenuTrigger asChild data-testid="platform-official-staff-menu-trigger">
          <Button aria-label={t("officialStaff.action.addModel")} className="size-7" disabled={disabled} size="icon" variant="outline" data-testid="platform-official-staff-create-button">
            <Plus className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto" data-testid="platform-official-staff-action-button">
          <DropdownMenuItem
            data-testid="platform-official-staff-menu-item"
            onSelect={() => {
              onMenuOpenChange(false);
              onCreateGroupForModel(model);
            }}>
            <Plus className="mr-2 size-4" />
            {t("officialStaff.action.createGroup")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {targetGroups.map((targetGroup) => (
            <Fragment key={targetGroup.groupId}>
              <DropdownMenuItem
                data-testid="platform-official-staff-menu-item"
                onSelect={() => {
                  onMenuOpenChange(false);
                  onAddModel(model, targetGroup);
                }}>
                <List className="mr-2 size-4" />
                <span className="truncate">{targetGroup.label}</span>
              </DropdownMenuItem>
              {canAddToDynamic
                ? targetGroup.dynamicTargets.map((target) => (
                    <DropdownMenuItem
                      className="pl-8"
                      data-testid="platform-official-staff-menu-item"
                      key={`${target.groupId}-${target.dynamicId}`}
                      onSelect={() => {
                        onMenuOpenChange(false);
                        onAddModel(model, target);
                      }}>
                      <SquareEqual className="mr-2 size-4" />
                      <span className="truncate">{target.label}</span>
                    </DropdownMenuItem>
                  ))
                : null}
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
