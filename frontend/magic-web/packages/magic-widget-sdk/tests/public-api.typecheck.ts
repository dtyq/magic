import type { MagicWidget } from "../src"

const validOptions: MagicWidget.MountOptions = {
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	auth: {
		loginStrategy: "private_deployment",
		deploymentCode: "private-mock",
		organizationCode: "org-001",
	},
	modal: {
		title: "Support Center",
		classNames: {
			mask: "custom-mask",
			container: "custom-container",
			header: "custom-header",
		},
		styles: {
			mask: {
				backgroundColor: "rgba(0, 0, 0, 0.35)",
			},
			container: {
				backgroundColor: "#fff",
			},
			header: {
				borderBottomColor: "#eee",
			},
		},
	},
	config: {
		layout: "desktop",
		shell: { appSidebar: false },
		conversation: { projectFiles: false, topicHistory: true, autoHire: false },
		responsive: { mobileDetection: "device-and-viewport" },
		header: {
			visible: true,
			title: "Mock Assistant",
			topicName: { mode: "current" },
			actions: {
				fullscreen: true,
				pin: true,
				newTopic: true,
				history: true,
				share: false,
				more: true,
				close: true,
			},
		},
		panel: {
			projectFiles: false,
			uploadFiles: false,
			otherProjectFiles: false,
			digitalEmployees: false,
			microApps: false,
			workflows: false,
			connectors: false,
			skills: false,
			canvasElements: false,
			customGroups: [
				{
					id: "group-typecheck",
					label: "Typecheck group",
					items: [
						{
							id: "content-typecheck",
							type: "card",
							text: "Typecheck fixture",
							data: { source: "fixture" },
						},
					],
				},
			],
		},
		bottom: {
			internetSearch: { enabled: true, buttonVisible: false },
			plugin: { enabled: false, buttonVisible: false },
			upload: { enabled: false, buttonVisible: false },
			voice: { enabled: true, buttonVisible: true },
			model: { buttonVisible: false },
		},
		window: { closable: false },
	},
	headerActions: {
		fullscreen: async ({ action }) => {
			void action
		},
		pin: async ({ topicId }) => {
			void topicId
		},
		newTopic: async ({ topicName }) => {
			void topicName
		},
		close: async ({ topicId, topicName }) => {
			void topicId
			void topicName
		},
	},
	customMentionSearch: async ({ query, scope, signal }) => {
		const result: MagicWidget.CustomMentionSearchResult = {
			groupId: scope.type === "group" ? scope.groupId : "group-typecheck",
			items: [
				{
					id: "dynamic-typecheck",
					type: "card",
					text: `Result for ${query}`,
				},
			],
		}
		void signal
		return [result]
	},
}

void validOptions

// Keep SDK autocomplete aligned with the Magic Web login strategies used by Widget hosts.
const knownLoginStrategies: MagicWidget.LoginStrategy[] = [
	"private_deployment",
	"wechat_official_account",
]

void knownLoginStrategies

const unsubscribeReady = window.MagicWidget?.on("agent_ready", () => undefined)
void unsubscribeReady
// Verifies that the public overload infers a boolean preview state and returns an unsubscribe function.
const unsubscribePreviewFullscreen = window.MagicWidget?.on(
	"preview_fullscreen",
	(isFullscreen) => {
		const previewFullscreenState: boolean = isFullscreen
		void previewFullscreenState
	},
)
void unsubscribePreviewFullscreen

const unsubscribeConfigWarning = window.MagicWidget?.on("config.warning", (warning) => {
	const code: "CUSTOM_MENTION_FILTERED" = warning.code
	const droppedGroups: number = warning.details.droppedGroups
	const droppedItems: number = warning.details.droppedItems
	const reasons: MagicWidget.ConfigWarningReason[] = warning.details.reasons
	void code
	void droppedGroups
	void droppedItems
	void reasons
})
void unsubscribeConfigWarning

const unsubscribeMessageStreamStarted = window.MagicWidget?.on(
	"message.stream.started",
	(event) => {
		const eventType: "message.stream.started" = event.type
		const meta: Record<string, unknown> = event.meta
		const payload: unknown = event.payload
		void eventType
		void meta
		void payload
	},
)
void unsubscribeMessageStreamStarted

const unsubscribeToolCallSettled = window.MagicWidget?.on("toolCall.settled", (event) => {
	const eventType: "toolCall.settled" = event.type
	const meta: Record<string, unknown> = event.meta
	const payload: unknown = event.payload
	void eventType
	void meta
	void payload
})
void unsubscribeToolCallSettled

