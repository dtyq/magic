import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { arrayMove } from "@dnd-kit/sortable";
import { PointerSensor, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import type { OfficialStaffDetail, OfficialStaffModelOption, StaffBaseModel, StaffDynamicModel, StaffModelCategory, StaffModelItem } from "@magic-admin-v2/features/platform-official-staff/types";
import { canAddToDynamicModelCategory, getCategoryModels, getDragData, getDropIndicator, getDropTarget, insertModelIntoDynamic, insertModelIntoGroup, isDynamicModel, isDynamicModelOption, reindexModels, reindexSubModels, removeModelFromGroups, staffDragType, updateCategoryModels, type AddModelTarget, type DropIndicator, type DropTarget, type StaffDragData } from "@magic-admin-v2/features/platform-official-staff/utils/page-utils";
import { useTranslation } from "react-i18next";

export type UseAssignmentDndOptions = {
  canEdit: boolean;
  category: StaffModelCategory;
  detail: OfficialStaffDetail | null;
  editable: boolean;
  open: boolean;
  onAddModel: (option: OfficialStaffModelOption, target: AddModelTarget) => void;
  onFloatingOpenChange: (id: string | null) => void;
  setDetail: Dispatch<SetStateAction<OfficialStaffDetail | null>>;
};

export function useAssignmentDnd({
  canEdit,
  category,
  detail,
  editable,
  open,
  onAddModel,
  onFloatingOpenChange,
  setDetail,
}: UseAssignmentDndOptions) {
  const { t } = useTranslation();
  const [activeDragData, setActiveDragData] = useState<StaffDragData | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  );

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerMove = (event: PointerEvent) => {
      dragPointerRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [open]);

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEdit) return;
    onFloatingOpenChange(null);
    setActiveDragData(getDragData(event));
    setDropIndicator(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!canEdit) return;
    setDropIndicator(getDropIndicator(event, detail, category, dragPointerRef.current));
  };

  const handleDragCancel = () => {
    setActiveDragData(null);
    setDropIndicator(null);
    dragPointerRef.current = null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeData = getDragData(event);
    const target = getDropTarget(event, dropIndicator);
    setActiveDragData(null);
    setDropIndicator(null);
    dragPointerRef.current = null;
    if (!canEdit || !detail || !editable || !activeData || !target) return;
    if ((activeData.type === staffDragType.leftModel || activeData.type === staffDragType.model || activeData.type === staffDragType.dynamic || activeData.type === staffDragType.subModel) && "category" in activeData && activeData.category && activeData.category !== category) return;

    if (activeData.type === staffDragType.group) {
      if (target.type !== staffDragType.group || activeData.groupId === target.targetGroupId) return;
      setDetail((current) => {
        if (!current) return current;
        const fromIndex = current.groups.findIndex((entry) => entry.group.id === activeData.groupId);
        const toIndex = current.groups.findIndex((entry) => entry.group.id === target.targetGroupId);
        return {
          ...current,
          groups: fromIndex >= 0 && toIndex >= 0 ? arrayMove(current.groups, fromIndex, toIndex) : current.groups,
        };
      });
      return;
    }

    if (activeData.type === staffDragType.leftModel) {
      if (target.type === staffDragType.dynamic && !isDynamicModelOption(activeData.item)) {
        onAddModel(activeData.item, {
          dynamicId: target.modelId,
          groupId: target.groupId,
        });
        return;
      }
      if (target.type === staffDragType.dynamicContainer || target.type === staffDragType.subModel) {
        onAddModel(activeData.item, {
          beforeSubModelId: target.type === staffDragType.subModel ? target.modelId : undefined,
          dynamicId: target.dynamicId,
          groupId: target.groupId,
          insertAfter: target.type === staffDragType.subModel ? target.insertAfter : undefined,
        });
        return;
      }
      onAddModel(activeData.item, {
        beforeModelId:
          target.type === staffDragType.model || target.type === staffDragType.dynamic ? target.modelId : undefined,
        groupId: target.groupId,
        insertAfter:
          target.type === staffDragType.model || target.type === staffDragType.dynamic
            ? target.insertAfter
            : undefined,
      });
      return;
    }

    if (
      activeData.type !== staffDragType.model &&
      activeData.type !== staffDragType.dynamic &&
      activeData.type !== staffDragType.subModel
    ) {
      return;
    }

    setDetail((current) => {
      if (!current) return current;
      if (
        (activeData.type === staffDragType.model || activeData.type === staffDragType.dynamic) &&
        (target.type === staffDragType.model || target.type === staffDragType.dynamic) &&
        activeData.groupId === target.groupId
      ) {
        if (activeData.item.id === target.modelId) return current;
        return {
          ...current,
          groups: current.groups.map((entry) => {
            if (entry.group.id !== activeData.groupId) return entry;
            const models = getCategoryModels(entry, category);
            const fromIndex = models.findIndex((model) => model.id === activeData.item.id);
            const toIndex = models.findIndex((model) => model.id === target.modelId);
            return {
              ...updateCategoryModels(entry, category,
                fromIndex >= 0 && toIndex >= 0
                  ? reindexModels(arrayMove(models, fromIndex, toIndex))
                  : models),
            };
          }),
        };
      }

      if (
        activeData.type === staffDragType.subModel &&
        target.type === staffDragType.subModel &&
        activeData.groupId === target.groupId &&
        activeData.dynamicId === target.dynamicId
      ) {
        if (activeData.item.id === target.modelId) return current;
        return {
          ...current,
          groups: current.groups.map((entry) => {
            if (entry.group.id !== activeData.groupId) return entry;
            return {
              ...entry,
              [category === "text" ? "text_models" : category === "image" ? "image_models" : "video_models"]: getCategoryModels(entry, category).map((model) => {
                if (!isDynamicModel(model) || model.id !== activeData.dynamicId) return model;
                const fromIndex = model.aggregate_config.models.findIndex((subModel) => subModel.id === activeData.item.id);
                const toIndex = model.aggregate_config.models.findIndex((subModel) => subModel.id === target.modelId);
                return {
                  ...model,
                  aggregate_config: {
                    ...model.aggregate_config,
                    models:
                      fromIndex >= 0 && toIndex >= 0
                        ? reindexSubModels(
                            arrayMove(model.aggregate_config.models, fromIndex, toIndex),
                            entry.group.id,
                          )
                        : model.aggregate_config.models,
                  },
                };
              }),
            };
          }),
        };
      }

      const effectiveTarget =
        activeData.type === staffDragType.dynamic &&
        (target.type === staffDragType.dynamicContainer || target.type === staffDragType.subModel)
          ? {
              groupId: target.groupId,
              modelId: target.dynamicId,
              type: staffDragType.dynamic,
            } satisfies DropTarget
          : target.type === staffDragType.dynamic && activeData.type !== staffDragType.dynamic
            ? {
                dynamicId: target.modelId,
                groupId: target.groupId,
                type: staffDragType.dynamicContainer,
              } satisfies DropTarget
            : target;
      const { groups: groupsAfterRemoval, removed } = removeModelFromGroups(current.groups, activeData, category);
      if (!removed) return current;

      if (effectiveTarget.type === staffDragType.dynamicContainer || effectiveTarget.type === staffDragType.subModel) {
        if (isDynamicModel(removed as StaffModelItem)) {
          toast.error(t("officialStaff.error.dynamicNested"));
          return current;
        }

        const targetGroup = groupsAfterRemoval.find((entry) => entry.group.id === effectiveTarget.groupId);
        const targetDynamic = targetGroup
          ? getCategoryModels(targetGroup, category).find((model): model is StaffDynamicModel => isDynamicModel(model) && model.id === effectiveTarget.dynamicId)
          : undefined;
        if (!targetDynamic) return current;
        const baseModel = removed as StaffBaseModel;
        if (!canAddToDynamicModelCategory(baseModel.model_category)) {
          toast.error(t("officialStaff.error.dynamicModelUnsupportedCategory"));
          return current;
        }
        if (baseModel.model_category && targetDynamic.model_category && baseModel.model_category !== targetDynamic.model_category) {
          toast.error(t("officialStaff.error.modelCategoryMismatch"));
          return current;
        }
        if (targetDynamic.aggregate_config.models.some((model) => model.model_id === baseModel.model_id)) {
          toast.error(t("officialStaff.error.modelExistsInDynamic"));
          return current;
        }

        return {
          ...current,
          groups: insertModelIntoDynamic(groupsAfterRemoval, baseModel, effectiveTarget, category),
        };
      }

      const targetGroupId = effectiveTarget.groupId;
      const movingModel = removed as StaffModelItem;
      const targetGroup = groupsAfterRemoval.find((entry) => entry.group.id === targetGroupId);
      if (
        targetGroup &&
        !isDynamicModel(movingModel) &&
        getCategoryModels(targetGroup, category).some((model) => !isDynamicModel(model) && model.model_id === movingModel.model_id)
      ) {
        toast.error(t("officialStaff.error.modelExistsInGroup"));
        return current;
      }

      return {
        ...current,
        groups: insertModelIntoGroup(groupsAfterRemoval, movingModel, effectiveTarget, category),
      };
    });
  };

  return {
    activeDragData,
    dropIndicator,
    handleDragCancel,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    sensors,
  };
}
