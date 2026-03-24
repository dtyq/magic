/* 测试数据 */

// saas-test 环境
const SassTestEnv = {
	// Magic 基础 URL
	base_url: "",
	// Teamshare 基础 URL
	teamshare_base_url: "",
	teamshare_web_url: "",
	// Keewood 基础 URL
	keewood_base_url: "",
}

const kkTestEnv = {
	// Magic 基础 URL
	base_url: "",
	// Teamshare 基础 URL
	teamshare_base_url: "",
	teamshare_web_url: "",
	// Keewood 基础 URL
	keewood_base_url: "",
}

export enum OrganizationType {
	/* 官方组织 */
	Official = "",
	/* 个人组织 */
	Personal = "",
	/* 企业组织 */
	Enterprise = "",
	/* 企业组织 */
	Enterprise2 = "",
	/* 企业组织 */
	Enterprise3 = "",
	/* 企业组织 */
	Enterprise4 = "",
}

// 默认用户 Token
const defaultToken = "<YOUR_TEST_TOKEN>"

// 测试用户 Token
const magicUserData = {
	user: {
		token: defaultToken,
		userInfo: {
			id: "demo-user-id",
			magic_id: "demo-magic-id",
			user_id: "demo-third-party-user-id",
			status: 1,
			nickname: "Demo User",
			real_name: "Demo User",
			avatar: "",
			organization_code: "DEMO_ORG",
			phone: "00000000000",
			email: "demo@example.com",
			country_code: "+86",
		},
		teamshareUserInfo: {
			id: "demo-user-id",
			name: "Demo User",
			avatar: "",
			departments: [
				[
					{
						name: "Demo Department",
						level: 0,
						id: "demo-department-id",
					},
				],
			],
		},
	},
	organization: {
		organizationCode: OrganizationType.Official,
		teamshareOrganizationCode: OrganizationType.Official,
		organizationInfo: {
			id: "demo-org-id",
			magic_id: "demo-magic-org-id",
			magic_user_id: "demo-third-party-user-id",
			organization_name: "Demo Organization",
			organization_logo: "",
			magic_organization_code: "DEMO_ORG",
			third_platform_organization_code: "000",
			third_platform_user_id: "demo-user-id",
			third_platform_type: "teamshare",
			teamshare_organization_code: "000",
			teamshare_user_id: "demo-user-id",
		},
		teamshareOrganizationInfo: {
			id: "demo-member-id",
			member_id: "demo-member-id",
			platform_type: 3,
			real_name: "Demo User",
			avatar: "",
			organization_code: "000",
			organization_name: "Demo Organization",
			organization_logo: [],
			is_admin: true,
			is_application_admin: false,
			is_complete_info: true,
			state_code: "",
			identifications: ["super_admin"],
			is_personal_organization: false,
			creator_id: "demo-creator-id",
			active_count: 1,
		},
	},
	services: SassTestEnv,
}

// 天书组织用户
const teamshareUserData = {
	user: {
		token: defaultToken,
		userInfo: {
			id: "demo-ts-user-id",
			magic_id: "demo-ts-magic-id",
			user_id: "demo-ts-third-party-user-id",
			status: 1,
			nickname: "Teamshare Demo User",
			real_name: "Teamshare Demo User",
			avatar: "",
			organization_code: "000",
			phone: "00000000000",
			email: "teamshare-demo@example.com",
			country_code: "+86",
		},
		teamshareUserInfo: {
			id: "demo-ts-user-id",
			name: "Teamshare Demo User",
			avatar: "",
			departments: [
				[
					{
						name: "Teamshare Demo Department",
						level: 0,
						id: "demo-ts-department-id",
					},
				],
			],
		},
	},
	organization: {
		organizationCode: "DEMO_TS_ORG",
		teamshareOrganizationCode: "000",
		organizationInfo: {
			magic_id: "demo-ts-magic-org-id",
			magic_user_id: "demo-ts-third-party-user-id",
			organization_name: "Teamshare Demo Organization",
			organization_logo: "",
			magic_organization_code: "DEMO_TS_ORG",
			third_platform_organization_code: "000",
			third_platform_user_id: "demo-ts-user-id",
			third_platform_type: "teamshare",
			teamshare_organization_code: "000",
			teamshare_user_id: "demo-ts-user-id",
		},
		teamshareOrganizationInfo: {
			id: "demo-ts-member-id",
			member_id: "demo-ts-member-id",
			platform_type: 3,
			real_name: "Teamshare Demo User",
			avatar: "",
			organization_code: "000",
			organization_name: "Teamshare Demo Organization",
			organization_logo: [],
			is_admin: false,
			is_application_admin: false,
			is_complete_info: true,
			state_code: "",
			identifications: [],
			is_personal_organization: false,
			creator_id: "demo-ts-creator-id",
			active_count: 1,
		},
	},
	services: kkTestEnv,
}

const config = {
	...teamshareUserData,
	...magicUserData,

	areaCodes: [
		{
			name: "中国",
			code: "+86",
			locale: "zh_CN",
			translations: {
				zh_CN: "中国",
				en_US: "China",
				ms_MY: "China",
				vi_VN: "Trung Quốc",
				th_TH: "จีน",
				fil_PH: "China",
				en_SG: "China",
				ru_RU: "Китай",
				kk_KZ: "Қытай",
				id_ID: "Cina",
			},
		},
	],
}

export default config
