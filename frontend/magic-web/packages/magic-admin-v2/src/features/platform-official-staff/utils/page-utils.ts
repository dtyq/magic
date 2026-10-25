import { z } from "zod";
import type {
  OfficialStaff,
  OfficialStaffGroup,
  OfficialStaffModelOption,
} from "@magic-admin-v2/features/platform-official-staff/types";

export const pageSize = 100;
export const selectAllValue = "all";

export type FilterDraft = {
  identifier: string;
  keyword: string;
  status: string;
};

export type StaffDialogState = {
  open: boolean;
  staff: OfficialStaff | null;
};

export type AssignDialogState = {
  open: boolean;
  staff: OfficialStaff | null;
};

export type StatusDialogState = {
  staff: OfficialStaff;
  status: boolean;
} | null;

export type GroupDialogState = {
  group: OfficialStaffGroup | null;
  open: boolean;
};

export type NewGroupPendingModel = OfficialStaffModelOption | null;

export type AssignmentConfirmAction =
  | {
      kind: "reset";
    }
  | {
      groupId: string;
      kind: "group";
      name: string;
    }
  | {
      groupId: string;
      isDynamic: boolean;
      kind: "model";
      modelId: string;
      name: string;
    }
  | {
      dynamicId: string;
      groupId: string;
      kind: "subModel";
      modelId: string;
      name: string;
    };

export type AddModelTargetGroup = {
  dynamicTargets: Array<{
    dynamicId: string;
    groupId: string;
    label: string;
    type: "dynamic";
  }>;
  groupId: string;
  label: string;
  type: "group";
};

export function createOfficialStaffFormSchema(t: (key: string) => string) {
  return z.object({
    identifier: z.string().trim().min(1, t("officialStaff.validation.identifierRequired")).max(120),
    name_i18n: z.object({
      zh_CN: z.string().trim().min(1, t("officialStaff.validation.nameZhRequired")),
      en_US: z.string().trim().min(1, t("officialStaff.validation.nameEnRequired")),
    }),
    organization_whitelist: z.string(),
    placeholder_i18n: z.object({
      zh_CN: z.string().max(1000, t("officialStaff.validation.tooLong")),
      en_US: z.string().max(1000, t("officialStaff.validation.tooLong")),
    }),
    sort: z.number().int().min(0, t("officialStaff.validation.sortMin")),
  });
}

export function createDefaultFilterDraft(): FilterDraft {
  return {
    identifier: "",
    keyword: "",
    status: selectAllValue,
  };
}

export function getOfficialStaffFilterActiveCount(filter: FilterDraft) {
  return (
    Number(Boolean(filter.identifier.trim())) +
    Number(Boolean(filter.keyword.trim())) +
    Number(filter.status !== selectAllValue)
  );
}

export {
  getActivePreviewMeta,
  getModelPreviewMeta,
  getI18nText,
  normalizeErrorMessage,
} from "@magic-admin-v2/features/platform-official-staff/utils/display";
export { dynamicModelId } from "@magic-admin-v2/features/platform-official-staff/utils/assignment-dnd";
export {
  addModelToDetail,
  canAddToDynamicModelCategory,
  createBaseModel,
  createDynamicModel,
  createLocalId,
  dynamicModelIcon,
  insertModelIntoDynamic,
  insertModelIntoGroup,
  isDynamicModel,
  isDynamicModelOption,
  normalizeDetailForSave,
  getCategoryModels,
  updateCategoryModels,
  reindexModels,
  reindexSubModels,
  removeModelFromGroups,
} from "@magic-admin-v2/features/platform-official-staff/utils/assignment-models";
export type {
  AddModelTarget,
  AddModelToDetailResult,
} from "@magic-admin-v2/features/platform-official-staff/utils/assignment-models";
export {
  canDragIntoDynamicModel,
  getActiveReferencePoint,
  getContainerEdgePosition,
  getDropIndicator,
  getDropTarget,
  getDragData,
  getDroppableData,
  getDynamicSubModelLayoutDropIndicator,
  getGroupModelLayoutDropIndicator,
  getInsertPosition,
  getModelElementInGroup,
  getSubModelElement,
  isPointInElement,
  staffCollisionDetection,
  staffDragType,
} from "@magic-admin-v2/features/platform-official-staff/utils/assignment-dnd";
export type {
  DragPoint,
  DragPreviewMeta,
  DropIndicator,
  DropInsertPosition,
  DropTarget,
  DynamicModelLocale,
  StaffDragData,
} from "@magic-admin-v2/features/platform-official-staff/utils/assignment-dnd";
