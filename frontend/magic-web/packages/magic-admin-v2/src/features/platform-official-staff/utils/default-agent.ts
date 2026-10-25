import type { OfficialStaff } from "@magic-admin-v2/features/platform-official-staff/types";
import type { Language as LanguageCode } from "@magic-admin-v2/i18n/resources";

export type DefaultAgentOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

export function getOfficialStaffDisplayName(
  staff: OfficialStaff,
  language: LanguageCode = "zh_CN",
) {
  return (
    staff.name_i18n?.[language] ||
    staff.name_i18n?.default ||
    staff.name_i18n?.zh_CN ||
    staff.name_i18n?.en_US ||
    staff.identifier
  );
}

export function buildDefaultAgentOptions(
  staffList: OfficialStaff[],
  currentAgentCode?: string,
  language: LanguageCode = "zh_CN",
): DefaultAgentOption[] {
  const options: DefaultAgentOption[] = staffList
    .filter(
      (staff) =>
        staff.status && staff.is_default !== 1 && staff.identifier.length > 0,
    )
    .map((staff) => ({
      label: `${getOfficialStaffDisplayName(staff, language)} (${staff.identifier})`,
      value: staff.identifier,
    }));

  const currentStaffIsSystemDefault = staffList.some(
    (staff) => staff.identifier === currentAgentCode && staff.is_default === 1,
  );

  if (
    currentAgentCode &&
    !currentStaffIsSystemDefault &&
    !options.some((option) => option.value === currentAgentCode)
  ) {
    options.unshift({ label: currentAgentCode, value: currentAgentCode, disabled: true });
  }

  return options;
}
