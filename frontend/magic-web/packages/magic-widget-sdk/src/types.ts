type CustomLoginStrategy = string & {
	readonly __magicWidgetLoginStrategyBrand?: never
}

export declare namespace MagicWidget {
	export type LoginStrategy =
		| "phone_captcha"
		| "email"
		| "phone_password"
		| "DingTalk"
		| "DingTalkAvoid"
		| "wecom"
		| "Lark"
		| "wechat_official_account"
		| "redirect"
		| "apple_login"
		| "google_login"
		| "anta_login"
		| "private_deployment"
		| CustomLoginStrategy

	export type QueryValue =
		| string
		| number
		| boolean
		| null
		| undefined
		| Array<string | number | boolean | null | undefined>

	export interface AuthOptions {
		loginStrategy?: LoginStrategy
		deploymentCode?: string
		organizationCode?: string
	}

	export interface IframeOptions {
		allow?: string
		sandbox?: string
		query?: Record<string, QueryValue>
	}

	export type Layout = "desktop" | "mobile"

	export interface ShellConfig {
		appSidebar?: boolean
	}

	export type MobileDetection = "viewport" | "device-and-viewport"

	export interface ResponsiveConfig {
		/** Selects viewport-only or device-and-viewport mobile semantics. */
		mobileDetection?: MobileDetection
	}

	export type HeaderActionName =
		"fullscreen" | "pin" | "newTopic" | "history" | "share" | "more" | "close"

	/** First-line header label. `hidden` omits that line; `static` shows `text`. */
	export interface HeaderTitleConfig {
		mode?: "static" | "hidden"
		text?: string
	}

	export interface HeaderConfig {
		visible?: boolean
		/**
		 * First-line label. A string is static text.
		 * `{ mode: "hidden" }` omits the line while keeping the topic name and actions.
		 */
		title?: string | HeaderTitleConfig
		topicName?: { mode?: "current" | "hidden" | "static"; text?: string }
		/**
		 * Visibility flags. Omitted actions stay visible.
		 * Hide unimplemented host-owned `fullscreen` / `pin` with `false`.
		 */
		actions?: Partial<Record<HeaderActionName, boolean>>
	}

	export interface WidgetPanelConfig {
		/** Shows or hides the current project files row in the Mention panel. */
		projectFiles?: boolean
		/** Shows or hides the upload files row in the Mention panel. */
		uploadFiles?: boolean
		/** Shows or hides the other project files row in the Mention panel. */
		otherProjectFiles?: boolean
		/** Shows or hides the digital employees row in the Mention panel. */
		digitalEmployees?: boolean
		microApps?: boolean
		workflows?: boolean
		connectors?: boolean
		/** Shows or hides the skills row in the Mention panel. */
		skills?: boolean
		/** Shows or hides the canvas elements row when the current project provides it. */
		canvasElements?: boolean
		/** Adds host-owned named groups to the end of the Mention panel. */
		customGroups?: CustomMentionGroup[]
	}

	export interface CapabilityConfig {
		enabled?: boolean
		buttonVisible?: boolean
	}

	/** Shows or hides the editor model picker without affecting mention-panel agents. */
	export interface ModelButtonConfig {
		buttonVisible?: boolean
	}

	export interface WidgetBottomConfig {
		internetSearch?: CapabilityConfig
		plugin?: CapabilityConfig
		upload?: CapabilityConfig
		voice?: CapabilityConfig
		model?: ModelButtonConfig
	}

	export interface WidgetWindowConfig {
		/** Hides the close button inside the iframe header. The floating shell close button stays available. */
		closable?: boolean
	}

	/** Describes one host-owned JSON item that can be inserted as a text mention. */
	export interface CustomMentionItem {
		id: string
		type: string
		/** Self-contained semantic text rendered into the Agent prompt. */
		text: string
		/** Short optional label shown in the editor and message panel; falls back to text. */
		title?: string
		description?: string
		/** Built-in TSIcon or IconPark token name. */
		icon?: string
		/** HTTPS URL pointing to an icon image; takes precedence over icon token. */
		iconUrl?: string
		data?: Record<string, unknown>
	}

	/** Placement of a custom group relative to built-in Mention panel categories. */
	export type CustomMentionGroupPlacement = "start" | "end"

