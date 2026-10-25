import { useTranslation } from "react-i18next";
import { OrganizationSelectorDialog } from "./organization-selector-dialog";
import type {
  DepartmentSelectorDialogProps,
  MemberDepartmentSelectorDialogProps,
  MemberSelectorDialogProps,
} from "./types";

export type {
  DepartmentSelectorDialogProps,
  MemberDepartmentSelectorDialogProps,
  MemberSelectorDialogProps,
  OrganizationSelectorLoadChildren,
  OrganizationSelectorLoadChildrenParams,
  OrganizationSelectorNode,
  OrganizationSelectorNodeType,
  OrganizationSelectorSearchMembers,
  OrganizationSelectorSearchMembersParams,
  OrganizationSelectorSearchDepartments,
  OrganizationSelectorSearchResult,
  ContactDepartmentLike,
  ContactUserLike,
  SelectorNodesFromIdsParams,
  ContactDepartmentSelectorNode,
  ContactUserSelectorNode,
  ContactOrganizationSelectorNode,
  ContactOrganizationSelectorAdapters,
  DataDashboardContactOrganizationSelectorAdapters,
  NormalizedContactPage,
} from "./types";

/** 仅选择部门的组织架构弹窗。 */
export function DepartmentSelectorDialog({
  title,
  description,
  searchPlaceholder,
  searchDepartments,
  ...props
}: DepartmentSelectorDialogProps) {
  const { t } = useTranslation();

  return (
    <OrganizationSelectorDialog
      title={title ?? t("organizationSelector.department.title")}
      description={description ?? t("organizationSelector.department.description")}
      searchPlaceholder={searchPlaceholder ?? t("organizationSelector.department.searchPlaceholder")}
      includeMembers={false}
      selectableTypes={["department"]}
      searchMembers={searchDepartments}
      {...props}
    />
  );
}

/** 选择成员的组织架构弹窗，默认支持部门选择并将部门转换为成员。 */
export function MemberSelectorDialog({
  title,
  description,
  searchPlaceholder,
  allowDepartmentSelection = true,
  convertDepartmentsToMembers = true,
  ...props
}: MemberSelectorDialogProps) {
  const { t } = useTranslation();

  return (
    <OrganizationSelectorDialog
      title={title ?? t("organizationSelector.member.title")}
      description={description ?? t("organizationSelector.member.description")}
      searchPlaceholder={searchPlaceholder ?? t("organizationSelector.member.searchPlaceholder")}
      includeMembers
      selectableTypes={allowDepartmentSelection ? ["department", "user"] : ["user"]}
      convertDepartmentsToMembers={convertDepartmentsToMembers}
      {...props}
    />
  );
}

/** 同时选择成员和部门、并保留原始节点类型的组织架构弹窗。 */
export function MemberDepartmentSelectorDialog({
  title,
  description,
  searchPlaceholder,
  ...props
}: MemberDepartmentSelectorDialogProps) {
  const { t } = useTranslation();

  return (
    <OrganizationSelectorDialog
      title={title ?? t("organizationSelector.memberDepartment.title")}
      description={description ?? t("organizationSelector.memberDepartment.description")}
      searchPlaceholder={
        searchPlaceholder ?? t("organizationSelector.memberDepartment.searchPlaceholder")
      }
      includeMembers
      selectableTypes={["department", "user"]}
      convertDepartmentsToMembers={false}
      {...props}
    />
  );
}
