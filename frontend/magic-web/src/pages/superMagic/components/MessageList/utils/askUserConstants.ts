import {
	AskUserInteractionType,
	ASK_USER_NODE_STATUS as ASK_USER_NODE_STATUS_FROM_MESSAGE,
} from "@/types/chat/conversation_message"

export const ASK_USER_CONFIRM_VALUE = {
	yes: "是",
	no: "否",
} as const
export type AskUserConfirmValue =
	(typeof ASK_USER_CONFIRM_VALUE)[keyof typeof ASK_USER_CONFIRM_VALUE]

export const ASK_USER_OTHER_OPTION = {
	english: "other",
	chineseVariants: ["其他", "其它"] as const,
} as const

export const ASK_USER_AUTO_SUBMIT_MINUTES = 10

export const ASK_USER_INTERACTION_TYPE = {
	confirm: AskUserInteractionType.Confirm,
	input: AskUserInteractionType.Input,
	select: AskUserInteractionType.Select,
	multiSelect: AskUserInteractionType.MultiSelect,
} as const

export const ASK_USER_CARD_STATUS = {
	pending: "pending",
	answered: "answered",
	skipped: "skipped",
	timeout: "timeout",
	cancelled: "cancelled",
} as const
export type AskUserCardStatusValue =
	(typeof ASK_USER_CARD_STATUS)[keyof typeof ASK_USER_CARD_STATUS]

export const ASK_USER_RESPONSE_STATUS = {
	answered: "answered",
	skipped: "skipped",
} as const
export type AskUserResponseStatusValue =
	(typeof ASK_USER_RESPONSE_STATUS)[keyof typeof ASK_USER_RESPONSE_STATUS]

export const ASK_USER_NODE_STATUS = {
	...ASK_USER_NODE_STATUS_FROM_MESSAGE,
	timeout: "timeout",
	cancelled: "cancelled",
} as const

export const ASK_USER_TOOL = {
	name: "ask_user",
	beforeToolCallEvent: "before_tool_call",
	afterToolCallEvent: "after_tool_call",
} as const

export const ASK_USER_TIME = {
	msPerSecond: 1000,
	secondsPerMinute: 60,
	minutesPerHour: 60,
	countdownTickMs: 1000,
} as const
