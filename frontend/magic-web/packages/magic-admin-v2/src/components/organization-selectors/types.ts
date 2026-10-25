import type { ReactNode } from "react";

/** 可被组织选择器展示或选择的节点类型。 */
export type OrganizationSelectorNodeType = "department" | "user";

/** 组织选择器中的部门或成员节点。 */
export interface OrganizationSelectorNode {
  /** 节点唯一标识；部门和成员的 ID 需要在各自类型内保持稳定。 */
  id: string;
  /** 节点展示名称。 */
  name: string;
  /** 节点类型，用于决定图标、导航和选择行为。 */
  type: OrganizationSelectorNodeType;
  /** 成员头像地址；部门节点通常不需要提供。 */
  avatarUrl?: string;
  /** 节点的补充描述，例如部门路径、邮箱或手机号。 */
  description?: string;
  /** 部门成员数量，用于在部门名称旁展示统计信息。 */
  memberCount?: number;
  /** 是否存在子部门；仅影响节点的进入提示，不负责实际加载。 */
  hasChildren?: boolean;
  /** 节点是否不可选择；不可选择的部门仍然可以进入下一级。 */
  disabled?: boolean;
  /** 业务侧原始数据，组件只透传，不会读取或修改。 */
  raw?: unknown;
}

/** 加载组织节点子项时传给业务数据源的参数。 */
export interface OrganizationSelectorLoadChildrenParams {
  /** 当前父节点 ID；默认根节点为 `-1`。 */
  parentId: string;
  /** 是否同时加载当前部门下的成员。 */
  includeMembers: boolean;
  /** 用于取消已失效的层级加载请求。 */
  signal?: AbortSignal;
}

/** 搜索成员时传给业务数据源的参数。 */
export interface OrganizationSelectorSearchMembersParams {
  /** 成员搜索关键词。 */
  query: string;
  /** 业务数据源返回的分页游标；首次搜索时为空。 */
  pageToken?: string;
  /** 用于取消已失效的搜索请求。 */
  signal?: AbortSignal;
}

/** 成员搜索结果及下一页信息。 */
export interface OrganizationSelectorSearchResult {
  /** 当前页成员节点；搜索结果只应返回可展示的成员节点。 */
  items: OrganizationSelectorNode[];
  /** 是否还存在下一页。 */
  hasMore?: boolean;
  /** 下一页游标；仅在 `hasMore` 为 true 时需要返回。 */
  pageToken?: string;
}

/** 组织层级加载适配器。 */
export type OrganizationSelectorLoadChildren = (
  params: OrganizationSelectorLoadChildrenParams,
) => Promise<OrganizationSelectorNode[]>;

/** 成员搜索加载适配器。 */
export type OrganizationSelectorSearchMembers = (
  params: OrganizationSelectorSearchMembersParams,
) => Promise<OrganizationSelectorSearchResult>;

/** 搜索部门时传给业务数据源的回调协议。 */
export type OrganizationSelectorSearchDepartments = OrganizationSelectorSearchMembers;

