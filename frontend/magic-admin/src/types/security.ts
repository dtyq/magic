import type { PageParams } from "./common"

/* 安全管控 */
export namespace Security {
	/* 管理员操作日志查询参数 */
	export interface AdminOperationLogsParams extends PageParams {
		start_date?: string
		end_date?: string
		operation_code?: string
		operation_type?: string
		resource_code?: string
		admin_id?: string
	}

	/* 组织管理员列表参数 */
	export interface AdminUserParams extends PageParams {
		/* 管理员名称 */
		name?: string
	}

	/* 组织管理员列表 */
	export interface AdminUser {
		id: string
		/* 用户 ID */
		user_id: string
		/* 用户名称 */
		user_name: string
		/* 授予人名称 */
		grantor_user_name: string
		/* 授予人头像 */
		grantor_user_avatar: string
		avatar: string
		department_name: string
		operation_time: string
		/* 是否是组织创建者 */
		is_organization_creator: boolean
	}

	/* 子管理员用户信息 */
	export interface UserInfo {
		id: string
		real_name: string
		nickname: string
		avatar_url: string
		departments: { id: string; name: string; path: string }[]
		position: string
		work_number: string
	}

	/* 子管理员 */
	export interface SubAdmin {
		/* 管理组id */
		id: string
		/* 管理组名称 */
		name: string
		/* 权限KEY */
		permissions: string[]
		/* 权限标签 */
		permission_tag: string[]
		/* 子管理员 */
		users: { [key: string]: UserInfo }
		user_count: number
		/* 最后修改人 */
		updated_user: UserInfo
		/* 创建时间 */
		created_at: string
		/* 更新时间 */
		updated_at: string
	}

	/* 权限资源树 */
	export interface PermissionTree {
		label: string
		permission_key: string
		full_label?: string
		check_status?: number
		is_leaf?: boolean
		children?: PermissionTree[]
	}

	/* 创建子管理员参数 */
	export interface AddSubAdminParams {
		id?: string
		name: string
		/* 资源KEY */
		permissions: string[]
		user_ids: string[]
	}
}
