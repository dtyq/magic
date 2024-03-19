import type { Department, OrganizationNode, Resigned, User, UserGroup } from "@dtyq/user-selector"
import { NodeType, OperationTypes } from "@dtyq/user-selector"

export const mockDepartments: Department[] = [
	{
		id: "dept_1",
		dataType: NodeType.Department,
		department_id: "dept_1",
		parent_department_id: "0", // 根部门
		name: "技术部",
		order: "1",
		leader_user_id: "user_1",
		organization_code: "org_001",
		path: "/技术部",
		level: 1,
		has_child: true,
		employee_sum: 20,
	},
	{
		id: "dept_2",
		dataType: NodeType.Department,
		department_id: "dept_2",
		parent_department_id: "dept_1",
		name: "超级长的超级长的前端工作组超级长的超级长的前端工作组超级长的超级长的前端工作组超级长的超级长的前端工作组",
		order: "2",
		leader_user_id: "user_2",
		organization_code: "org_001",
		path: "/技术部/前端组",
		level: 2,
		has_child: false,
		employee_sum: 8,
	},
	{
		id: "dept_3",
		dataType: NodeType.Department,
		department_id: "dept_3",
		parent_department_id: "dept_1",
		name: "超级长的超级长的后端工作组超级长的超级长的后端工作组超级长的超级长的后端工作组超级长的超级长的后端工作组",
		has_child: true,
		employee_sum: 10,
	},
]

export const mockUsers: User[] = Array.from({ length: 50 }, (_, index) => {
	const isInFrontend = index % 2 === 0
	return {
		id: `user_${index + 1}`,
		dataType: NodeType.User,
		organization_code: "org_001",
		name: `用户11${index + 1}`,
		real_name: `用户11${index + 1}`,
		operation: OperationTypes.Read,
		canEdit: true,
		account_type: 1,
		job_title: isInFrontend
			? "前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发"
			: "后端开发",
		path_nodes: [
			{
				department_name: isInFrontend ? "前端组" : "后端组",
				department_id: isInFrontend ? "dept_2" : "dept_3",
				parent_department_id: "dept_1",
				path: isInFrontend ? "/技术部/前端组" : "/技术部/后端组",
				visible: true,
			},
		],
	}
})

export const mockData: OrganizationNode[] = [
	{
		id: "dept_3",
		dataType: NodeType.Department,
		department_id: "dept_3",
		parent_department_id: "dept_1",
		name: "后端组后端组",
		has_child: true,
		employee_sum: 10,
	},
	{
		id: "dept_4",
		dataType: NodeType.Department,
		department_id: "dept_4",
		parent_department_id: "dept_1",
		name: "测试组",
	},
	{
		id: "dept_5",
		dataType: NodeType.Department,
		department_id: "dept_5",
		parent_department_id: "dept_1",
		name: "产品组",
		employee_sum: 1,
	},
	{
		id: "user_3",
		dataType: NodeType.User,
		organization_code: "org_001",
		name: "王五",
		real_name: "王五",
	},
]

export const mockUsers2: User[] = Array.from({ length: 12 }, (_, index) => {
	const isInFrontend = index % 2 === 0
	return {
		id: `user2_${index + 1}`,
		dataType: NodeType.User,
		organization_code: "org_001",
		name: `用户22${index + 1}`,
		real_name: `用户22${index + 1}`,
		operation: OperationTypes.Admin,
		avatar_url: `https://example.com/avatar${index + 1}.png`,
		canEdit: isInFrontend,
		account_type: 1,
		job_title: isInFrontend
			? "前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发前端开发"
			: "后端开发",
		path_nodes: [
			{
				department_name: isInFrontend ? "前端组" : "后端组",
				department_id: isInFrontend ? "dept_2" : "dept_3",
				parent_department_id: "dept_1",
				path: isInFrontend ? "/技术部/前端组" : "/技术部/后端组",
				visible: true,
			},
			{
				department_name: isInFrontend ? "平台组" : "平台组",
				department_id: isInFrontend ? "dept_2" : "dept_3",
				parent_department_id: "dept_1",
				path: isInFrontend ? "/技术部/前端组" : "/技术部/后端组",
				visible: true,
			},
			{
				department_name: isInFrontend
					? "XXX项目XXX项目XXX项目XXX项目XXX项目XXX项目XXX项目XXX项目"
					: "XXX项目",
				department_id: isInFrontend ? "dept_2" : "dept_3",
				parent_department_id: "dept_1",
				path: isInFrontend ? "/技术部/前端组" : "/技术部/后端组",
				visible: true,
			},
		],
	}
})

export const mockResigned: Resigned[] = Array.from({ length: 12 }, (_, index) => {
	return {
		id: `resigned_${index + 1}`,
		dataType: NodeType.User,
		name: `离职人员${index + 1}`,
		avatar_url: `https://example.com/avatar${index + 1}.png`,
	}
})

