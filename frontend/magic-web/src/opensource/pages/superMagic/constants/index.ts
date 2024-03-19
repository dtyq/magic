import { SupportLocales } from "@/opensource/constants/locale"
import { env, isInternationalEnv } from "@/opensource/utils/env"
import {
	CollaborationProjectListItem,
	ProjectListItem,
	Workspace,
	WorkspaceStatus,
} from "../pages/Workspace/types"
import { User } from "@/opensource/types/user"
import { TFunction } from "i18next"
import { isOwner } from "../utils/permission"

export const SHARE_WORKSPACE_ID = "collaboration"

export const SHARE_WORKSPACE_DATA = (t: TFunction): Workspace => {
	return {
		id: SHARE_WORKSPACE_ID,
		name: t("workspace.shareWorkspaceName", { ns: "super" }),
		workspace_status: WorkspaceStatus.WAITING,
		is_archived: 0 as const,
		current_topic_id: "",
		current_project_id: "",
		project_count: 0,
	}
}

/**
 * 是否是团队共享工作区
 * @param selectedWorkspace 选中的工作区
 * @returns 是否是团队共享工作区
 */
export const isCollaborationWorkspace = (selectedWorkspace: Workspace | null | undefined) =>
	selectedWorkspace?.id === SHARE_WORKSPACE_ID

/**
 * 是否是团队共享项目
 * @param selectedProject 选中的项目
 * @returns 是否是团队共享项目
 */
export const isCollaborationProject = (
	selectedProject: ProjectListItem | CollaborationProjectListItem | null | undefined,
) => {
	if (!selectedProject) return false
	return selectedProject.tag === "collaboration"
}

/**
 * 是否是其他用户共享项目
 * @param selectedProject 选中的项目
 * @returns 是否是其他用户共享项目
 */
export const isOtherCollaborationProject = (
	selectedProject: ProjectListItem | CollaborationProjectListItem | null | undefined,
) => {
	if (!selectedProject) return false
	return (
		!isOwner((selectedProject as ProjectListItem)?.user_role) &&
		isCollaborationProject(selectedProject)
	)
}

/**
 * 共享项目是否是自己的项目
 * @param selectedProject 选中的项目
 * @param userInfo 用户信息
 * @returns
 */
export const isSelfCollaborationProject = (
	selectedProject: ProjectListItem | null | undefined,
	userInfo?: User.UserInfo | null,
) => {
	if (!selectedProject) return false
	return isCollaborationProject(selectedProject) && isOwner(selectedProject.user_role)
}

/**
 * 是否是工作区快捷项目
 * @param selectedProject 选中的项目
 * @returns 是否是工作区快捷项目
 */
export const isWorkspaceShortcutProject = (
	selectedProject: ProjectListItem | CollaborationProjectListItem | null | undefined,
) => {
	if (isOwner((selectedProject as ProjectListItem)?.user_role)) {
		return false
	}
	return (
		isCollaborationProject(selectedProject) ||
		(selectedProject as CollaborationProjectListItem)?.is_bind_workspace
	)
}

/** 超级麦吉的案例分享地址 */
const getSuperMagicCasesUrl = (lang: SupportLocales) => {
	/** 国内环境下的案例分享地址 */
	const CN_SITE_PATH_MAP = {
		[SupportLocales.zhCN]: "/cases/cases_cn.json",
		[SupportLocales.enUS]: "/cases/cases_en.json",
		[SupportLocales.fallback]: "/cases/cases_cn.json",
	}
	/** 国际环境下的案例分享地址 */
	const INTERNATIONAL_SITE_PATH_MAP = {
		[SupportLocales.enUS]: "/cases/cases_international_en.json",
		[SupportLocales.zhCN]: "/cases/cases_international_cn.json",
		[SupportLocales.fallback]: "/cases/cases_international_en.json",
	}

	const cnSitePath = CN_SITE_PATH_MAP[lang] || CN_SITE_PATH_MAP[SupportLocales.fallback]
	const internationalSitePath =
		INTERNATIONAL_SITE_PATH_MAP[lang] || INTERNATIONAL_SITE_PATH_MAP[SupportLocales.fallback]

	const path = isInternationalEnv() ? internationalSitePath : cnSitePath

	return `${env("MAGIC_PUBLIC_CDN_URL")}${path}`
}

export { getSuperMagicCasesUrl }
