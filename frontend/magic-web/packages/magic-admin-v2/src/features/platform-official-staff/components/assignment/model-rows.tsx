import { ArrowDownToLine, Boxes, Edit3, GripVertical, Trash2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render";
import { Button } from "@magic-admin-v2/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@magic-admin-v2/components/ui/select";
import { ModelAvatar } from "@magic-admin-v2/features/platform-official-staff/components/avatars";
import { DynamicModelEditDialog, SubModelRow } from "@magic-admin-v2/features/platform-official-staff/components/assignment/assignment-dialogs";
import { staffModelStatus, staffOrderDirection, type StaffBaseModel, type StaffDynamicModel, type StaffModelCategory, type StaffModelItem } from "@magic-admin-v2/features/platform-official-staff/types";
import { getActivePreviewMeta, getI18nText, isDynamicModel, staffDragType, type DropIndicator, type StaffDragData } from "@magic-admin-v2/features/platform-official-staff/utils/page-utils";
import { useI18n } from "@magic-admin-v2/i18n/use-i18n";
import { useTranslation } from "react-i18next";
import { cn } from "@magic-admin-v2/utils/cn";

function DropIndicatorPlaceholder({ dense = false }: { dense?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50 shadow-[inset_0_0_0_1px_hsl(var(--border)/0.7)]",
        dense ? "h-9" : "h-11",
      )}
    />
  );
}

