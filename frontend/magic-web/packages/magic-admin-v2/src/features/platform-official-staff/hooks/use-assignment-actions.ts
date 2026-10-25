import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { useDefaultOfficialStaffDetailMutation, useDeleteOfficialStaffGroupMutation, useLoadOfficialStaffDetailMutation, useOfficialStaffOriginMutation, useSaveOfficialStaffConfigMutation } from "@magic-admin-v2/features/platform-official-staff/mutations";
import { staffDistributionType, type OfficialStaff, type OfficialStaffDetail, type OfficialStaffModelOption, type StaffModelCategory } from "@magic-admin-v2/features/platform-official-staff/types";
import { addModelToDetail, getCategoryModels, isDynamicModel, normalizeDetailForSave, normalizeErrorMessage, type AddModelTarget, type AssignmentConfirmAction } from "@magic-admin-v2/features/platform-official-staff/utils/page-utils";
import { useTranslation } from "react-i18next";

export type UseAssignmentActionsOptions = {
  canEdit: boolean;
  category: StaffModelCategory;
  confirmAction: AssignmentConfirmAction | null;
  detail: OfficialStaffDetail | null;
  isDefaultConfig: boolean;
  onFloatingOpenChange: (id: string | null) => void;
  onOpenChange: (open: boolean) => void;
  setConfirmAction: Dispatch<SetStateAction<AssignmentConfirmAction | null>>;
  setDetail: Dispatch<SetStateAction<OfficialStaffDetail | null>>;
  staff: OfficialStaff | null;
};

