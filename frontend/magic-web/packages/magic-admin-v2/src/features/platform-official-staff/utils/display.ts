import type { ApiError } from "@magic-admin-v2/api/types";
import type { NameI18n, OfficialStaffModelOption, StaffModelItem } from "@magic-admin-v2/features/platform-official-staff/types";
import { Language, type Language as LanguageCode } from "@magic-admin-v2/i18n/resources";
import { isDynamicModel, isDynamicModelOption } from "@magic-admin-v2/features/platform-official-staff/utils/assignment-dnd";
import { staffDragType, type DragPreviewMeta, type StaffDragData } from "@magic-admin-v2/features/platform-official-staff/utils/assignment-dnd";

export function getI18nText(value?: NameI18n | null, language?: LanguageCode) {
  if (language === Language.EnUS) {
    return value?.en_US || value?.default || value?.zh_CN || "-";
  }

  return value?.zh_CN || value?.default || value?.en_US || "-";
}

export function normalizeErrorMessage(error: unknown, fallback: string) {
  return (error as ApiError | undefined)?.message || fallback;
}

export function getActivePreviewMeta(
  activeData: StaffDragData | null,
  language: LanguageCode,
  t: (key: string) => string,
): DragPreviewMeta | null {
  if (!activeData) return null;
  if (activeData.type === staffDragType.group) {
    return {
      icon: activeData.item.icon,
      title: getI18nText(activeData.item.name_i18n, language),
      type: "group",
    };
  }
  if (activeData.type === staffDragType.leftModel) return getModelPreviewMeta(activeData.item, language, t);
  if (activeData.type === staffDragType.model || activeData.type === staffDragType.dynamic) {
    return getModelPreviewMeta(activeData.item, language, t);
  }
  if (activeData.type === staffDragType.subModel) return getModelPreviewMeta(activeData.item, language, t);
  return null;
}

export function getModelPreviewMeta(
  model: StaffModelItem | OfficialStaffModelOption,
  language: LanguageCode,
  t: (key: string) => string,
): DragPreviewMeta {
  if ("model_name" in model) {
    return {
      icon: model.model_icon,
      subtitle: isDynamicModel(model)
        ? getI18nText(model.model_translate.description, language) || model.model_description
        : model.model_id,
      title: isDynamicModel(model)
        ? getI18nText(model.model_translate.name, language) || model.model_name
        : model.model_name,
      type: "model",
    };
  }

  return {
    icon: model.icon,
    subtitle: isDynamicModelOption(model) ? "dynamic" : model.model_id,
    title: model.name || (isDynamicModelOption(model) ? t("officialStaff.model.dynamic") : model.model_id),
    type: "model",
  };
}

