import type { CSSProperties, ReactNode } from "react"

export interface BaseProps {
	className?: string
	style?: CSSProperties
}

/** 分页信息 */
export interface Pagination<T> {
	/** 数据 */
	items: T[]
	/** 是否还有更多数据 */
	hasMore?: boolean
	/** 加载更多数据 */
	loadMore?: () => void
	[key: string]: unknown
}

/** 组织信息 */
export interface Organization {
	/** 组织ID */
	id: string
	/** 组织名称 */
	name: string
	/** 组织logo */
	logo: string
}

/** 操作权限 */
export enum OperationTypes {
	/** 无权限 */
	None = 0,
	/** 创建者 */
	Owner = 1,
	/** 管理员 */
	Admin = 2,
	/** 只读 */
	Read = 3,
	/** 编辑 */
	Edit = 4,
}

/** 节点类型 */
export enum NodeType {
	/** 部门 */
	Department = "department",
	/** 用户 */
	User = "user",
	/** 用户组 */
	UserGroup = "userGroup",
	/** 群组 */
	Group = "group",
	/** 合作伙伴 */
	Partner = "partner",
}

/** 部门 */
export interface Department {
	/** 唯一标识 */
	id: string
	/** 名称 */
	name: string
	/** 节点类型 */
	dataType: NodeType.Department
	/** 操作权限 */
	operation?: OperationTypes
	/** 部门ID */
	department_id?: string
	/** 父部门ID */
	parent_department_id?: string
	/** 组织编码 */
	organization_code?: string
	/** 路径 */
	path?: string
	/** 层级 */
	level?: number
	/** 是否有子部门 */
	has_child?: boolean
	/** 员工数量 */
	employee_sum?: number
	[key: string]: unknown
}

/** 路径节点 */
export interface PathNode {
	/** 部门名称 */
	department_name: string
	/** 部门ID */
	department_id: string
	/** 父部门ID */
	parent_department_id: string
	/** 路径 */
	path: string
	/** 是否可见 */
	visible: boolean
}

/** 基础用户 */
export interface BaseUser<T extends NodeType> {
	/** 唯一标识 */
	id: string
	/** 节点类型 */
	dataType: T
	/** 名称 */
	name: string
	/** 头像信息 */
	avatar_url?: string
	/** 头像 */
	avatar?: string
	[key: string]: unknown
}

/** 用户 */
export interface User extends BaseUser<NodeType.User> {
	/** 真实姓名 */
	real_name?: string
	/** 操作权限 */
	operation?: OperationTypes
	/** 用户是否可以编辑某个成员的权限 */
	canEdit?: boolean
	/** 职位 */
	position?: string
	/** 职位 */
	job_title?: string
	/** 路径节点 */
	path_nodes?: Array<PathNode>
}

/** 组织节点 */
export type OrganizationNode = Department | User

/** 群聊节点 */
export type Group = BaseUser<NodeType.Group>

/** 用户组节点 */
export type UserGroup = BaseUser<NodeType.UserGroup>

/** 合作伙伴节点 */
export type Partner = BaseUser<NodeType.Partner>

/** 离职人员节点 */
export type Resigned = BaseUser<NodeType.User>

/** 搜索结果/ 数据类型 */
export type TreeNode = OrganizationNode | Group | Partner | Resigned | UserGroup

/** 分段选择类型 */
export enum SegmentType {
	/** 按组织架构 */
	Organization = "organization",
	/** 按最近联系 */
	Recent = "recent",
	/** 按群聊 */
	Group = "group",
	/** 按用户组 */
	UserGroup = "userGroup",
	/** 按合作伙伴 */
	Partner = "partner",
	/** 按离职人员 */
	Resigned = "resigned",
	/** 分享至成员 */
	ShareToMember = "shareToMember",
	/** 分享至群聊 */
	ShareToGroup = "shareToGroup",
}

/** 分段选择器数据 */
export interface SegmentData {
	[SegmentType.Organization]?: OrganizationNode[]
	[SegmentType.Recent]?: User[]
	[SegmentType.Group]?: Group[]
	[SegmentType.UserGroup]?: Pagination<UserGroup | User>
	[SegmentType.Partner]?: Partner[]
	[SegmentType.Resigned]?: Pagination<Resigned>
	[SegmentType.ShareToMember]?: OrganizationNode[]
	[SegmentType.ShareToGroup]?: ReactNode
}

/** 通用选择器类型 */
export interface CommonSelectorProps {
	/** 组织架构数据 */
	data: TreeNode[]
	/** 搜索结果 */
	searchData?: Pagination<TreeNode>
	/** 是否使用权限面板 */
	useAuthPanel?: boolean
	/** 是否使用分段选择器 */
	segmentData?: SegmentData
	/** 组织信息 */
	organization?: Organization
	/** 部门选择后是否可以转换为用户 */
	departmentToUser?: boolean
	/** 是否支持多选 */
	checkbox?: boolean
	/** 禁用的部门/用户ID列表 */
	disabledValues?: TreeNode[]
	/** 默认已选的部门/用户ID列表 */
	selectedValues?: TreeNode[]
	/** 是否加载中 */
	loading?: boolean
	/** 最大可选人数 0 为不限制 */
	maxCount?: number
	/** 是否禁选用户 */
	disableUser?: boolean
	/** 左侧样式 */
	leftClassName?: string
	/** 右侧样式 */
	rightClassName?: string
	/** 默认选中路径 */
	defaultSelectedPath?: SelectedPath[]
	/** 选中路径 */
	selectedPath?: SelectedPath[]
	/** 搜索框事件 */
	onSearchChange?: (value: string, segmentType?: SegmentType | null) => void
	/** 选中值变化 */
	onSelectChange?: (selectedValues: TreeNode[]) => void
	/** 列表item点击事件 */
	onItemClick?: (node: TreeNode, segmentType?: SegmentType) => void
	/** 面包屑点击事件 */
	onBreadcrumbClick?: (selectedPath: SelectedPath[], segmentType?: SegmentType) => void
	/** 自定义渲染右侧内容 */
	renderRight?: (nodes: TreeNode[]) => ReactNode
	/** 自定义渲染右侧上部内容 */
	renderRightTop?: (nodes: TreeNode[]) => ReactNode
	/** 自定义渲染底部内容 */
	renderRightBottom?: (nodes: TreeNode[]) => ReactNode
	/** 自定义渲染特定分段类型的右侧内容 */
	renderRightBySegment?: (nodes: TreeNode[], segmentType?: SegmentType) => ReactNode
	/** 确定按钮点击事件 */
	onOk?: (selectedValues: TreeNode[]) => void
}

/** Modal 兼容类型（替代 antd ModalProps） */
export interface DialogProps {
	open?: boolean
	onOpenChange?: (open: boolean) => void
	title?: ReactNode
	className?: string
	style?: CSSProperties
	classNames?: {
		header?: string
		content?: string
		overlay?: string
	}
	width?: number | string
	footer?: ReactNode | null
	cancelText?: ReactNode
	okText?: ReactNode
	onCancel?: () => void
}

/** 用户选择器 */
export type UserSelectorProps = Omit<DialogProps, "onOk"> & CommonSelectorProps

/** 选中路径 */
export interface SelectedPath {
	/** 节点ID */
	id: string
	/** 节点名称 */
	name: string
}

/** 复选框选项 */
export type CheckboxOptions<T> = {
	/** 禁用的节点 */
	disabled?: T[]
	/** 选中的节点 */
	checked?: T[]
	/** 选中节点变化 */
	onChange?: (checked: T[]) => void
}

export interface UserSelectorRef {
	clearSearchValue: () => void
}
