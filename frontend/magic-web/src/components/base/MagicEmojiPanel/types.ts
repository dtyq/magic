export type EmojiJsonBase = {
	names: Record<string, string>
	filePath: string
	code: string
}

export type EmojiTone = {
	tone: string
	filePath: string
	code: string
}

export type EmojiJson = EmojiJsonBase & {
	skinTones?: EmojiTone[]
}

export type EmojiInfo = {
	/** 表情 code */
	code: string
	/** 表情命名空间 */
	ns: string
	/** 表情后缀 */
	suffix?: string
	/** 肤色 */
	tone?: string
	/** 表情大小 */
	size?: number
}
