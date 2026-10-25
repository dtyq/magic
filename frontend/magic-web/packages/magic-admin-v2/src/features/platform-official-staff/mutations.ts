import { useMutation, useQueryClient } from "@tanstack/react-query";
import { platformOfficialStaffKeys } from "@magic-admin-v2/features/platform-official-staff/queries";
import type {
  DefaultAgentSetting,
  OfficialStaffDetail,
  OfficialStaffFormState,
  SaveOfficialStaffGroupParams,
  UpdateOfficialStaffStatusParams,
} from "@magic-admin-v2/features/platform-official-staff/types";
import { useApis } from "@magic-admin-v2/runtime/context";

export function useSaveOfficialStaffMutation() {
  const queryClient = useQueryClient();
  const { officialStaff } = useApis();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id?: string | null;
      values: OfficialStaffFormState;
    }) =>
      id
        ? officialStaff.updateOfficialStaff(id, values)
        : officialStaff.createOfficialStaff(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformOfficialStaffKeys.all }),
  });
}

export function useUpdateOfficialStaffStatusMutation() {
  const queryClient = useQueryClient();
  const { officialStaff } = useApis();

  return useMutation({
    mutationFn: (params: UpdateOfficialStaffStatusParams) =>
      officialStaff.updateOfficialStaffStatus(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformOfficialStaffKeys.all }),
  });
}

export function useUpdateDefaultAgentSettingMutation() {
  const queryClient = useQueryClient();
  const { officialStaff } = useApis();

  return useMutation({
    mutationFn: (params: DefaultAgentSetting) =>
      officialStaff.updateDefaultAgentSetting(params),
    onSuccess: (data) => {
      queryClient.setQueryData(platformOfficialStaffKeys.defaultAgent(), data);
    },
  });
}

export function useSaveOfficialStaffConfigMutation() {
  const queryClient = useQueryClient();
  const { officialStaff } = useApis();

  return useMutation({
    mutationFn: ({ id, detail }: { id: string; detail: OfficialStaffDetail }) =>
      officialStaff.saveOfficialStaffConfig(id, detail),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformOfficialStaffKeys.all }),
  });
}

export function useSaveOfficialStaffGroupMutation() {
  const queryClient = useQueryClient();
  const { officialStaff } = useApis();

  return useMutation({
    mutationFn: (params: SaveOfficialStaffGroupParams) =>
      params.id
        ? officialStaff.updateOfficialStaffGroup(params)
        : officialStaff.createOfficialStaffGroup(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformOfficialStaffKeys.all }),
  });
}

export function useDeleteOfficialStaffGroupMutation() {
  const queryClient = useQueryClient();
  const { officialStaff } = useApis();

  return useMutation({
    mutationFn: (id: string) => officialStaff.deleteOfficialStaffGroup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformOfficialStaffKeys.all }),
  });
}

export function useOfficialStaffOriginMutation() {
  const { officialStaff } = useApis();

  return useMutation({
    mutationFn: (id: string) => officialStaff.getOfficialStaffOrigin(id),
  });
}

export function useLoadOfficialStaffDetailMutation() {
  const { officialStaff } = useApis();

  return useMutation({
    mutationFn: (id: string) => officialStaff.getOfficialStaffDetail(id),
  });
}

export function useDefaultOfficialStaffDetailMutation() {
  const { officialStaff } = useApis();

  return useMutation({
    mutationFn: () => officialStaff.getDefaultOfficialStaffDetail(),
  });
}
