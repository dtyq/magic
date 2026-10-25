import { Boxes, Edit3, GripVertical, MoreHorizontal, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { Card, CardContent } from "@magic-admin-v2/components/ui/card";
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render";
import { Button } from "@magic-admin-v2/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@magic-admin-v2/components/ui/dropdown-menu";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ModelItemRow, DropIndicatorModelPreview } from "@magic-admin-v2/features/platform-official-staff/components/assignment/model-rows";
import type { OfficialStaffDetail, OfficialStaffGroup, StaffDynamicModel, StaffModelCategory, StaffModelItem } from "@magic-admin-v2/features/platform-official-staff/types";
import { getCategoryModels, updateCategoryModels } from "@magic-admin-v2/features/platform-official-staff/utils/assignment-models";
import { getI18nText, isDynamicModel, staffDragType, type AssignmentConfirmAction, type DropIndicator, type StaffDragData } from "@magic-admin-v2/features/platform-official-staff/utils/page-utils";
import { useI18n } from "@magic-admin-v2/i18n/use-i18n";
import { useTranslation } from "react-i18next";
import { cn } from "@magic-admin-v2/utils/cn";

function getRenderableGroupModelDropIndicator(
  dropIndicator: DropIndicator | null,
  activeDragData: StaffDragData | null,
  groupId: string,
) {
  if (dropIndicator?.type !== "group-model" || dropIndicator.groupId !== groupId) return null;
  if (
    (activeDragData?.type === staffDragType.model || activeDragData?.type === staffDragType.dynamic) &&
    activeDragData.groupId === groupId
  ) {
    return null;
  }
  return dropIndicator;
}

function shouldHideSourceGroupModel(
  activeDragData: StaffDragData | null,
  dropIndicator: DropIndicator | null,
  groupId: string,
  modelId: string,
) {
  if (
    !dropIndicator ||
    (activeDragData?.type !== staffDragType.model && activeDragData?.type !== staffDragType.dynamic) ||
    activeDragData.groupId !== groupId ||
    activeDragData.item.id !== modelId
  ) {
    return false;
  }

  if (dropIndicator.type === "dynamic-sub-model") return true;
  return dropIndicator.type === "group-model" && dropIndicator.groupId !== groupId;
}



