// 一个简单的CRC32查找表（完整的CRC32实现会更复杂）
const table: number[] = []
for (let i = 0; i < 256; i += 1) {
	let c = i
	for (let j = 0; j < 8; j += 1) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
	}
	table[i] = c
}

function crc32(str: string) {
	let crc = 0
	for (let i = 0; i < str.length; i += 1) {
		crc = ((crc >>> 8) ^ table[(crc ^ str.charCodeAt(i)) & 0xff]) & 0xffffffff
	}
	return crc
}

export function textToColors(text: string) {
	const hash = crc32(text)

	const r = (hash >> 16) & 0xff

	const g = (hash >> 8) & 0xff

	const b = hash & 0xff

	// 定义一个数组来存储生成的相近颜色值
	const colors: string[] = []

	// 生成5个相近颜色值（可根据需要调整数量）
	for (let i = 0; i < 5; i += 1) {
		const newR = Math.max(0, Math.min(255, r + (i - 5) * 10))
		const newG = Math.max(0, Math.min(255, g + (i - 1) * 10))
		const newB = Math.max(0, Math.min(255, b + (i - 2) * 10))
		colors.push(`rgb(${newR},${newG},${newB})`)
	}

	return colors
}

export function textToBackgroundColor(name?: string) {
	if (!name) return ""

	let hash = 0
	for (let i = 0; i < name.length; i += 1) {
		hash += name.charCodeAt(i)
	}
	const hue = (hash % 360) + 10 // 确保色调在10到360之间
	const saturation = 60 + (hash % 20) // 确保饱和度在60到80之间
	const lightness = 40 + (hash % 20) // 确保亮度在40到60之间

	// 确保生成的颜色柔和舒适
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export function textToTextColor(name?: string) {
	if (!name) return ""
	// 判断是中文名还是英文名
	const isChinese = name.match(/[\u4e00-\u9fa5]/)
	if (isChinese) {
		// 截取中文名的后两个字符
		return name.slice(-2)
	}
	// 截取英文名的第一个大写字母
	return name[0]?.toUpperCase() ?? ""
}

export const isValidUrl = (url: string) => {
	return /^https?:\/\//.test(url)
}