export const mockResigned2: Resigned[] = Array.from({ length: 5 }, (_, index) => {
	return {
		id: `resigned_${index + 1}`,
		dataType: NodeType.User,
		name: `离职人员2${index + 1}`,
		avatar_url: `https://example.com/avatar${index + 1}.png`,
	}
})

export const organization = {
	id: "Xcxcx",
	name: "",
	logo: "",
}

export const mockUserGroups: UserGroup[] = Array.from({ length: 15 }, (_, index) => {
	return {
		id: `user_group_${index + 1}`,
		dataType: NodeType.UserGroup,
		name: `用户组${index + 1}`,
	}
})

/** 多层部门数据：6层级，名称较长，用于测试面包屑折叠等场景 */
export const mulitLevelDepartments: OrganizationNode[] = [
	{
		id: "dept_1",
		dataType: NodeType.Department,
		department_id: "dept_1",
		parent_department_id: "0",
		name: "技术研发中心",
		order: "1",
		leader_user_id: "user_1",
		organization_code: "org_001",
		path: "/企业技术研发中心与产品创新事业部",
		level: 1,
		has_child: true,
		employee_sum: 120,
		children: [
			{
				id: "dept_2",
				dataType: NodeType.Department,
				department_id: "dept_2",
				parent_department_id: "dept_1",
				name: "前端架构与用户体验研发组",
				order: "1",
				path: "/技术研发中心/前端架构与用户体验研发组",
				level: 2,
				has_child: true,
				employee_sum: 35,
				children: [
					{
						id: "dept_2_1",
						dataType: NodeType.Department,
						department_id: "dept_2_1",
						parent_department_id: "dept_2",
						name: "平台基础建设与组件化开发小组",
						order: "1",
						path: "/技术研发中心/前端架构与用户体验研发组/平台基础建设与组件化开发小组",
						level: 3,
						has_child: true,
						employee_sum: 15,
						children: [
							{
								id: "dept_2_1_1",
								dataType: NodeType.Department,
								department_id: "dept_2_1_1",
								parent_department_id: "dept_2_1",
								name: "移动端跨平台开发与性能优化团队",
								order: "1",
								path: "/技术研发中心/前端架构与用户体验研发组/平台基础建设与组件化开发小组/移动端跨平台开发与性能优化团队",
								level: 4,
								has_child: true,
								employee_sum: 8,
								children: [
									{
										id: "dept_2_1_1_1",
										dataType: NodeType.Department,
										department_id: "dept_2_1_1_1",
										parent_department_id: "dept_2_1_1",
										name: "iOS原生应用开发与AppStore上架支持小组",
										order: "1",
										path: "/技术研发中心/前端架构与用户体验研发组/平台基础建设与组件化开发小组/移动端跨平台开发与性能优化团队/iOS原生应用开发与AppStore上架支持小组",
										level: 5,
										has_child: true,
										employee_sum: 4,
										children: [
											{
												id: "dept_2_1_1_1_1",
												dataType: NodeType.Department,
												department_id: "dept_2_1_1_1_1",
												parent_department_id: "dept_2_1_1_1",
												name: "SwiftUI与Swift并发编程专项技术攻关小组",
												order: "1",
												path: "/技术研发中心/前端架构与用户体验研发组/平台基础建设与组件化开发小组/移动端跨平台开发与性能优化团队/iOS原生应用开发与AppStore上架支持小组/SwiftUI与Swift并发编程专项技术攻关小组",
												level: 6,
												has_child: false,
												employee_sum: 2,
											},
										],
									},
									{
										id: "dept_2_1_1_2",
										dataType: NodeType.Department,
										department_id: "dept_2_1_1_2",
										parent_department_id: "dept_2_1_1",
										name: "Android原生开发与各大应用市场适配小组",
										order: "2",
										path: "/技术研发中心/前端架构与用户体验研发组/平台基础建设与组件化开发小组/移动端跨平台开发与性能优化团队/Android原生开发与各大应用市场适配小组",
										level: 5,
										has_child: false,
										employee_sum: 4,
									},
								],
							},
							{
								id: "dept_2_1_2",
								dataType: NodeType.Department,
								department_id: "dept_2_1_2",
								parent_department_id: "dept_2_1",
								name: "Web前端工程化与微前端架构实践团队",
								order: "2",
								path: "/技术研发中心/前端架构与用户体验研发组/平台基础建设与组件化开发小组/Web前端工程化与微前端架构实践团队",
								level: 4,
								has_child: true,
								employee_sum: 7,
								children: [
									{
										id: "dept_2_1_2_1",
										dataType: NodeType.Department,
										department_id: "dept_2_1_2_1",
										parent_department_id: "dept_2_1_2",
										name: "React与Vue生态深度定制与组件库维护小组",
										order: "1",
										path: "/企业技术研发中心与产品创新事业部/前端架构与用户体验研发组/平台基础建设与组件化开发小组/Web前端工程化与微前端架构实践团队/React与Vue生态深度定制与组件库维护小组",
										level: 5,
										has_child: false,
										employee_sum: 4,
									},
									{
										id: "dept_2_1_2_2",
										dataType: NodeType.Department,
										department_id: "dept_2_1_2_2",
										parent_department_id: "dept_2_1_2",
										name: "构建工具链与CI/CD流水线自动化配置小组",
										order: "2",
										path: "/企业技术研发中心与产品创新事业部/前端架构与用户体验研发组/平台基础建设与组件化开发小组/Web前端工程化与微前端架构实践团队/构建工具链与CI/CD流水线自动化配置小组",
										level: 5,
										has_child: false,
										employee_sum: 3,
									},
								],
							},
						],
					},
					{
						id: "dept_2_2",
						dataType: NodeType.Department,
						department_id: "dept_2_2",
						parent_department_id: "dept_2",
						name: "业务中台前端与数据可视化展示研发组",
						order: "2",
						path: "/企业技术研发中心与产品创新事业部/前端架构与用户体验研发组/业务中台前端与数据可视化展示研发组",
						level: 3,
						has_child: false,
						employee_sum: 20,
					},
				],
			},
			{
				id: "dept_3",
				dataType: NodeType.Department,
				department_id: "dept_3",
				parent_department_id: "dept_1",
				name: "后端服务与分布式系统架构研发组",
				order: "2",
				path: "/企业技术研发中心与产品创新事业部/后端服务与分布式系统架构研发组",
				level: 2,
				has_child: true,
				employee_sum: 45,
				children: [
					{
						id: "dept_3_1",
						dataType: NodeType.Department,
						department_id: "dept_3_1",
						parent_department_id: "dept_3",
						name: "微服务治理与云原生应用部署团队",
						order: "1",
						path: "/企业技术研发中心与产品创新事业部/后端服务与分布式系统架构研发组/微服务治理与云原生应用部署团队",
						level: 3,
						has_child: true,
						employee_sum: 25,
						children: [
							{
								id: "dept_3_1_1",
								dataType: NodeType.Department,
								department_id: "dept_3_1_1",
								parent_department_id: "dept_3_1",
								name: "Kubernetes集群编排与容器化运维保障小组",
								order: "1",
								path: "/企业技术研发中心与产品创新事业部/后端服务与分布式系统架构研发组/微服务治理与云原生应用部署团队/Kubernetes集群编排与容器化运维保障小组",
								level: 4,
								has_child: false,
								employee_sum: 12,
							},
							{
								id: "dept_3_1_2",
								dataType: NodeType.Department,
								department_id: "dept_3_1_2",
								parent_department_id: "dept_3_1",
								name: "服务网格与链路追踪监控体系建设小组",
								order: "2",
								path: "/企业技术研发中心与产品创新事业部/后端服务与分布式系统架构研发组/微服务治理与云原生应用部署团队/服务网格与链路追踪监控体系建设小组",
								level: 4,
								has_child: false,
								employee_sum: 13,
							},
						],
					},
					{
						id: "dept_3_2",
						dataType: NodeType.Department,
						department_id: "dept_3_2",
						parent_department_id: "dept_3",
						name: "大数据存储与实时计算平台研发团队",
						order: "2",
						path: "/企业技术研发中心与产品创新事业部/后端服务与分布式系统架构研发组/大数据存储与实时计算平台研发团队",
						level: 3,
						has_child: false,
						employee_sum: 20,
					},
				],
			},
			{
				id: "dept_4",
				dataType: NodeType.Department,
				department_id: "dept_4",
				parent_department_id: "dept_1",
				name: "质量保障与测试工程化体系建设组",
				order: "3",
				path: "/企业技术研发中心与产品创新事业部/质量保障与测试工程化体系建设组",
				level: 2,
				has_child: true,
				employee_sum: 25,
				children: [
					{
						id: "dept_4_1",
						dataType: NodeType.Department,
						department_id: "dept_4_1",
						parent_department_id: "dept_4",
						name: "自动化测试框架与持续集成平台维护小组",
						order: "1",
						path: "/企业技术研发中心与产品创新事业部/质量保障与测试工程化体系建设组/自动化测试框架与持续集成平台维护小组",
						level: 3,
						has_child: false,
						employee_sum: 15,
					},
					{
						id: "dept_4_2",
						dataType: NodeType.Department,
						department_id: "dept_4_2",
						parent_department_id: "dept_4",
						name: "手工测试与用户体验验收专项小组",
						order: "2",
						path: "/企业技术研发中心与产品创新事业部/质量保障与测试工程化体系建设组/手工测试与用户体验验收专项小组",
						level: 3,
						has_child: false,
						employee_sum: 10,
					},
				],
			},
			{
				id: "dept_5",
				dataType: NodeType.Department,
				department_id: "dept_5",
				parent_department_id: "dept_1",
				name: "产品规划与需求分析管理组",
				order: "4",
				path: "/企业技术研发中心与产品创新事业部/产品规划与需求分析管理组",
				level: 2,
				has_child: false,
				employee_sum: 15,
			},
		],
	},
	...mockUsers,
]
