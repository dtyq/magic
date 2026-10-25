import { closestCenter, pointerWithin, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { staffModelType, type OfficialStaffDetail, type OfficialStaffGroup, type OfficialStaffModelOption, type StaffBaseModel, type StaffDynamicModel, type StaffModelCategory, type StaffModelItem } from "@magic-admin-v2/features/platform-official-staff/types";
import { type Language as LanguageCode } from "@magic-admin-v2/i18n/resources";

export const dynamicModelId = "dynamic";
export type DynamicModelLocale = LanguageCode;

export type DragPreviewMeta = {
  icon?: string;
  subtitle?: string;
  title: string;
  type?: "group" | "model";
};

export type DragPoint = {
  x: number;
  y: number;
};

export type DropInsertPosition = "before" | "after" | "end";

export type DropIndicator =
  | {
      groupId: string;
      modelId?: string;
      position: DropInsertPosition;
      targetType?: "dynamic" | "model";
      type: "group-model";
    }
  | {
      category?: StaffModelCategory;
      dynamicId: string;
      groupId: string;
      modelId?: string;
      position: DropInsertPosition;
      type: "dynamic-sub-model";
    };

export const staffDragType = {
  dynamic: "dynamic",
  dynamicContainer: "dynamic-container",
  group: "group",
  groupContainer: "group-container",
  leftModel: "left-model",
  model: "model",
  subModel: "sub-model",
} as const;

export type StaffDragData =
  | {
      groupId: string;
      item: OfficialStaffGroup;
      type: typeof staffDragType.group;
    }
  | {
      groupId: string;
      type: typeof staffDragType.groupContainer;
    }
  | {
      groupId: string;
      category?: StaffModelCategory;
      item: StaffModelItem;
      type: typeof staffDragType.model | typeof staffDragType.dynamic;
    }
  | {
      dynamicId: string;
      groupId: string;
      item: StaffDynamicModel;
      type: typeof staffDragType.dynamicContainer;
    }
  | {
      category?: StaffModelCategory;
      dynamicId: string;
      groupId: string;
      item: StaffBaseModel;
      type: typeof staffDragType.subModel;
    }
  | {
      category?: StaffModelCategory;
      item: OfficialStaffModelOption;
      type: typeof staffDragType.leftModel;
    };

export function getCategoryModels(
  entry: OfficialStaffDetail["groups"][number],
  category: StaffModelCategory,
) {
  const field = category === "text" ? "text_models" : category === "image" ? "image_models" : "video_models";
  return entry[field];
}

export type DropTarget =
  | { groupId: string; type: typeof staffDragType.groupContainer }
  | { groupId: string; targetGroupId: string; type: typeof staffDragType.group }
  | {
      groupId: string;
      insertAfter?: boolean;
      modelId: string;
      type: typeof staffDragType.model | typeof staffDragType.dynamic;
    }
  | { dynamicId: string; groupId: string; type: typeof staffDragType.dynamicContainer }
  | {
      dynamicId: string;
      groupId: string;
      insertAfter?: boolean;
      modelId: string;
      type: typeof staffDragType.subModel;
    };

export function isDynamicModel(model: StaffModelItem): model is StaffDynamicModel {
  return "model_type" in model && model.model_type === staffModelType.dynamic;
}

export function isDynamicModelOption(model: OfficialStaffModelOption) {
  return model.id === dynamicModelId || model.model_id === dynamicModelId;
}

export function getDroppableData(
  droppableContainers: Parameters<CollisionDetection>[0]["droppableContainers"],
  id: unknown,
) {
  return droppableContainers.find((container) => container.id === id)?.data.current as
    | StaffDragData
    | undefined;
}

export function canDragIntoDynamicModel(data?: StaffDragData) {
  if (!data) return false;
  if (data.type === staffDragType.leftModel) return !isDynamicModelOption(data.item);
  if (data.type === staffDragType.model) return !isDynamicModel(data.item);
  return data.type === staffDragType.subModel;
}

export const staffCollisionDetection: CollisionDetection = (args) => {
  const activeData = args.active.data.current as StaffDragData | undefined;
  const activeType = activeData?.type;

  if (activeType === staffDragType.group) {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) =>
          (container.data.current as StaffDragData | undefined)?.type === staffDragType.group,
      ),
    });
  }

  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    if (canDragIntoDynamicModel(activeData)) {
      const dynamicCollisionIds = pointerCollisions
        .filter((collision) => {
          const data = getDroppableData(args.droppableContainers, collision.id);
          return data?.type === staffDragType.subModel || data?.type === staffDragType.dynamicContainer;
        })
        .map((collision) => collision.id);

      if (dynamicCollisionIds.length > 0) {
        const dynamicIdSet = new Set(dynamicCollisionIds);
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((container) =>
            dynamicIdSet.has(container.id),
          ),
        });
      }
    }

    const itemCollisionIds = pointerCollisions
      .filter((collision) => {
        const data = getDroppableData(args.droppableContainers, collision.id);
        return (
          data?.type === staffDragType.model ||
          data?.type === staffDragType.dynamic ||
          data?.type === staffDragType.subModel
        );
      })
      .map((collision) => collision.id);

    if (itemCollisionIds.length > 0) {
      const itemIdSet = new Set(itemCollisionIds);
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) =>
          itemIdSet.has(container.id),
        ),
      });
    }

    const containerCollisionIds = pointerCollisions
      .filter((collision) => {
        const data = getDroppableData(args.droppableContainers, collision.id);
        return (
          data?.type === staffDragType.groupContainer ||
          data?.type === staffDragType.dynamicContainer
        );
      })
      .map((collision) => collision.id);

    if (containerCollisionIds.length > 0) {
      const containerIdSet = new Set(containerCollisionIds);
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) =>
          containerIdSet.has(container.id),
        ),
      });
    }
  }

  return closestCenter(args);
};


