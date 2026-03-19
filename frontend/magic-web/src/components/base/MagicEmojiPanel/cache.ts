import emojiJsons from "./emojis.json"

// emoji 语言缓存
export const emojiLocaleCache = new Map()
// emoji 表情缓存
export const emojiFilePathCache = new Map()
// emoji 表情皮肤缓存
export const emojiSkinTones = new Map()

// 初始化 emoji 语言缓存
emojiJsons.emojis.forEach(({ code, names, skinTones, filePath }) => {
	emojiLocaleCache.set(code, names)
	emojiSkinTones.set(code, skinTones)
	emojiFilePathCache.set(code, filePath)
})