export function ModelGroupCard({
  activeDragData,
  dropIndicator,
  category,
  editable,
  entry,
  onChange,
  onEditGroup,
  onFloatingOpenChange,
  onRequestDelete,
  openFloatingId,
}: {
  category: StaffModelCategory;
  activeDragData: StaffDragData | null;
  dropIndicator: DropIndicator | null;
  editable: boolean;
  entry: OfficialStaffDetail["groups"][number];
  onChange: (updater: (current: OfficialStaffDetail | null) => OfficialStaffDetail | null) => void;
  onEditGroup: (group: OfficialStaffGroup) => void;
  onFloatingOpenChange: (id: string | null) => void;
  onRequestDelete: (action: AssignmentConfirmAction) => void;
  openFloatingId: string | null;
}) {
  const { t } = useTranslation();
  const { language } = useI18n();
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    data: {
      groupId: entry.group.id,
      item: entry.group,
      type: staffDragType.group,
    } satisfies StaffDragData,
    disabled: !editable,
    id: entry.group.id,
  });
  const { setNodeRef: setGroupDropRef, isOver } = useDroppable({
    data: {
      groupId: entry.group.id,
      type: staffDragType.groupContainer,
    } satisfies StaffDragData,
    disabled: !editable,
    id: `group-container-${entry.group.id}`,
  });
  const style: CSSProperties = {
    opacity: isDragging ? 0.45 : undefined,
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const modelDropIndicator = getRenderableGroupModelDropIndicator(dropIndicator, activeDragData, entry.group.id);

  const updateModels = (models: StaffModelItem[]) => {
    if (!editable) return;
    onChange((current) => {
      if (!current) return current;
      return { ...current, groups: current.groups.map((groupEntry) => groupEntry.group.id === entry.group.id ? updateCategoryModels(groupEntry, category, models) : groupEntry) };
    });
  };

  const requestDeleteGroup = () => {
    if (!editable) return;
    onRequestDelete({
      groupId: entry.group.id,
      kind: "group",
      name: getI18nText(entry.group.name_i18n, language),
    });
  };

  const requestDeleteModel = (modelId: string) => {
    if (!editable) return;
    const model = getCategoryModels(entry, category).find((item) => item.id === modelId);
    if (!model) return;
    const dynamic = isDynamicModel(model);
    onRequestDelete({
      groupId: entry.group.id,
      isDynamic: dynamic,
      kind: "model",
      modelId,
      name: dynamic
        ? getI18nText(model.model_translate.name, language) || model.model_name
        : model.model_name,
    });
  };

  const requestDeleteSubModel = (dynamicId: string, modelId: string) => {
    if (!editable) return;
    const dynamicModel = getCategoryModels(entry, category).find(
      (model): model is StaffDynamicModel => isDynamicModel(model) && model.id === dynamicId,
    );
    const subModel = dynamicModel?.aggregate_config.models.find((model) => model.id === modelId);
    if (!subModel) return;
    onRequestDelete({
      dynamicId,
      groupId: entry.group.id,
      kind: "subModel",
      modelId,
      name: subModel.model_name,
    });
  };

  return (
    <Card
      className={cn("py-0", isOver && "border-muted-foreground/20 bg-muted/15")}
      data-staff-drop-group-id={entry.group.id}
      ref={setNodeRef}
      style={style}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {editable ? (
              <button data-testid="platform-official-staff-model-group-action-button"
                aria-label={t("officialStaff.aria.dragGroup")}
                className="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
                type="button"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="size-3.5" />
              </button>
            ) : null}
            <EntityAvatarRender
              alt={getI18nText(entry.group.name_i18n, language)}
              className="size-5"
              fallbackIcon={<Boxes className="size-3" aria-hidden="true" />}
              name={getI18nText(entry.group.name_i18n, language)}
              src={entry.group.icon}
            />
            <div className="min-w-0 truncate font-medium text-foreground">{getI18nText(entry.group.name_i18n, language)}</div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("officialStaff.group.modelCount", { count: getCategoryModels(entry, category).length })}
            </span>
          </div>
          {editable ? (
            <DropdownMenu
              onOpenChange={(open) => onFloatingOpenChange(open ? `group-more-${entry.group.id}` : null)}
              open={openFloatingId === `group-more-${entry.group.id}`}
            >
              <DropdownMenuTrigger asChild data-testid="platform-official-staff-menu-trigger">
                <Button aria-label={t("officialStaff.action.more")} size="icon" variant="ghost" data-testid="platform-official-staff-edit-button">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" data-testid="platform-official-staff-action-button">
                <DropdownMenuItem onSelect={() => onEditGroup(entry.group)} data-testid="platform-official-staff-menu-item">
                  <Edit3 className="mr-2 size-4" />
                  {t("officialStaff.action.editGroup")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={requestDeleteGroup}>
                  <Trash2 className="mr-2 size-4" />
                  {t("officialStaff.action.deleteGroup")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        <div className="space-y-2" ref={setGroupDropRef}>
          {getCategoryModels(entry, category).length === 0 ? (
            modelDropIndicator ? (
              <DropIndicatorModelPreview activeDragData={activeDragData} />
            ) : (
              <div className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
                {t("officialStaff.group.noModels")}
              </div>
            )
          ) : (
            <SortableContext items={getCategoryModels(entry, category).map((model) => model.id)} strategy={verticalListSortingStrategy}>
              {getCategoryModels(entry, category).map((model) => {
                const hideSourceModel = shouldHideSourceGroupModel(activeDragData, dropIndicator, entry.group.id, model.id);
                return (
                  <div
                    className={cn(
                      "space-y-2",
                      hideSourceModel && "h-0 overflow-hidden opacity-0 pointer-events-none",
                    )}
                    data-staff-model-id={model.id}
                    key={model.id}
                  >
                    {modelDropIndicator?.modelId === model.id &&
                    modelDropIndicator.position === "before" ? (
                      <DropIndicatorModelPreview activeDragData={activeDragData} />
                    ) : null}
                    <ModelItemRow
                      activeDragData={activeDragData}
                    category={category}
                    dropIndicator={dropIndicator}
                    editable={editable}
                    model={model}
                    onDelete={requestDeleteModel}
                    onDeleteSubModel={requestDeleteSubModel}
                    onFloatingOpenChange={onFloatingOpenChange}
                    onUpdate={(nextModel) =>
                      updateModels(getCategoryModels(entry, category).map((item) => (item.id === nextModel.id ? nextModel : item)))
                    }
                    openFloatingId={openFloatingId}
                    parentGroupId={entry.group.id}
                  />
                    {modelDropIndicator?.modelId === model.id &&
                    modelDropIndicator.position === "after" ? (
                      <DropIndicatorModelPreview activeDragData={activeDragData} />
                    ) : null}
                  </div>
                );
              })}
              {modelDropIndicator?.position === "end" ? (
                <DropIndicatorModelPreview activeDragData={activeDragData} />
              ) : null}
            </SortableContext>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
