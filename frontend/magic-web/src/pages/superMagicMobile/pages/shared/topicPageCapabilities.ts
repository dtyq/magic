import { RouteName } from "@/routes/constants"

export enum MobileTopicPageKind {
	SingleTopicChat = "single-topic-chat",
	ProjectTopic = "project-topic",
}

export interface MobileTopicPageBackTarget {
	name: RouteName
	params?: {
		projectId: string
	}
}

export interface MobileTopicPageCapabilities {
	canCreateSiblingTopic: boolean
	canSaveAsProject: boolean
	resolveBackTarget: (projectId?: string) => MobileTopicPageBackTarget
}

/**
 * 根据当前移动端路由语义推断会话页类型，保证路由页和内嵌复用页共用同一套能力判断。
 */
export function resolveMobileTopicPageKind(routeName?: RouteName): MobileTopicPageKind {
	if (routeName === RouteName.SuperChatProjectState) {
		return MobileTopicPageKind.SingleTopicChat
	}

	return MobileTopicPageKind.ProjectTopic
}

/**
 * 收口移动端会话页能力差异，避免在多个页面里散落 isChat / isTopicRoute 分支判断。
 */
export function getMobileTopicPageCapabilities(
	kind: MobileTopicPageKind,
): MobileTopicPageCapabilities {
	if (kind === MobileTopicPageKind.SingleTopicChat) {
		return {
			canCreateSiblingTopic: false,
			canSaveAsProject: true,
			// single-topic Chat 是聊天详情页，返回应回到聊天列表，而不是重定向回当前详情路由自身。
			resolveBackTarget: () => ({
				name: RouteName.SuperChatsList,
			}),
		}
	}

	return {
		canCreateSiblingTopic: true,
		canSaveAsProject: false,
		// 普通项目话题子页必须显式回项目详情，避免历史栈把用户带离当前项目上下文。
		resolveBackTarget: (projectId) => ({
			name: RouteName.SuperWorkspaceProjectState,
			params: projectId ? { projectId } : undefined,
		}),
	}
}
