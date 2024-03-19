/**
 * 用户选择类型
 */
export const UserChoice = {
	REPLACE: "replace",
	KEEP_BOTH: "keep-both",
	CANCEL: "cancel",
} as const

export type UserChoiceType = (typeof UserChoice)[keyof typeof UserChoice]

/**
 * 应用模式
 */
export const ApplyMode = {
	ASK_EACH: "ask-each",
	REPLACE_ALL: "replace-all",
	KEEP_BOTH_ALL: "keep-both-all",
} as const

export type ApplyModeType = (typeof ApplyMode)[keyof typeof ApplyMode]