export function getDragData(event: DragStartEvent | DragEndEvent): StaffDragData | null {
  return (event.active.data.current as StaffDragData | undefined) ?? null;
}

export function getDropTarget(event: DragEndEvent, dropIndicator: DropIndicator | null): DropTarget | null {
  const overData = event.over?.data.current as StaffDragData | undefined;
  if (!overData) return null;

  if (dropIndicator?.type === "group-model" && dropIndicator.modelId && dropIndicator.position !== "end") {
    return {
      groupId: dropIndicator.groupId,
      insertAfter: dropIndicator.position === "after",
      modelId: dropIndicator.modelId,
      type: dropIndicator.targetType === "dynamic" ? staffDragType.dynamic : staffDragType.model,
    };
  }

  if (dropIndicator?.type === "dynamic-sub-model" && dropIndicator.modelId && dropIndicator.position !== "end") {
    return {
      dynamicId: dropIndicator.dynamicId,
      groupId: dropIndicator.groupId,
      insertAfter: dropIndicator.position === "after",
      modelId: dropIndicator.modelId,
      type: staffDragType.subModel,
    };
  }

  if (overData.type === staffDragType.group) {
    return {
      groupId: overData.groupId,
      targetGroupId: overData.groupId,
      type: staffDragType.group,
    };
  }
  if (overData.type === staffDragType.groupContainer) {
    return { groupId: overData.groupId, type: staffDragType.groupContainer };
  }
  if (overData.type === staffDragType.model || overData.type === staffDragType.dynamic) {
    return {
      groupId: overData.groupId,
      insertAfter:
        dropIndicator?.type === "group-model" &&
        dropIndicator.groupId === overData.groupId &&
        dropIndicator.modelId === overData.item.id
          ? dropIndicator.position === "after"
          : undefined,
      modelId: overData.item.id,
      type: overData.type,
    };
  }
  if (overData.type === staffDragType.dynamicContainer) {
    return {
      dynamicId: overData.dynamicId,
      groupId: overData.groupId,
      type: staffDragType.dynamicContainer,
    };
  }
  if (overData.type === staffDragType.subModel) {
    return {
      dynamicId: overData.dynamicId,
      groupId: overData.groupId,
      insertAfter:
        dropIndicator?.type === "dynamic-sub-model" &&
        dropIndicator.dynamicId === overData.dynamicId &&
        dropIndicator.modelId === overData.item.id
          ? dropIndicator.position === "after"
          : undefined,
      modelId: overData.item.id,
      type: staffDragType.subModel,
    };
  }
  return null;
}

