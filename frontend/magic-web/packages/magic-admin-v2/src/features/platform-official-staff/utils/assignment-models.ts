import { staffModelStatus, staffModelType, staffOrderDirection, staffStrategyType, type OfficialStaffDetail, type OfficialStaffModelOption, type StaffBaseModel, type StaffDynamicModel, type StaffModelCategory, type StaffModelCategoryField, type StaffModelItem } from "@magic-admin-v2/features/platform-official-staff/types";
import { getCategoryModels, isDynamicModel, isDynamicModelOption, type DropTarget, type StaffDragData, staffDragType } from "@magic-admin-v2/features/platform-official-staff/utils/assignment-dnd";

export { getCategoryModels, isDynamicModel, isDynamicModelOption } from "@magic-admin-v2/features/platform-official-staff/utils/assignment-dnd";

// Same bundled SVG as old admin. Keep it local so icons are not tenant-private object-storage URLs.
export const dynamicModelIcon = new URL(
  "../../../assets/logos/dynamic-model-logo.svg",
  import.meta.url,
).href;

export type AddModelTarget = {
  beforeModelId?: string;
  beforeSubModelId?: string;
  dynamicId?: string;
  groupId: string;
  insertAfter?: boolean;
};

export type AddModelToDetailResult =
  | {
      detail: OfficialStaffDetail;
      status: "success";
    }
  | {
      error:
        | "dynamicNested"
        | "dynamicModelUnsupportedCategory"
        | "modelExistsInDynamic"
        | "modelExistsInGroup";
      status: "blocked";
    }
  | {
      status: "unchanged";
    };

export function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
export function canAddToDynamicModelCategory(category?: string | null) {
  return category?.toLowerCase() === "llm";
}

export function createBaseModel(
  option: OfficialStaffModelOption,
  groupId: string,
  sort: number,
): StaffBaseModel {
  return {
    group_id: groupId,
    id: createLocalId("model"),
    model_category: option.category,
    model_icon: option.icon,
    model_id: option.model_id,
    model_name: option.name || option.model_id,
    model_status: staffModelStatus.normal,
    provider_model_id: option.service_provider_config_id || option.id,
    sort,
  };
}

export function createDynamicModel(groupId: string, sort: number): StaffDynamicModel {
  return {
    aggregate_config: {
      models: [],
      strategy: staffStrategyType.permissionFallback,
      strategy_config: {
        order: staffOrderDirection.asc,
      },
    },
    group_id: groupId,
    id: createLocalId(staffModelType.dynamic),
    model_category: "llm",
    model_description: "可配置动态模型及降级规则",
    model_icon: dynamicModelIcon,
    model_id: "",
    model_name: "动态模型",
    model_translate: {
      description: {
        zh_CN: "可配置动态模型及降级规则",
        en_US: "Configure dynamic model fallback rules.",
      },
      name: {
        zh_CN: "动态模型",
        en_US: "Dynamic model",
      },
    },
    model_type: staffModelType.dynamic,
    provider_model_id: "0",
    sort,
  };
}

