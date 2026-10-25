import { matchPath } from "react-router"

import { RoutePath } from "@/constants/routes"

export interface EmbeddedMobileShellState {
	enabled: boolean
	activeView: string
	testIdPrefix: string
	showMainHeader: boolean
}

/** 根据 Super 移动端子路由决定是否挂载共享侧栏，以及页面是否保留旧版通用头部。 */
export function resolveEmbeddedShellState(pathname: string): EmbeddedMobileShellState {
	// 微应用路径会被通用项目参数路由匹配，必须优先判断更具体的固定前缀。
	if (matchPath(`/:clusterCode${RoutePath.MicroAppsList}`, pathname)) {
		return {
			enabled: true,
			activeView: "microApps",
			testIdPrefix: "mobile-micro-apps-list-page",
			showMainHeader: false,
		}
	}

	// AI research pages draw their own headers (sidebar toggle on the home, back arrows elsewhere).
	// The generic header only adds a workspace switcher the research pages do not use, and it must
	// be matched before the generic project routes below.
	if (matchPath(`/:clusterCode${RoutePath.PersonaResearch}/*`, pathname)) {
		return {
			enabled: true,
			activeView: "personaResearch",
			testIdPrefix: "mobile-persona-research-page",
			showMainHeader: false,
		}
	}

	// The AI canvas home draws its own shell header (sidebar toggle, title, new canvas button);
	// the generic header would flash before the lazily loaded page covers it.
	if (matchPath(`/:clusterCode${RoutePath.AiCanvas}`, pathname)) {
		return {
			enabled: true,
			activeView: "aiCanvas",
			testIdPrefix: "mobile-ai-canvas-page",
			showMainHeader: false,
		}
	}

	if (matchPath(`/:clusterCode${RoutePath.MicroApps}`, pathname)) {
		return {
			enabled: true,
			activeView: "microApps",
			testIdPrefix: "mobile-micro-apps-page",
			showMainHeader: false,
		}
	}

	if (matchPath(`/:clusterCode${RoutePath.MicroApp}`, pathname)) {
		return {
			enabled: true,
			activeView: "microApps",
			testIdPrefix: "mobile-micro-app-detail-page",
			showMainHeader: false,
		}
	}

	if (matchPath(`/:clusterCode${RoutePath.SuperChatProjectState}`, pathname)) {
		return {
			enabled: true,
			activeView: "chats",
			testIdPrefix: "mobile-chat-detail-page",
			showMainHeader: true,
		}
	}

	if (matchPath(`/:clusterCode${RoutePath.SuperWorkspaceProjectState}`, pathname)) {
		return {
			enabled: true,
			activeView: "workspaces",
			testIdPrefix: "mobile-workspace-detail-page",
			showMainHeader: true,
		}
	}

	if (matchPath(`/:clusterCode${RoutePath.SuperWorkspaceProjectTopicState}`, pathname)) {
		return {
			enabled: true,
			activeView: "workspaces",
			testIdPrefix: "mobile-workspace-topic-page",
			showMainHeader: true,
		}
	}

	return {
		enabled: false,
		activeView: "",
		testIdPrefix: "mobile-super-main-layout",
		showMainHeader: true,
	}
}