export function getInsertPosition(event: DragOverEvent, pointerPoint?: DragPoint | null) {
  const translated = event.active.rect.current.translated;
  const over = event.over;
  if (!translated || !over) return "before" satisfies DropInsertPosition;

  const activeReferenceY = pointerPoint?.y ?? translated.top + Math.min(16, translated.height * 0.35);
  const overCenterY = over.rect.top + over.rect.height / 2;
  return activeReferenceY > overCenterY
    ? ("after" satisfies DropInsertPosition)
    : ("before" satisfies DropInsertPosition);
}

export function getActiveReferencePoint(event: DragOverEvent, pointerPoint?: DragPoint | null) {
  if (pointerPoint) return pointerPoint;

  const translated = event.active.rect.current.translated;
  if (!translated) return null;

  return {
    x: translated.left + Math.min(20, translated.width / 2),
    y: translated.top + Math.min(16, translated.height * 0.35),
  };
}

export function getContainerEdgePosition(event: DragOverEvent, pointerPoint?: DragPoint | null): "end" | "start" | null {
  const over = event.over;
  const point = getActiveReferencePoint(event, pointerPoint);
  if (!point || !over) return null;

  const edgeThreshold = Math.min(72, over.rect.height * 0.28);
  if (point.y <= over.rect.top + edgeThreshold) return "start";
  if (point.y >= over.rect.bottom - edgeThreshold) return "end";
  return null;
}

export function getModelElementInGroup(groupElement: HTMLElement, modelId: string) {
  return Array.from(groupElement.querySelectorAll<HTMLElement>("[data-staff-model-id]")).find(
    (element) => element.dataset.staffModelId === modelId,
  );
}

export function isPointInElement(point: DragPoint, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return point.y >= rect.top && point.y <= rect.bottom && point.x >= rect.left - 80 && point.x <= rect.right + 80;
}

export function getSubModelElement(dynamicElement: HTMLElement, subModelId: string) {
  return Array.from(dynamicElement.querySelectorAll<HTMLElement>("[data-staff-sub-model-id]")).find(
    (element) => element.dataset.staffSubModelId === subModelId,
  );
}

export function getDynamicSubModelLayoutDropIndicator(
  event: DragOverEvent,
  detail: OfficialStaffDetail | null,
  activeData: StaffDragData,
  category: StaffModelCategory,
  pointerPoint?: DragPoint | null,
): DropIndicator | null | undefined {
  if (!detail || !canDragIntoDynamicModel(activeData)) return undefined;

  const point = getActiveReferencePoint(event, pointerPoint);
  if (!point || typeof document === "undefined") return undefined;

  const dynamicElement = Array.from(document.querySelectorAll<HTMLElement>("[data-staff-dynamic-drop-id]")).find(
    (element) => isPointInElement(point, element),
  );
  if (!dynamicElement) return undefined;

  const dynamicId = dynamicElement.dataset.staffDynamicDropId;
  const groupId = dynamicElement.dataset.staffDynamicGroupId;
  if (!dynamicId || !groupId) return undefined;

  const dynamicModel = detail.groups
    .find((entry) => entry.group.id === groupId)
    ? getCategoryModels(detail.groups.find((entry) => entry.group.id === groupId)!, category).find((model): model is StaffDynamicModel => isDynamicModel(model) && model.id === dynamicId)
    : undefined;
  if (!dynamicModel) return undefined;

  if (dynamicModel.aggregate_config.models.length === 0) {
    return {
      dynamicId,
      groupId,
      position: "end",
      type: "dynamic-sub-model",
    };
  }

  for (const subModel of dynamicModel.aggregate_config.models) {
    const subModelElement = getSubModelElement(dynamicElement, subModel.id);
    if (!subModelElement) continue;
    const rect = subModelElement.getBoundingClientRect();
    if (point.y <= rect.top + rect.height / 2) {
      if (
        activeData.type === staffDragType.subModel &&
        activeData.dynamicId === dynamicId &&
        activeData.groupId === groupId &&
        activeData.item.id === subModel.id
      ) {
        return null;
      }

      return {
        dynamicId,
        groupId,
        modelId: subModel.id,
        position: "before",
        type: "dynamic-sub-model",
      };
    }
  }

  const lastSubModel = dynamicModel.aggregate_config.models.at(-1);
  if (!lastSubModel) return undefined;
  if (
    activeData.type === staffDragType.subModel &&
    activeData.dynamicId === dynamicId &&
    activeData.groupId === groupId &&
    activeData.item.id === lastSubModel.id
  ) {
    return null;
  }

  return {
    dynamicId,
    groupId,
    modelId: lastSubModel.id,
    position: "after",
    type: "dynamic-sub-model",
  };
}