export function addModelToDetail(
  detail: OfficialStaffDetail,
  option: OfficialStaffModelOption,
  target: AddModelTarget,
  category: StaffModelCategory,
): AddModelToDetailResult {
  const groupIndex = detail.groups.findIndex((entry) => entry.group.id === target.groupId);
  if (groupIndex < 0) return { status: "unchanged" };

  const entry = detail.groups[groupIndex];
  const models = getCategoryModels(entry, category);
  let nextModels: StaffModelItem[];

  if (target.dynamicId) {
    if (isDynamicModelOption(option)) {
      return { error: "dynamicNested", status: "blocked" };
    }
    if (!canAddToDynamicModelCategory(option.category)) {
      return { error: "dynamicModelUnsupportedCategory", status: "blocked" };
    }

    const dynamicIndex = models.findIndex(
      (model) => isDynamicModel(model) && model.id === target.dynamicId,
    );
    if (dynamicIndex < 0) return { status: "unchanged" };

    const dynamicModel = models[dynamicIndex] as StaffDynamicModel;
    if (
      dynamicModel.aggregate_config.models.some(
        (subModel) => subModel.model_id === option.model_id,
      )
    ) {
      return { error: "modelExistsInDynamic", status: "blocked" };
    }

    const nextSubModels = [...dynamicModel.aggregate_config.models];
    const insertIndex = target.beforeSubModelId
      ? nextSubModels.findIndex((subModel) => subModel.id === target.beforeSubModelId)
      : -1;
    const normalizedInsertIndex =
      insertIndex >= 0 && target.insertAfter ? insertIndex + 1 : insertIndex;
    nextSubModels.splice(
      normalizedInsertIndex >= 0 ? normalizedInsertIndex : nextSubModels.length,
      0,
      createBaseModel(option, entry.group.id, nextSubModels.length),
    );
    nextModels = [...models];
    nextModels[dynamicIndex] = {
      ...dynamicModel,
      aggregate_config: {
        ...dynamicModel.aggregate_config,
        models: nextSubModels,
      },
    };
  } else {
    nextModels = [...models];
    const insertIndex = target.beforeModelId
      ? nextModels.findIndex((model) => model.id === target.beforeModelId)
      : -1;
    const normalizedInsertIndex =
      insertIndex >= 0 && target.insertAfter ? insertIndex + 1 : insertIndex;

    if (isDynamicModelOption(option)) {
      nextModels.splice(
        normalizedInsertIndex >= 0 ? normalizedInsertIndex : nextModels.length,
        0,
        createDynamicModel(entry.group.id, nextModels.length),
      );
    } else {
      if (
        models.some(
          (model) => !isDynamicModel(model) && model.model_id === option.model_id,
        )
      ) {
        return { error: "modelExistsInGroup", status: "blocked" };
      }
      nextModels.splice(
        normalizedInsertIndex >= 0 ? normalizedInsertIndex : nextModels.length,
        0,
        createBaseModel(option, entry.group.id, nextModels.length),
      );
    }
  }

  const nextGroups = [...detail.groups];
  nextGroups[groupIndex] = updateCategoryModels(entry, category, nextModels);
  return {
    detail: { ...detail, groups: nextGroups },
    status: "success",
  };
}

export const staffModelCategoryConfig: Record<StaffModelCategory, {
  backendCategory: "llm" | "vlm" | "vgm";
  field: StaffModelCategoryField;
}> = {
  text: { backendCategory: "llm", field: "text_models" },
  image: { backendCategory: "vlm", field: "image_models" },
  video: { backendCategory: "vgm", field: "video_models" },
};

export function updateCategoryModels(
  entry: OfficialStaffDetail["groups"][number],
  category: StaffModelCategory,
  models: StaffModelItem[],
) {
  return { ...entry, [staffModelCategoryConfig[category].field]: models };
}

export function normalizeDetailForSave(detail: OfficialStaffDetail): OfficialStaffDetail {
  return {
    mode: detail.mode,
    groups: detail.groups.map((entry) => ({
      group: entry.group,
      text_models: normalizeModels(entry.text_models, entry.group.id),
      image_models: normalizeModels(entry.image_models, entry.group.id),
      video_models: normalizeModels(entry.video_models, entry.group.id),
    })),
  };
}

/** Normalize older responses that only populated the legacy mixed `models` field. */
export function normalizeDetailFromResponse(detail: OfficialStaffDetail): OfficialStaffDetail {
  return {
    ...detail,
    groups: detail.groups.map((entry) => {
      const legacyModels = entry.models ?? [];
      return {
        group: entry.group,
        text_models: entry.text_models ?? legacyModels.filter((model) => model.model_category?.toLowerCase() === "llm"),
        image_models: entry.image_models ?? legacyModels.filter((model) => model.model_category?.toLowerCase() === "vlm"),
        video_models: entry.video_models ?? legacyModels.filter((model) => model.model_category?.toLowerCase() === "vgm"),
      };
    }),
  };
}

