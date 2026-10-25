import type { Tab } from "@/components/shadcn-ui/smooth-tabs"

export type ProjectDetailTab = "topics" | "topicFiles" | "scheduledTasks" | "canvas"

/**
 * Keeps the scheduled-tasks panel mounted after the first visit so tab switches
 * reuse the already fetched list instead of remounting and requesting again.
 */
export function shouldKeepScheduledTasksPanelMounted(
	activeTab: ProjectDetailTab,
	hasOpenedScheduledTasks: boolean,
) {
	return activeTab === "scheduledTasks" || hasOpenedScheduledTasks
}

/**
 * Builds the project-detail tabs while applying the PC read-only visibility rule. AI canvas
 * projects show only their topics and their single canvas.
 */
export function getProjectDetailTabs(
	t: (key: string) => string,
	isReadonly: boolean,
	isAiCanvas = false,
): Tab<ProjectDetailTab>[] {
	if (isAiCanvas) {
		return [
			{
				value: "topics",
				label: t("projectDetail.tabTopics"),
				testId: "project-detail-topics-tab",
			},
			{
				value: "canvas",
				label: t("projectDetail.tabCanvas"),
				testId: "project-detail-canvas-tab",
			},
		]
	}
	return [
		{
			value: "topics",
			label: t("projectDetail.tabTopics"),
			testId: "project-detail-topics-tab",
		},
		{
			value: "topicFiles",
			label: t("projectDetail.tabFiles"),
			testId: "project-detail-files-tab",
		},
		...(!isReadonly
			? [
					{
						value: "scheduledTasks" as const,
						label: t("scheduleTask.title"),
						testId: "project-detail-scheduled-tasks-tab",
					},
				]
			: []),
	]
}