export function getGroupModelLayoutDropIndicator(
  event: DragOverEvent,
  detail: OfficialStaffDetail | null,
  activeData: StaffDragData,
  category: StaffModelCategory,
  pointerPoint?: DragPoint | null,
): DropIndicator | null | undefined {
  if (!detail) return undefined;
  if (
    activeData.type !== staffDragType.leftModel &&
    activeData.type !== staffDragType.model &&
    activeData.type !== staffDragType.dynamic
  ) {
    return undefined;
  }

  const point = getActiveReferencePoint(event, pointerPoint);
  if (!point || typeof document === "undefined") return undefined;

  const groupElements = Array.from(document.querySelectorAll<HTMLElement>("[data-staff-drop-group-id]"));
  const groupElement = groupElements.find((element) => {
    const rect = element.getBoundingClientRect();
    return (
      point.y >= rect.top &&
      point.y <= rect.bottom &&
      point.x >= rect.left - 80 &&
      point.x <= rect.right + 80
    );
  });
  if (!groupElement) return undefined;

  const groupId = groupElement.dataset.staffDropGroupId;
  const group = detail.groups.find((entry) => entry.group.id === groupId);
  if (!group || !groupId) return undefined;

  const groupModels = getCategoryModels(group, category);
  if (groupModels.length === 0) {
    return {
      groupId,
      position: "end",
      type: "group-model",
    };
  }

  for (const model of groupModels) {
    const modelElement = getModelElementInGroup(groupElement, model.id);
    if (!modelElement) continue;
    const rect = modelElement.getBoundingClientRect();
    if (point.y <= rect.top + rect.height / 2) {
      if (
        (activeData.type === staffDragType.model || activeData.type === staffDragType.dynamic) &&
        activeData.groupId === groupId &&
        activeData.item.id === model.id
      ) {
        return null;
      }

      return {
        groupId,
        modelId: model.id,
        position: "before",
        targetType: isDynamicModel(model) ? "dynamic" : "model",
        type: "group-model",
      };
    }
  }

  const lastModel = groupModels.at(-1);
  if (!lastModel) return undefined;
  if (
    (activeData.type === staffDragType.model || activeData.type === staffDragType.dynamic) &&
    activeData.groupId === groupId &&
    activeData.item.id === lastModel.id
  ) {
    return null;
  }

  return {
    groupId,
    modelId: lastModel.id,
    position: "after",
    targetType: isDynamicModel(lastModel) ? "dynamic" : "model",
    type: "group-model",
  };
}