/** 三类选择弹窗共享的内部属性协议。 */
export interface BaseSelectorDialogProps {
  /** 是否显示弹窗。 */
  open: boolean;
  /** 弹窗打开状态变化回调。 */
  onOpenChange: (open: boolean) => void;
  /** 加载当前组织层级的子部门和成员。 */
  loadChildren: OrganizationSelectorLoadChildren;
  /** 受控模式下的当前选择值。传入后组件不会自行维护选择结果。 */
  selectedValues?: OrganizationSelectorNode[];
  /** 非受控模式下，弹窗每次打开时使用的初始选择值。 */
  defaultSelectedValues?: OrganizationSelectorNode[];
  /** 选择变化回调；部门转换为成员发生在确认阶段。 */
  onSelectionChange?: (selected: OrganizationSelectorNode[]) => void;
  /** 确认回调；开启部门转换时，收到的是递归展开并去重后的成员节点。 */
  onConfirm: (selected: OrganizationSelectorNode[]) => void | Promise<void>;
  /** 弹窗标题。 */
  title: string;
  /** 弹窗说明文案。 */
  description?: string;
  /** 搜索输入框占位文案。 */
  searchPlaceholder: string;
  /** 确认按钮文案。 */
  confirmLabel?: string;
  /** 取消按钮文案。 */
  cancelLabel?: string;
  /** 当前层级无数据时的文案。 */
  emptyLabel?: string;
  /** 根节点 ID；不传时使用 `-1`。 */
  rootId?: string;
  /** 根节点展示名称。 */
  rootName?: string;
  /** 是否在层级加载中返回成员节点。由具体选择器封装设置。 */
  includeMembers: boolean;
  /** 当前场景允许勾选的节点类型。 */
  selectableTypes: OrganizationSelectorNodeType[];
  /** 可选的成员远程搜索适配器；不传时仅对当前层级做本地过滤。 */
  searchMembers?: OrganizationSelectorSearchMembers;
  /** 确认时是否将所选部门递归展开为成员。 */
  convertDepartmentsToMembers?: boolean;
  /** 最大可选节点数；为 1 时会替换已有选择。 */
  maxSelected?: number;
  /** 是否禁用选择和确认操作。 */
  disabled?: boolean;
  /** Stable selectors for the dialog and organization tree controls. */
  dialogContentTestId?: string;
  searchInputTestId?: string;
  clearSearchButtonTestId?: string;
  rootButtonTestId?: string;
  breadcrumbButtonTestId?: string;
  backButtonTestId?: string;
  loadingTestId?: string;
  errorTestId?: string;
  emptyTestId?: string;
  rowTestId?: string;
  nodeButtonTestId?: string;
  checkboxTestId?: string;
  enterButtonTestId?: string;
  loadMoreButtonTestId?: string;
  cancelButtonTestId?: string;
  confirmButtonTestId?: string;
}

/** 仅选择部门的弹窗属性。 */
export type DepartmentSelectorDialogProps = Omit<
  BaseSelectorDialogProps,
  | "title"
  | "description"
  | "searchPlaceholder"
  | "includeMembers"
  | "selectableTypes"
  | "searchMembers"
  | "convertDepartmentsToMembers"
> & {
  /** 覆盖默认标题。 */
  title?: string;
  /** 覆盖默认说明。 */
  description?: string;
  /** 覆盖默认搜索占位文案。 */
  searchPlaceholder?: string;
  /** 部门关键词搜索回调。 */
  searchDepartments?: OrganizationSelectorSearchDepartments;
};

/** 选择成员的弹窗属性，默认支持部门选择并将部门转换为成员。 */
export type MemberSelectorDialogProps = Omit<
  BaseSelectorDialogProps,
  "title" | "description" | "searchPlaceholder" | "includeMembers" | "selectableTypes"
> & {
  /** 覆盖默认标题。 */
  title?: string;
  /** 覆盖默认说明。 */
  description?: string;
  /** 覆盖默认搜索占位文案。 */
  searchPlaceholder?: string;
  /** 是否允许勾选部门；关闭后部门仍可进入浏览，但不能被选中。 */
  allowDepartmentSelection?: boolean;
};

/** 同时选择成员和部门、且保留原始节点类型的弹窗属性。 */
export type MemberDepartmentSelectorDialogProps = Omit<
  BaseSelectorDialogProps,
  | "title"
  | "description"
  | "searchPlaceholder"
  | "includeMembers"
  | "selectableTypes"
  | "convertDepartmentsToMembers"
> & {
  /** 覆盖默认标题。 */
  title?: string;
  /** 覆盖默认说明。 */
  description?: string;
  /** 覆盖默认搜索占位文案。 */
  searchPlaceholder?: string;
};