export function DropIndicatorModelPreview({
  activeDragData,
  dense = false,
}: {
  activeDragData: StaffDragData | null;
  dense?: boolean;
}) {
  const { t } = useTranslation();
  const { language } = useI18n();
  const meta = getActivePreviewMeta(activeDragData, language, t);

  if (!meta || meta.type === "group") return <DropIndicatorPlaceholder dense={dense} />;

  return (
    <div
      className={cn(
        "pointer-events-none flex items-center justify-between gap-2 rounded-lg border bg-background p-2 opacity-50 ring-1 ring-border/70",
        dense ? "h-9" : "h-11",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground">
          <GripVertical className={dense ? "size-3" : "size-3.5"} />
        </div>
        <EntityAvatarRender
          alt={meta.title}
          className="size-6"
          fallbackIcon={<Boxes className="size-3.5" aria-hidden="true" />}
          name={meta.title}
          src={meta.icon}
        />
        <div className="flex min-w-0 items-baseline gap-2">
          <div className="truncate text-xs font-medium text-foreground">{meta.title}</div>
          {meta.subtitle ? (
            <div className="truncate font-mono text-[11px] text-muted-foreground">{meta.subtitle}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ModelItemRow({
  category,
  activeDragData,
  dropIndicator,
  editable,
  model,
  onDelete,
  onDeleteSubModel,
  onFloatingOpenChange,
  onUpdate,
  openFloatingId,
  parentGroupId,
}: {
  category: StaffModelCategory;
  activeDragData: StaffDragData | null;
  dropIndicator: DropIndicator | null;
  editable: boolean;
  model: StaffModelItem;
  onDelete: (modelId: string) => void;
  onDeleteSubModel: (dynamicId: string, modelId: string) => void;
  onFloatingOpenChange: (id: string | null) => void;
  onUpdate: (model: StaffModelItem) => void;
  openFloatingId: string | null;
  parentGroupId: string;
}) {
  if (isDynamicModel(model)) {
    return (
      <DynamicModelItemRow
        activeDragData={activeDragData}
        dropIndicator={dropIndicator}
        editable={editable}
        model={model}
        category={category}
        onDelete={onDelete}
        onDeleteSubModel={onDeleteSubModel}
        onFloatingOpenChange={onFloatingOpenChange}
        onUpdate={onUpdate}
        openFloatingId={openFloatingId}
        parentGroupId={parentGroupId}
      />
    );
  }

  return (
    <BaseModelItemRow
      editable={editable}
      model={model}
      category={category}
      onDelete={onDelete}
      parentGroupId={parentGroupId}
    />
  );
}

export function BaseModelItemRow({
  category,
  editable,
  model,
  onDelete,
  parentGroupId,
}: {
  category: StaffModelCategory;
  editable: boolean;
  model: StaffBaseModel;
  onDelete: (modelId: string) => void;
  parentGroupId: string;
}) {
  const { t } = useTranslation();
  const deleted = model.model_status === staffModelStatus.deleted;
  const disabled = model.model_status !== staffModelStatus.normal;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    data: {
      category,
      groupId: parentGroupId,
      item: model,
      type: isDynamicModel(model) ? staffDragType.dynamic : staffDragType.model,
    } satisfies StaffDragData,
    disabled: !editable || deleted,
    id: model.id,
  });
  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : disabled ? 0.5 : undefined,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={cn("flex items-center justify-between gap-2 rounded-lg border p-2", disabled && "opacity-50")}
      ref={setNodeRef}
      style={style}
    >
      <div className="flex min-w-0 items-center gap-2">
        {editable && !deleted ? (
          <button data-testid="platform-official-staff-model-action-button"
            aria-label={t("officialStaff.aria.dragModel")}
            className="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        ) : null}
        <ModelAvatar item={model} />
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-xs font-medium text-foreground">{model.model_name}</div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{model.model_id}</div>
          {deleted ? <span className="shrink-0 text-[11px] text-destructive">{t("officialStaff.model.deleted")}</span> : null}
        </div>
      </div>
      {editable ? (
        <Button className="size-7" onClick={() => onDelete(model.id)} size="icon" variant="ghost" data-testid="platform-official-staff-delete-button">
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function getRenderableSubModelDropIndicator(
  dropIndicator: DropIndicator | null,
  activeDragData: StaffDragData | null,
  groupId: string,
  dynamicId: string,
) {
  if (
    dropIndicator?.type !== "dynamic-sub-model" ||
    dropIndicator.groupId !== groupId ||
    dropIndicator.dynamicId !== dynamicId
  ) {
    return null;
  }
  if (
    activeDragData?.type === staffDragType.subModel &&
    activeDragData.groupId === groupId &&
    activeDragData.dynamicId === dynamicId
  ) {
    return null;
  }
  return dropIndicator;
}


export function DynamicModelItemRow({
  category,
  activeDragData,
  dropIndicator,
  editable,
  model,
  onDelete,
  onDeleteSubModel,
  onFloatingOpenChange,
  onUpdate,
  openFloatingId,
  parentGroupId,
}: {
  category: StaffModelCategory;
  activeDragData: StaffDragData | null;
  dropIndicator: DropIndicator | null;
  editable: boolean;
  model: StaffDynamicModel;
  onDelete: (modelId: string) => void;
  onDeleteSubModel: (dynamicId: string, modelId: string) => void;
  onFloatingOpenChange: (id: string | null) => void;
  onUpdate: (model: StaffModelItem) => void;
  openFloatingId: string | null;
  parentGroupId: string;
}) {
  const { t } = useTranslation();
  const { language } = useI18n();
  const [editOpen, setEditOpen] = useState(false);
  const order = model.aggregate_config.strategy_config?.order ?? staffOrderDirection.asc;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    data: {
      category,
      groupId: parentGroupId,
      item: model,
      type: staffDragType.dynamic,
    } satisfies StaffDragData,
    disabled: !editable,
    id: model.id,
  });
  const { isOver, setNodeRef: setDynamicDropRef } = useDroppable({
    data: {
      dynamicId: model.id,
      groupId: parentGroupId,
      item: model,
      type: staffDragType.dynamicContainer,
    } satisfies StaffDragData,
    disabled: !editable,
    id: `dynamic-container-${model.id}`,
  });
  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : undefined,
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const subModelDropIndicator = getRenderableSubModelDropIndicator(dropIndicator, activeDragData, parentGroupId, model.id);

  return (
    <div
      className={cn("rounded-lg border bg-muted/20 p-2", isOver && "border-muted-foreground/20 bg-muted/30")}
      ref={setNodeRef}
      style={style}
    >
      <div
        className="space-y-2"
        data-staff-dynamic-drop-id={model.id}
        data-staff-dynamic-group-id={parentGroupId}
        ref={setDynamicDropRef}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {editable ? (
              <button data-testid="platform-official-staff-model-action-button"
                aria-label={t("officialStaff.aria.dragModel")}
                className="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
                type="button"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="size-3.5" />
              </button>
            ) : null}
            <ModelAvatar item={model} />
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-xs font-medium text-foreground">
                {getI18nText(model.model_translate.name, language) || model.model_name}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {getI18nText(model.model_translate.description, language) || model.model_description}
              </div>
            </div>
          </div>
          {editable ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                aria-label={t("officialStaff.action.editDynamicModel")}
                className="size-7"
                onClick={() => {
                  onFloatingOpenChange(null);
                  setEditOpen(true);
                }}
                size="icon"
                variant="ghost">
                <Edit3 className="size-3.5" />
              </Button>
              <Button className="size-7" onClick={() => onDelete(model.id)} size="icon" variant="ghost" data-testid="platform-official-staff-delete-button">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ArrowDownToLine className="size-4 text-muted-foreground" />
              {t("officialStaff.assign.fallbackStrategy")}
            </div>
            <Select
              disabled={!editable}
              onOpenChange={(open) => onFloatingOpenChange(open ? `dynamic-order-${model.id}` : null)}
              onValueChange={(value) => {
                onFloatingOpenChange(null);
                onUpdate({
                  ...model,
                  aggregate_config: {
                    ...model.aggregate_config,
                    strategy_config: {
                      ...model.aggregate_config.strategy_config,
                      order: value as typeof order,
                    },
                  },
                });
              }}
              open={openFloatingId === `dynamic-order-${model.id}`}
              value={order}
            >
              <SelectTrigger className="h-8 w-32 text-xs" data-testid="platform-official-staff-select-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent data-testid="platform-official-staff-select-content">
                <SelectItem value={staffOrderDirection.asc} data-testid="platform-official-staff-option">{t("officialStaff.assign.orderAsc")}</SelectItem>
                <SelectItem value={staffOrderDirection.desc} data-testid="platform-official-staff-option">{t("officialStaff.assign.orderDesc")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {model.aggregate_config.models.length === 0 ? (
              subModelDropIndicator ? (
                <DropIndicatorModelPreview activeDragData={activeDragData} dense />
              ) : (
                <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                  {t("officialStaff.assign.noSubModels")}
                </div>
              )
            ) : (
              <SortableContext
                items={model.aggregate_config.models.map((subModel) => `${model.id}:${subModel.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {model.aggregate_config.models.map((subModel) => (
                  <div className="space-y-2" data-staff-sub-model-id={subModel.id} key={subModel.id}>
                    {subModelDropIndicator?.modelId === subModel.id &&
                    subModelDropIndicator.position === "before" ? (
                      <DropIndicatorModelPreview activeDragData={activeDragData} dense />
                    ) : null}
                    <SubModelRow
                      category={category}
                      dynamicId={model.id}
                      editable={editable}
                      onDelete={(subModelId) => onDeleteSubModel(model.id, subModelId)}
                      parentGroupId={parentGroupId}
                      subModel={subModel}
                    />
                    {subModelDropIndicator?.modelId === subModel.id &&
                    subModelDropIndicator.position === "after" ? (
                      <DropIndicatorModelPreview activeDragData={activeDragData} dense />
                    ) : null}
                  </div>
                ))}
                {subModelDropIndicator?.position === "end" ? (
                  <DropIndicatorModelPreview activeDragData={activeDragData} dense />
                ) : null}
              </SortableContext>
            )}
          </div>
        </div>
      </div>
      <DynamicModelEditDialog
        canEdit={editable}
        model={model}
        onOpenChange={setEditOpen}
        onSave={onUpdate}
        open={editOpen}
      />
    </div>
  );
}
