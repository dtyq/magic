export enum Schema {
	TEXT = "TEXT", // 多行文本
	SELECT = "SELECT", // 下拉单选
	MULTIPLE = "MULTIPLE", // 下拉多选
	DATE = "DATETIME", // 日期
	NUMBER = "NUMBER", // 数字
	CHECKBOX = "CHECKBOX", // 复选框
	MEMBER = "MEMBER", // 成员（单/多选）
	LINK = "LINK", // 超链接
	ATTACHMENT = "ATTACHMENT", // 附件
	CREATE_AT = "CREATE_AT", // 创建时间
	UPDATE_AT = "UPDATE_AT", // 更新时间
	CREATED = "CREATED", // 创建人
	UPDATED = "UPDATED", // 修改人
	TODO_STATUS = "TODO_STATUS", // 待办完成状态
	TODO_FINISHED_AT = "TODO_FINISHED_AT", // 待办完成时间
	LOOKUP = "LOOKUP", // 查找引用
	QUOTE_RELATION = "QUOTE_RELATION", // 单向关联
	MUTUAL_RELATION = "MUTUAL_RELATION", // 双向关联
	ROW_ID = "ROW_ID", // 唯一ID
	FORMULA = "FORMULA",
	BUTTON = "BUTTON", // 按钮
}

export namespace Sheet {
	export interface User {
		id: string
		real_name: string
		avatar: string
		description: string
		position: string
		department: string | null
	}

	export interface ColumnProps {
		format?: string
		renderType?: string
		prefix?: string
		suffix?: string
		options?: any[]
		[key: string]: any
	}

	export interface Column {
		id: string
		label: string
		columnType: Schema
		columnProps: ColumnProps
		columnId?: string
	}

	export interface ViewConfig {
		rowHeight: number
	}

	export interface ColumnConfig {
		width: number
		visible: boolean
		statisticsType: string
	}

	export interface Searches {
		groups: any[]
		conjunction: string
	}

	export interface View {
		viewId: string
		viewName: string
		viewType: string
		viewConfig: ViewConfig
		groups: any[]
		sorts: any[]
		searches: Searches
		columnsConfig: { [key: string]: ColumnConfig }
		rowIndexes: string[]
		columnIndices: string[]
		viewProtectedType: string
		creator: User
		modifier: User
		frozenColumnId: string
	}

	export interface Content {
		primaryKey: string
		columns: { [key: string]: Column }
		views: { [key: string]: View }
		viewIndices: string[]
	}

	export interface Detail {
		id: string
		name: string
		content: Content
		draft_content: any[]
		creator: User
		modifier: User
		created_at: string
		updated_at: string
		type: number
		unread_announcement_count: number
	}
}

export namespace File {
	export enum SpaceType {
		Personal = 1, // 个人云盘
		Official = 2, // 企业云盘
	}
	// 0 目录；1 多维表格；2 word；3 excel；4 思维笔记；5 ppt；6 pdf；7 旧版云文档；16 新云文档；22 白板；24 神奇应用.
	export enum FileType {
		Category = 0,
		MultiTable = 1,
		Document = 16,
	}
	export type RequestParams = {
		name: string
		space_type: SpaceType
		file_type: FileType
	}

	export interface Detail {
		attributes?: Attributes
		child_number?: number
		created_at?: string
		creator?: Creator
		extension?: string
		favorite_id?: null
		file_id?: string
		file_type?: number
		id?: string
		is_favorite?: number
		is_quick_file?: number
		is_subscribe?: boolean
		modified_at?: string
		modifier?: Modifier
		name?: string
		operation?: string
		path?: Path[]
		recent_opened_at?: string
		shared_at?: string
		space_type?: number
		[property: string]: any
	}

	export interface Attributes {
		advanced_permission_status: number
		[property: string]: any
	}

	export interface Creator {
		avatar: string
		description: string
		id: string
		position: string
		real_name: string
		[property: string]: any
	}

	export interface Modifier {
		avatar: string
		description: string
		id: string
		position: string
		real_name: string
		[property: string]: any
	}

	export interface Path {
		id: number | string
		name: string
		operation: string
		space_type: number
		type: string
		[property: string]: any
	}
}