export function getDropIndicator(
  event: DragOverEvent,
  detail: OfficialStaffDetail | null,
  category: StaffModelCategory,
  pointerPoint?: DragPoint | null,
): DropIndicator | null {
  const activeData = event.active.data.current as StaffDragData | undefined;
  const overData = event.over?.data.current as StaffDragData | undefined;
  if (!activeData || !overData) return null;
  if (activeData.type === staffDragType.group) return null;

  if ("category" in activeData && activeData.category && activeData.category !== category) return null;
  const dynamicLayoutIndicator = getDynamicSubModelLayoutDropIndicator(event, detail, activeData, category, pointerPoint);
  if (dynamicLayoutIndicator !== undefined) return dynamicLayoutIndicator;

  const layoutIndicator = getGroupModelLayoutDropIndicator(event, detail, activeData, category, pointerPoint);
  if (layoutIndicator !== undefined) return layoutIndicator;

  if (overData.type === staffDragType.groupContainer) {
    const group = detail?.groups.find((entry) => entry.group.id === overData.groupId);
    const groupModels = group ? getCategoryModels(group, category) : [];
    const firstModel = groupModels[0];
    const lastModel = groupModels.at(-1);
    const edgePosition = getContainerEdgePosition(event, pointerPoint);
    if (
      firstModel &&
      edgePosition === "start" &&
      !(
        (activeData.type === staffDragType.model || activeData.type === staffDragType.dynamic) &&
        activeData.groupId === overData.groupId &&
        activeData.item.id === firstModel.id
      )
    ) {
      return {
        groupId: overData.groupId,
        modelId: firstModel.id,
        position: "before",
        targetType: isDynamicModel(firstModel) ? "dynamic" : "model",
        type: "group-model",
      };
    }

    if (
      lastModel &&
      edgePosition === "end" &&
      !(
        (activeData.type === staffDragType.model || activeData.type === staffDragType.dynamic) &&
        activeData.groupId === overData.groupId &&
        activeData.item.id === lastModel.id
      )
    ) {
      return {
        groupId: overData.groupId,
        modelId: lastModel.id,
        position: "after",
        targetType: isDynamicModel(lastModel) ? "dynamic" : "model",
        type: "group-model",
      };
    }

    if (group && groupModels.length > 0) return null;

    return {
      groupId: overData.groupId,
      position: "end",
      type: "group-model",
    };
  }

  if (overData.type === staffDragType.model || overData.type === staffDragType.dynamic) {
    if (
      (activeData.type === staffDragType.model || activeData.type === staffDragType.dynamic) &&
      activeData.item.id === overData.item.id
    ) {
      return null;
    }

    return {
      groupId: overData.groupId,
      modelId: overData.item.id,
      position: getInsertPosition(event, pointerPoint),
      targetType: overData.type,
      type: "group-model",
    };
  }

  if (overData.type === staffDragType.dynamicContainer) {
    if (
      activeData.type === staffDragType.dynamic ||
      (activeData.type === staffDragType.leftModel && isDynamicModelOption(activeData.item))
    ) {
      return null;
    }

    const group = detail?.groups.find((entry) => entry.group.id === overData.groupId);
    const dynamicModel = group ? getCategoryModels(group, category).find(
      (model): model is StaffDynamicModel => isDynamicModel(model) && model.id === overData.dynamicId,
    ) : undefined;
    const firstSubModel = dynamicModel?.aggregate_config.models[0];
    const lastSubModel = dynamicModel?.aggregate_config.models.at(-1);
    const edgePosition = getContainerEdgePosition(event, pointerPoint);
    if (
      firstSubModel &&
      edgePosition === "start" &&
      !(
        activeData.type === staffDragType.subModel &&
        activeData.groupId === overData.groupId &&
        activeData.dynamicId === overData.dynamicId &&
        activeData.item.id === firstSubModel.id
      )
    ) {
      return {
        dynamicId: overData.dynamicId,
        groupId: overData.groupId,
        modelId: firstSubModel.id,
        position: "before",
        type: "dynamic-sub-model",
      };
    }

    if (
      lastSubModel &&
      edgePosition === "end" &&
      !(
        activeData.type === staffDragType.subModel &&
        activeData.groupId === overData.groupId &&
        activeData.dynamicId === overData.dynamicId &&
        activeData.item.id === lastSubModel.id
      )
    ) {
      return {
        dynamicId: overData.dynamicId,
        groupId: overData.groupId,
        modelId: lastSubModel.id,
        position: "after",
        type: "dynamic-sub-model",
      };
    }

    if (dynamicModel && dynamicModel.aggregate_config.models.length > 0) return null;

    return {
      dynamicId: overData.dynamicId,
      groupId: overData.groupId,
      position: "end",
      type: "dynamic-sub-model",
    };
  }

  if (overData.type === staffDragType.subModel) {
    if (activeData.type === staffDragType.subModel && activeData.item.id === overData.item.id) {
      return null;
    }
    if (activeData.type === staffDragType.dynamic) return null;
    if (activeData.type === staffDragType.leftModel && isDynamicModelOption(activeData.item)) return null;

    return {
      dynamicId: overData.dynamicId,
      groupId: overData.groupId,
      modelId: overData.item.id,
      position: getInsertPosition(event, pointerPoint),
      type: "dynamic-sub-model",
    };
  }

  return null;
}