	/** Describes one named host-owned group in the Mention panel. */
	export interface CustomMentionGroup {
		id: string
		label: string
		/** Built-in TSIcon or IconPark token name. */
		icon?: string
		/** HTTPS URL pointing to an icon image; takes precedence over icon token. */
		iconUrl?: string
		/**
		 * Placement relative to built-in categories in the Mention panel root list.
		 * - "start": Placed at the top before built-in categories (micro apps, connectors, etc.).
		 * - "end": Placed at the bottom after built-in categories (default).
		 */
		placement?: CustomMentionGroupPlacement
		items: CustomMentionItem[]
	}

	/** Controls how Agent previews share the desktop viewport with the conversation. */
	export type PreviewMode = "split" | "fullscreen" | "switchable"

	export interface ConversationConfig {
		projectFiles?: boolean
		topicHistory?: boolean
		/** Automatically hire a market crew when the embedded user cannot execute it. */
		autoHire?: boolean
		/** Selects split, host-container fullscreen, or user-switchable preview presentation. */
		previewMode?: PreviewMode
	}

	export interface WidgetConfig {
		layout?: Layout
		shell?: ShellConfig
		conversation?: ConversationConfig
		responsive?: ResponsiveConfig
		header?: HeaderConfig
		panel?: WidgetPanelConfig
		bottom?: WidgetBottomConfig
		window?: WidgetWindowConfig
	}

	export interface HeaderActionContext {
		action: HeaderActionName
		topicId?: string
		topicName?: string
	}

	export type HeaderActionHandler = (context: HeaderActionContext) => void | Promise<void>

	export interface CrewPageOptions {
		type: "crew"
		crewId: string
	}

	export type PageOptions = CrewPageOptions

	export type ModalSlot =
		"root" | "layer" | "mask" | "container" | "header" | "title" | "close" | "body" | "iframe"

	export type ModalClassNames = Partial<Record<ModalSlot, string>>

	export type ModalStyles = Partial<
		Record<ModalSlot, Record<string, string | number | null | undefined>>
	>

	export interface ModalOptions {
		title?: string
		width?: number | string
		height?: number | string
		classNames?: ModalClassNames
		styles?: ModalStyles
	}

	export interface MountOptions {
		page: PageOptions
		auth?: AuthOptions
		config?: WidgetConfig
		iframe?: IframeOptions
		modal?: ModalOptions
		target?: HTMLElement
		/**
		 * Notifies the host after a header action completes.
		 * Built-in actions still run first. Close dismisses the widget before this callback.
		 * `headerActionHandled` is an ownership ack; the iframe does not fall back when it is false.
		 */
		headerActions?: Partial<Record<HeaderActionName, HeaderActionHandler>>
		/** Resolves host-owned custom Mention search results for the embedded editor. */
		customMentionSearch?: CustomMentionSearchHandler
	}

	export interface CustomMentionSearchContext {
		query: string
		scope: { type: "global" } | { type: "group"; groupId: string }
		signal: AbortSignal
	}

	export interface CustomMentionSearchResult {
		groupId: string
		items: CustomMentionItem[]
	}

	export type CustomMentionSearchHandler = (
		context: CustomMentionSearchContext,
	) => Promise<CustomMentionSearchResult[]> | CustomMentionSearchResult[]

	export type CommandErrorCode =
		| "NOT_MOUNTED"
		| "INVALID_INPUT"
		| "INVALID_CONFIG"
		| "IFRAME_NOT_READY"
		| "COMMAND_FAILED"
		| "DESTROYED"

	export interface CommandError extends Error {
		code: CommandErrorCode
	}

	/** Represents opaque mention data supplied by the host application. */
	export type JsonObject = Record<string, unknown>

	/** Describes the data contract for the SDK-only text mention. */
	export interface TextMentionData extends JsonObject {
		label: string
		text: string
		id: string
	}

	/** Keeps any Magic Web mention discriminator beside its opaque object payload. */
	export interface InputMention {
		type: string
		data: JsonObject
	}

	/** Represents one text or mention segment accepted by the Widget public API. */
	export type InputBlock =
		{ type: "text"; text: string } | { type: "mention"; mention: InputMention }

	/** Provides structured editor input without exposing the host's TipTap implementation. */
	export interface InputContent {
		blocks: InputBlock[]
	}