function normalizeModels(models: StaffModelItem[], groupId: string) {
  return models.map((model, index) => {
    if (!isDynamicModel(model)) return { ...model, group_id: groupId, sort: index };
    return {
      ...model,
      group_id: groupId,
      sort: index,
      aggregate_config: {
        ...model.aggregate_config,
        models: model.aggregate_config.models.map((subModel, subIndex) => ({
          ...subModel,
          group_id: groupId,
          sort: subIndex,
        })),
      },
    };
  });
}

export function reindexModels(models: StaffModelItem[]) {
  return models.map((model, index) => ({ ...model, sort: index }));
}

export function reindexSubModels(models: StaffBaseModel[], groupId: string) {
  return models.map((model, index) => ({ ...model, group_id: groupId, sort: index }));
}

export function removeModelFromGroups(groups: OfficialStaffDetail["groups"], source: StaffDragData, category: StaffModelCategory) {
  let removed: StaffModelItem | StaffBaseModel | null = null;
  const nextGroups = groups.map((entry) => {
    if (source.type === staffDragType.model || source.type === staffDragType.dynamic) {
      if (entry.group.id !== source.groupId) return entry;
      const nextModels = getCategoryModels(entry, category).filter((model) => {
        if (model.id !== source.item.id) return true;
        removed = model;
        return false;
      });
      return updateCategoryModels(entry, category, reindexModels(nextModels));
    }

    if (source.type === staffDragType.subModel) {
      if (entry.group.id !== source.groupId) return entry;
      return {
        ...entry,
        [staffModelCategoryConfig[category].field]: getCategoryModels(entry, category).map((model) => {
          if (!isDynamicModel(model) || model.id !== source.dynamicId) return model;
          const nextSubModels = model.aggregate_config.models.filter((subModel) => {
            if (subModel.id !== source.item.id) return true;
            removed = subModel;
            return false;
          });
          return {
            ...model,
            aggregate_config: {
              ...model.aggregate_config,
              models: reindexSubModels(nextSubModels, model.id),
            },
          };
        }),
      };
    }

    return entry;
  });

  return { groups: nextGroups, removed };
}

export function insertModelIntoGroup(
  groups: OfficialStaffDetail["groups"],
  item: StaffModelItem,
  target: DropTarget,
  category: StaffModelCategory,
) {
  return groups.map((entry) => {
    if (entry.group.id !== target.groupId) return entry;
    const nextModels = [...getCategoryModels(entry, category)];
    let insertIndex = nextModels.length;
    if (target.type === staffDragType.model || target.type === staffDragType.dynamic) {
      const targetIndex = nextModels.findIndex((model) => model.id === target.modelId);
      if (targetIndex >= 0) insertIndex = target.insertAfter ? targetIndex + 1 : targetIndex;
    }
    nextModels.splice(insertIndex, 0, { ...item, group_id: entry.group.id });
    return updateCategoryModels(entry, category, reindexModels(nextModels));
  });
}

export function insertModelIntoDynamic(
  groups: OfficialStaffDetail["groups"],
  item: StaffBaseModel,
  target: Extract<DropTarget, { type: typeof staffDragType.dynamicContainer | typeof staffDragType.subModel }>,
  category: StaffModelCategory,
) {
  return groups.map((entry) => {
    if (entry.group.id !== target.groupId) return entry;
    return {
      ...entry,
      [staffModelCategoryConfig[category].field]: getCategoryModels(entry, category).map((model) => {
        if (!isDynamicModel(model) || model.id !== target.dynamicId) return model;
        const nextSubModels = [...model.aggregate_config.models];
        let insertIndex = nextSubModels.length;
        if (target.type === staffDragType.subModel) {
          const targetIndex = nextSubModels.findIndex((subModel) => subModel.id === target.modelId);
          if (targetIndex >= 0) insertIndex = target.insertAfter ? targetIndex + 1 : targetIndex;
        }
        nextSubModels.splice(insertIndex, 0, { ...item, group_id: entry.group.id });
        return {
          ...model,
          aggregate_config: {
            ...model.aggregate_config,
            models: reindexSubModels(nextSubModels, entry.group.id),
          },
        };
      }),
    };
  });
}