const unsubscribeTaskCompleted = window.MagicWidget?.on("task.completed", (event) => {
	const eventType: "task.completed" = event.type
	const meta: Record<string, unknown> = event.meta
	const payload: unknown = event.payload
	void eventType
	void meta
	void payload
})
void unsubscribeTaskCompleted
void window.MagicWidget?.setInput("mock input")
void window.MagicWidget?.appendInput("mock suffix")
const structuredInput: MagicWidget.InputContent = {
	blocks: [
		{ type: "text", text: "Ask " },
		{
			type: "mention",
			mention: {
				type: "agent",
				data: { agent_id: "agent-mock-001", agent_name: "Agent Mock" },
			},
		},
		{
			type: "mention",
			mention: {
				type: "mcp",
				data: { id: "mcp-mock-001", name: "MCP Mock", icon: "mock-icon" },
			},
		},
		{
			type: "mention",
			mention: {
				type: "text",
				data: {
					id: "text-mock-001",
					label: "Chart Mock",
					text: "chart id: mock-chart",
				},
			},
		},
	],
}
void window.MagicWidget?.setInput(structuredInput)
void window.MagicWidget?.appendInput(structuredInput)
void window.MagicWidget?.clearInput()
void window.MagicWidget?.getInput()
void window.MagicWidget?.sendMessage("mock message")
void window.MagicWidget?.sendMessage(structuredInput)
void window.MagicWidget?.sendMessage()
void window.MagicWidget?.newConversation()
void window.MagicWidget?.updateConfig({
	layout: "mobile",
	conversation: { topicHistory: false, autoHire: true },
	responsive: { mobileDetection: "viewport" },
})

void window.MagicWidget?.updateConfig({
	responsive: {
		// @ts-expect-error unsupported detection strategies are rejected by the public contract.
		mobileDetection: "device-only",
	},
})

void window.MagicWidget?.updateConfig({
	// @ts-expect-error unsupported layouts are rejected by the public configuration contract.
	layout: "tablet",
})

const invalidRouteOptions: MagicWidget.MountOptions = {
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	// @ts-expect-error free-form route configuration is not part of the public widget API.
	route: "/default/super/assistant",
}

void invalidRouteOptions

const invalidTopLevelOrganizationCodeOptions: MagicWidget.MountOptions = {
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	// @ts-expect-error organizationCode is configured through auth.organizationCode.
	organizationCode: "org-001",
}

void invalidTopLevelOrganizationCodeOptions

const invalidPageTypeOptions: MagicWidget.MountOptions = {
	page: {
		// @ts-expect-error only supported page types can be opened by the widget.
		type: "freeform",
		crewId: "crew-001",
	},
}

void invalidPageTypeOptions

const invalidAppOriginOptions: MagicWidget.MountOptions = {
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	// @ts-expect-error appOrigin is inferred from the script URL, not user configuration.
	appOrigin: "https://www.letsmagic.cn",
}

void invalidAppOriginOptions

const invalidClusterCodeOptions: MagicWidget.MountOptions = {
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	// @ts-expect-error clusterCode is controlled by the SDK page resolver.
	clusterCode: "default",
}

void invalidClusterCodeOptions

const invalidTriggerOptions: MagicWidget.MountOptions = {
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	// @ts-expect-error trigger customization is not part of the public widget API.
	trigger: {
		text: "Ask Magic",
	},
}

void invalidTriggerOptions

const invalidZIndexOptions: MagicWidget.MountOptions = {
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	// @ts-expect-error zIndex is managed by the SDK shell.
	zIndex: 10,
}

void invalidZIndexOptions

const invalidIframeTitleOptions: MagicWidget.MountOptions = {
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	iframe: {
		// @ts-expect-error iframe title is configured through modal.title.
		title: "Support Center",
	},
}

void invalidIframeTitleOptions

const hiddenTitleOptions: MagicWidget.MountOptions = {
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	config: {
		header: {
			title: { mode: "hidden" },
			topicName: { mode: "current" },
		},
	},
}

void hiddenTitleOptions

const staticTitleOptions: MagicWidget.MountOptions = {
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	config: {
		header: {
			title: { mode: "static", text: "Mock Assistant" },
		},
	},
}

void staticTitleOptions

void window.MagicWidget?.setInput({
	blocks: [
		{
			type: "mention",
			mention: {
				type: "unknown",
				data: { id: "unknown-mock-001", name: "Unknown Mock" },
			},
		},
	],
})
