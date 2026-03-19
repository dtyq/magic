export const enum UserType {
	AI = 0,
	Normal = 1,
}

/**
 * 用户状态
 */
export const enum UserStatus {
	// 禁用
	disable = 0,
	// 正常
	normal = 1,
}

export namespace User {
	/** magic 生态下组织（湾镇组织信息需要与 teamshare 中组织信息作映射） */
	export interface MagicOrganization {
		/** magic 用户UnionID（整个magic生态下唯一） */
		magic_id: string
		/** magic 组织编码 */
		magic_organization_code: string
		/** magic 用户OpenId（当前组织下唯一） */
		magic_user_id: string
		/** 组织Logo */
		organization_name: string
		/** 组织名称 */
		organization_logo: string | null
		/** 第三方平台 组织编码 */
		third_platform_organization_code: string
		/** 第三方平台 用户Id */
		third_platform_user_id: string
		/** 第三方平台类型 */
		third_platform_type: string | null
	}

	/** Teamshare 账号组织 */
	export interface UserOrganization {
		id: string
		member_id: string
		platform_type: number
		real_name: string
		avatar: string
		organization_code: string
		organization_name: string
		organization_logo: {
			url: string
			key: string
			name: string
			uid: string
		}[]
		is_admin: boolean
		is_application_admin: boolean
		is_complete_info: boolean
		state_code: string
		identifications: string[]
		creator_id: string
		is_personal_organization: boolean
		active_count: number
	}

	/** 用户账号(包括多环境：每个账号对应使用一个环境) */
	export interface UserAccount {
		/** 当前所在环境 */
		deployCode: string
		/** magic 用户UnionID（整个magic生态下唯一） */
		magic_id: string
		/** magic 用户OpenId（当前组织下唯一） */
		magic_user_id: string
		/** 用户名称 */
		nickname: string
		/** 当前用户所在组织 */
		organizationCode: string
		/** 用户头像 */
		avatar: string
		/** 用户 Token */
		access_token: string
		organizations: Array<MagicOrganization>
		teamshareOrganizations: Array<UserOrganization>
	}

	export interface UserInfo {
		magic_id: string
		user_id: string
		status: string | number
		nickname: string
		real_name: string
		avatar: string
		organization_code: string
		phone?: string
		email?: string
		country_code?: string
	}

	/** 登录设备 */
	export interface UserDeviceInfo {
		id: string
		device_id: string
		os: string
		os_version: string
		device_name: string
		user_id: number
		online: 0 | 1
		created_at: string
		updated_at: string
	}
}