export function useAssignmentActions({
  canEdit,
  category,
  confirmAction,
  detail,
  isDefaultConfig,
  onFloatingOpenChange,
  onOpenChange,
  setConfirmAction,
  setDetail,
  staff,
}: UseAssignmentActionsOptions) {
  const { t } = useTranslation();
  const originMutation = useOfficialStaffOriginMutation();
  const loadDetailMutation = useLoadOfficialStaffDetailMutation();
  const defaultDetailMutation = useDefaultOfficialStaffDetailMutation();
  const deleteGroupMutation = useDeleteOfficialStaffGroupMutation();
  const saveConfigMutation = useSaveOfficialStaffConfigMutation();

  const handleDistributionChange = async (value: string) => {
    onFloatingOpenChange(null);
    if (!canEdit || !detail) return;
    const nextType = Number(value);

    if (nextType === staffDistributionType.independent) {
      try {
        const nextGroups =
          detail.mode.distribution_type === staffDistributionType.independent
            ? detail.groups
            : (await originMutation.mutateAsync(detail.mode.id)).groups;
        setDetail({
          mode: {
            ...detail.mode,
            distribution_type: staffDistributionType.independent,
            follow_mode_id: "0",
          },
          groups: nextGroups,
        });
      } catch (error) {
        toast.error(normalizeErrorMessage(error, t("officialStaff.error.restoreIndependentFailed")));
      }
      return;
    }

    setDetail({
      ...detail,
      mode: {
        ...detail.mode,
        distribution_type: staffDistributionType.follow,
        follow_mode_id: detail.mode.follow_mode_id && detail.mode.follow_mode_id !== "0" ? detail.mode.follow_mode_id : "",
      },
      groups: [],
    });
  };

  const handleFollowModeChange = async (id: string) => {
    onFloatingOpenChange(null);
    if (!canEdit || !detail) return;
    try {
      const followed = await loadDetailMutation.mutateAsync(id);
      setDetail({
        mode: {
          ...detail.mode,
          distribution_type: staffDistributionType.follow,
          follow_mode_id: id,
        },
        groups: followed.groups,
      });
    } catch (error) {
      toast.error(normalizeErrorMessage(error, t("officialStaff.error.followConfigLoadFailed")));
    }
  };

  const handleResetToDefault = async () => {
    if (!canEdit || !detail || detail.mode.is_default === 1) return;
    try {
      const defaultDetail = await defaultDetailMutation.mutateAsync();
      setDetail({
        ...detail,
        groups: defaultDetail.groups.map((entry) => ({
          group: {
            ...entry.group,
            mode_id: detail.mode.id,
          },
          text_models: entry.text_models,
          image_models: entry.image_models,
          video_models: entry.video_models,
        })),
      });
      toast.success(t("officialStaff.message.resetDefault"));
      setConfirmAction(null);
    } catch (error) {
      toast.error(normalizeErrorMessage(error, t("officialStaff.error.resetDefaultFailed")));
    }
  };

  const handleConfirmAction = async () => {
    if (!canEdit || !detail || !confirmAction) return;

    if (confirmAction.kind === "reset") {
      await handleResetToDefault();
      return;
    }

    if (confirmAction.kind === "group") {
      try {
        await deleteGroupMutation.mutateAsync(confirmAction.groupId);
        setDetail((current) =>
          current
            ? {
                ...current,
                groups: current.groups.filter(
                  (entry) => entry.group.id !== confirmAction.groupId,
                ),
              }
            : current,
        );
        toast.success(t("officialStaff.message.groupDeleted"));
        setConfirmAction(null);
      } catch (error) {
        toast.error(normalizeErrorMessage(error, t("officialStaff.error.groupDeleteFailed")));
      }
      return;
    }

    if (confirmAction.kind === "model") {
      setDetail((current) =>
        current
          ? {
              ...current,
              groups: current.groups.map((entry) =>
                entry.group.id === confirmAction.groupId
                  ? {
                      ...entry,
                      [category === "text" ? "text_models" : category === "image" ? "image_models" : "video_models"]: getCategoryModels(entry, category).filter(
                        (model) => model.id !== confirmAction.modelId,
                      ),
                    }
                  : entry,
              ),
            }
          : current,
      );
      setConfirmAction(null);
      return;
    }

    setDetail((current) =>
      current
        ? {
            ...current,
            groups: current.groups.map((entry) =>
              entry.group.id === confirmAction.groupId
                ? {
                    ...entry,
                    [category === "text" ? "text_models" : category === "image" ? "image_models" : "video_models"]: getCategoryModels(entry, category).map((model) =>
                      isDynamicModel(model) && model.id === confirmAction.dynamicId
                        ? {
                            ...model,
                            aggregate_config: {
                              ...model.aggregate_config,
                              models: model.aggregate_config.models.filter(
                                (subModel) => subModel.id !== confirmAction.modelId,
                              ),
                            },
                          }
                        : model,
                    ),
                  }
                : entry,
            ),
          }
        : current,
    );
    setConfirmAction(null);
  };

  const handleSave = async () => {
    if (!canEdit || !staff || !detail) return;
    if (
      !isDefaultConfig &&
      detail.mode.distribution_type === staffDistributionType.follow &&
      !detail.mode.follow_mode_id
    ) {
      toast.error(t("officialStaff.error.followModeRequired"));
      return;
    }
    try {
      await saveConfigMutation.mutateAsync({
        id: staff.id,
        detail: normalizeDetailForSave(detail),
      });
      toast.success(t("officialStaff.message.assignmentSaved"));
      onOpenChange(false);
    } catch (error) {
      toast.error(normalizeErrorMessage(error, t("officialStaff.error.assignmentSaveFailed")));
    }
  };

  const handleAddModel = (
    option: OfficialStaffModelOption,
    target: AddModelTarget,
  ) => {
    if (!canEdit || !detail) return;
    const result = addModelToDetail(detail, option, target, category);
    if (result.status === "blocked") {
      toast.error(t(`officialStaff.error.${result.error}`));
      return;
    }
    if (result.status === "unchanged") return;

    setDetail(result.detail);
    toast.success(t("officialStaff.message.modelAdded"));
  };

  return {
    defaultDetailPending: defaultDetailMutation.isPending,
    deleteGroupPending: deleteGroupMutation.isPending,
    handleAddModel,
    handleConfirmAction,
    handleDistributionChange,
    handleFollowModeChange,
    handleResetToDefault,
    handleSave,
    saveConfigPending: saveConfigMutation.isPending,
  };
}