	/** Lists runtime event names whose routing contract is stable. */
	export type RuntimeEventName = "message.stream.started" | "toolCall.settled" | "task.completed"

	/** Keeps the event envelope stable while leaving Magic Web-owned data opaque. */
	export interface RuntimeEventEnvelope<T extends RuntimeEventName> {
		type: T
		meta: Record<string, unknown>
		payload: unknown
	}

	/** Identifies a tool settlement without fixing its evolving business payload shape. */
	export type ToolCallSettledEvent = RuntimeEventEnvelope<"toolCall.settled">

	/** Identifies a task completion without fixing its evolving business payload shape. */
	export type TaskCompletedEvent = RuntimeEventEnvelope<"task.completed">

	/** Identifies a new message stream generation without fixing its evolving payload shape. */
	export type MessageStreamStartedEvent = RuntimeEventEnvelope<"message.stream.started">

	/** Maps runtime event names to the exact payload delivered to host listeners. */
	export interface RuntimeEventMap {
		"message.stream.started": MessageStreamStartedEvent
		"toolCall.settled": ToolCallSettledEvent
		"task.completed": TaskCompletedEvent
	}

	export type RuntimeEvent = RuntimeEventMap[RuntimeEventName]
	export type RuntimeEventListener<T extends RuntimeEventName> = (
		event: RuntimeEventMap[T],
	) => void

	/** Identifies the bounded custom Mention rule that removed host-provided content. */
	export type ConfigWarningReason =
		| "MAX_GROUPS"
		| "MAX_ITEMS_PER_GROUP"
		| "MAX_TOTAL_ITEMS"
		| "MAX_ITEM_BYTES"
		| "MAX_PAYLOAD_BYTES"

	/** Describes one non-fatal configuration adjustment made before rendering. */
	export interface ConfigWarning {
		code: "CUSTOM_MENTION_FILTERED"
		message: string
		details: {
			droppedGroups: number
			droppedItems: number
			reasons: ConfigWarningReason[]
		}
	}

	/** Handles non-fatal configuration diagnostics that the host may surface in its own UI. */
	export type ConfigWarningEventListener = (warning: ConfigWarning) => void

	/** Lists lifecycle, UI state, and runtime events exposed to the embedding host. */
	export type EventName =
		"agent_ready" | "preview_fullscreen" | "config.warning" | RuntimeEventName
	/** Handles notifications that the current Agent editor and draft state are ready. */
	export type AgentReadyEventListener = () => void
	/**
	 * Handles complete snapshots of whether the Agent preview is using fullscreen presentation.
	 * @param isFullscreen Whether the current Agent preview is presented fullscreen.
	 */
	export type PreviewFullscreenEventListener = (isFullscreen: boolean) => void

	export interface Controller {
		mount(options: MountOptions): void
		open(): void
		close(): void
		destroy(): void
		/** Subscribes to Agent readiness and returns a function that removes the listener. */
		on(event: "agent_ready", listener: AgentReadyEventListener): () => void
		/**
		 * Subscribes to preview fullscreen state and immediately replays the current boolean snapshot.
		 * The host owns any container resizing or fullscreen styling triggered by this state.
		 */
		on(event: "preview_fullscreen", listener: PreviewFullscreenEventListener): () => void
		/** Subscribes to non-fatal configuration filtering diagnostics. */
		on(event: "config.warning", listener: ConfigWarningEventListener): () => void
		/** Subscribes to future message stream starts without replaying earlier generations. */
		on(
			event: "message.stream.started",
			listener: RuntimeEventListener<"message.stream.started">,
		): () => void
		/** Subscribes to future tool settlements without replaying earlier results. */
		on(
			event: "toolCall.settled",
			listener: RuntimeEventListener<"toolCall.settled">,
		): () => void
		/** Subscribes to future task completion events without replaying earlier results. */
		on(event: "task.completed", listener: RuntimeEventListener<"task.completed">): () => void
		setInput(content: string | InputContent): Promise<void>
		appendInput(content: string | InputContent): Promise<void>
		clearInput(): Promise<void>
		getInput(): Promise<string>
		sendMessage(content?: string | InputContent): Promise<void>
		newConversation(): Promise<void>
		updateConfig(config: Partial<WidgetConfig>): Promise<void>
	}

	export interface Global extends Controller {
		version: string
	}
}