/** 选择摘要组件的属性。 */
export interface SelectionSummaryProps {
  /** 是否会在确认阶段将部门转换为成员。 */
  convertDepartmentsToMembers: boolean;
  /** 当前选中的部门数量。 */
  selectedDepartments: number;
  /** 当前选中的成员数量。 */
  selectedMembers: number;
  /** 当前选中的节点总数。 */
  total: number;
}

/** 组织节点行组件的属性。 */
export interface SelectorRowProps {
  /** 要展示的组织节点。 */
  node: OrganizationSelectorNode;
  /** 进入部门节点的回调。 */
  onEnterDepartment: (node: OrganizationSelectorNode) => void;
  /** 切换节点选择状态的回调。 */
  onToggle: (node: OrganizationSelectorNode) => void;
  /** 当前节点是否可选择。 */
  selectable: boolean;
  /** 当前节点是否已选择。 */
  selected: boolean;
  rowTestId?: string;
  nodeButtonTestId?: string;
  checkboxTestId?: string;
  enterButtonTestId?: string;
}

/** 节点头像组件的属性。 */
export interface NodeAvatarProps {
  /** 要展示头像的组织节点。 */
  node: OrganizationSelectorNode;
  /** 是否使用紧凑尺寸。 */
  small?: boolean;
}

/** 选择器状态占位组件的属性。 */
export interface SelectorStateProps {
  /** 可选的状态图标，例如加载中的旋转图标。 */
  icon?: ReactNode;
  /** 状态提示文案。 */
  label: string;
}

/** 按节点类型和 ID 建立的选择索引。 */
export type SelectionMap = Map<string, OrganizationSelectorNode>;

/** 联系人部门数据的兼容结构。 */
export type ContactDepartmentLike = {
  children_count?: number;
  department_id?: string;
  employee_sum?: number;
  has_child?: boolean;
  have_children?: boolean;
  i18n_name?: string;
  id?: string;
  member_count?: number;
  name?: string;
  user_count?: number;
};

/** 联系人用户数据的兼容结构。 */
export type ContactUserLike = {
  avatar?: string;
  avatar_url?: string;
  departments?: Array<string | { name?: string }>;
  email?: string;
  id?: string;
  job_title?: string;
  name?: string;
  nickname?: string;
  phone?: string;
  position?: string;
  real_name?: string;
  user_id?: string;
  user_name?: string;
  work_number?: string;
};

/** 将 ID 同步为选择器节点时使用的参数。 */
export interface SelectorNodesFromIdsParams {
  departmentIds: string[];
  existingNodes?: OrganizationSelectorNode[];
  userIds: string[];
}

/** 联系人部门节点，保留既有的节点数据类型字段。 */
export type ContactDepartmentSelectorNode = OrganizationSelectorNode & {
  dataType: "department";
  type: "department";
};

/** 联系人成员节点，保留既有的节点数据类型字段。 */
export type ContactUserSelectorNode = OrganizationSelectorNode & {
  dataType: "user";
  type: "user";
};

/** 联系人组织适配器返回的选择器节点。 */
export type ContactOrganizationSelectorNode =
  | ContactDepartmentSelectorNode
  | ContactUserSelectorNode;

/** 联系人组织数据源适配器。 */
export type ContactOrganizationSelectorAdapters = {
  loadChildren: (
    params: OrganizationSelectorLoadChildrenParams,
  ) => Promise<ContactOrganizationSelectorNode[]>;
  searchMembers: (params: OrganizationSelectorSearchMembersParams) => Promise<{
    items: ContactUserSelectorNode[];
    hasMore: boolean;
    pageToken?: string;
  }>;
};

/** 数据看板后台通讯录适配器，额外提供部门关键词搜索。 */
export type DataDashboardContactOrganizationSelectorAdapters =
  ContactOrganizationSelectorAdapters & {
    searchDepartments: OrganizationSelectorSearchDepartments;
  };

/** 联系人分页响应的标准化结构。 */
export type NormalizedContactPage<TItem> = {
  items: TItem[];
  hasMore: boolean;
  pageToken?: string;
};
