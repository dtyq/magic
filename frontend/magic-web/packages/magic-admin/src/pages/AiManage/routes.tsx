import { lazy } from "react"
import { Navigate } from "@admin/pages/Navigate"
import { RouteName, RoutePath } from "@admin/const/routes"
import {
	AI_MANAGEMENT,
	PERMISSION_KEY_MAP,
	AI_CUSTOM_MODEL,
	AI_INTERNAL_EMPLOYEE_SKILL,
} from "@admin/const/common"
import { useAdminStore } from "@admin/stores/admin"

/**
 * @description 路由处理器，需要异步渲染，等待路由生成再渲染再执行对应业务流程
 */
const AiManageLayout = lazy(() => import("./index.layout"))
const ModelPage = lazy(() => import("../PlatformPackage/Model/index.page"))
const ModelDetailPage = lazy(() => import("../PlatformPackage/ModelDetail/index.page"))
const AIDrawingPage = lazy(() => import("../PlatformPackage/AIDrawing/index.page"))
const AIDrawingDetailPage = lazy(() => import("../PlatformPackage/AIDrawingDetail/index.page"))
const AIVideoPage = lazy(() => import("../PlatformPackage/VideoModel/index.page"))
const AIVideoDetailPage = lazy(() => import("../PlatformPackage/VedioModelDetail/index.page"))
const EmployeeReviewPage = lazy(() => import("./EmployeeReview/index.page"))
const SkillReviewPage = lazy(() => import("./SkillReview/index.page"))

const hasAdminAllPermissions = (permissions: string[]) =>
	permissions.includes(PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS) ||
	permissions.includes(PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS) ||
	permissions.includes(PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS)

const canAccessAIModel = (permissions: string[], isSuperAdmin?: boolean) =>
	isSuperAdmin ||
	permissions.includes(PERMISSION_KEY_MAP.MODEL_MANAGEMENT_QUERY) ||
	permissions.includes(PERMISSION_KEY_MAP.MODEL_MANAGEMENT_EDIT)

const canAccessAIDrawing = (permissions: string[], isSuperAdmin?: boolean) =>
	isSuperAdmin ||
	permissions.includes(PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_QUERY) ||
	permissions.includes(PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_EDIT)

const canAccessAIVideo = (permissions: string[], isSuperAdmin?: boolean) =>
	isSuperAdmin ||
	permissions.includes(PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_QUERY) ||
	permissions.includes(PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_EDIT)

const canAccessAICustomModel = (permissions: string[], isSuperAdmin?: boolean) =>
	isSuperAdmin || AI_CUSTOM_MODEL.some((permission) => permissions.includes(permission))

const canAccessAIInternalEmployeeSkill = (permissions: string[], isSuperAdmin?: boolean) =>
	isSuperAdmin ||
	AI_INTERNAL_EMPLOYEE_SKILL.some((permission) => permissions.includes(permission))

// 首页重定向
function AIIndexRedirect() {
	const { isPermissionInitialized, isOfficialOrg, userPermissions } = useAdminStore()

	if (!isPermissionInitialized) return null

	const isSuperAdmin = hasAdminAllPermissions(userPermissions)
	const targetPath = [
		!isOfficialOrg && canAccessAICustomModel(userPermissions, isSuperAdmin)
			? RoutePath.AIModel
			: null,
		canAccessAIInternalEmployeeSkill(userPermissions, isSuperAdmin)
			? RoutePath.AIEmployeeReview
			: null,
	].find(Boolean)

	return <Navigate to={targetPath ?? RoutePath.AdminNoAuthorized} replace />
}

export default {
	name: RouteName.AdminAILayout,
	path: RoutePath.AI,
	element: <AiManageLayout />,
	title: "nav.ai",
	validate: (permissions: string[], isSuperAdmin?: boolean) => {
		return isSuperAdmin || AI_MANAGEMENT.some((permission) => permissions.includes(permission))
	},
	children: [
		{
			index: true,
			element: <AIIndexRedirect />,
		},
		{
			name: RouteName.AdminAICustomModel,
			path: RoutePath.AICustomModel,
			title: "nav.aiSubMenu.customModel",
			validate: canAccessAICustomModel,
			children: [
				{
					index: true,
					element: <Navigate to={RoutePath.AIModel} replace />,
				},
				{
					name: RouteName.AdminAIModel,
					path: RoutePath.AIModel,
					element: <ModelPage />,
					title: "nav.platformSubMenu.modelManagement",
					validate: canAccessAIModel,
				},
				{
					name: RouteName.AdminAIModelDetails,
					path: RoutePath.AIModelDetail,
					element: <ModelDetailPage />,
					validate: canAccessAIModel,
				},
				{
					name: RouteName.AdminAIDrawing,
					path: RoutePath.AIDrawing,
					element: <AIDrawingPage />,
					title: "nav.platformSubMenu.intelligentDrawing",
					validate: canAccessAIDrawing,
				},
				{
					name: RouteName.AdminAIDrawingDetails,
					path: RoutePath.AIDrawingDetail,
					element: <AIDrawingDetailPage />,
					validate: canAccessAIDrawing,
				},
				{
					name: RouteName.AdminAIVideo,
					path: RoutePath.AIVideo,
					element: <AIVideoPage />,
					title: "nav.platformSubMenu.videoManagement",
					validate: canAccessAIVideo,
				},
				{
					name: RouteName.AdminAIVideoDetails,
					path: RoutePath.AIVideoDetail,
					element: <AIVideoDetailPage />,
					validate: canAccessAIVideo,
				},
			],
		},
		{
			name: RouteName.AdminAIInternalEmployeeSkill,
			path: RoutePath.AIInternalEmployeeSkill,
			title: "nav.aiSubMenu.internalEmployeeSkill",
			validate: canAccessAIInternalEmployeeSkill,
			children: [
				{
					index: true,
					element: <Navigate to={RoutePath.AIEmployeeReview} replace />,
				},
				{
					name: RouteName.AdminAIEmployeeReview,
					path: RoutePath.AIEmployeeReview,
					element: <EmployeeReviewPage />,
					title: "nav.aiSubMenu.employeePublishReview",
					validate: canAccessAIInternalEmployeeSkill,
				},
				{
					name: RouteName.AdminAISkillReview,
					path: RoutePath.AISkillReview,
					element: <SkillReviewPage />,
					title: "nav.aiSubMenu.skillPublishReview",
					validate: canAccessAIInternalEmployeeSkill,
				},
			],
		},
	],
}
