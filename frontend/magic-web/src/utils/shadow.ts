const Prefix = "SHADOWED_"
const PrefixV2 = "SHADOWED2_"

const shuffleMap = [
	0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
	26, 27, 28, 29, 30, 31, 122, 34, 45, 86, 60, 103, 51, 114, 64, 52, 68, 91, 40, 90, 48, 126, 110,
	63, 124, 77, 98, 50, 73, 66, 113, 97, 79, 37, 102, 76, 32, 87, 96, 54, 111, 44, 101, 116, 93,
	57, 59, 84, 58, 108, 120, 94, 69, 41, 74, 62, 99, 105, 95, 53, 115, 49, 43, 47, 82, 100, 61, 71,
	125, 72, 119, 56, 83, 81, 42, 109, 35, 46, 92, 89, 75, 112, 55, 67, 70, 85, 118, 117, 39, 104,
	33, 65, 121, 38, 123, 88, 107, 78, 80, 106, 36, 127, 129, 128, 131, 130, 133, 132, 135, 134,
	137, 136, 139, 138, 141, 140, 143, 142, 145, 144, 147, 146, 149, 148, 151, 150, 153, 152, 155,
	154, 157, 156, 159, 158, 161, 160, 163, 162, 165, 164, 167, 166, 169, 168, 171, 170, 173, 172,
	175, 174, 177, 176, 179, 178, 181, 180, 183, 182, 185, 184, 187, 186, 189, 188, 191, 190, 193,
	192, 195, 194, 197, 196, 199, 198, 201, 200, 203, 202, 205, 204, 207, 206, 209, 208, 211, 210,
	213, 212, 215, 214, 217, 216, 219, 218, 221, 220, 223, 222, 225, 224, 227, 226, 229, 228, 231,
	230, 233, 232, 235, 234, 237, 236, 239, 238, 241, 240, 243, 242, 245, 244, 247, 246, 249, 248,
	251, 250, 253, 252, 255, 254,
]
const unshuffleMap = [
	0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
	26, 27, 28, 29, 30, 31, 62, 116, 33, 102, 126, 59, 119, 114, 44, 79, 100, 88, 67, 34, 103, 89,
	46, 87, 53, 38, 41, 85, 65, 108, 97, 71, 74, 72, 36, 92, 81, 49, 40, 117, 55, 109, 42, 78, 110,
	93, 95, 54, 80, 106, 61, 51, 123, 58, 124, 99, 90, 98, 73, 111, 35, 63, 121, 105, 45, 43, 104,
	70, 77, 84, 64, 57, 52, 82, 91, 68, 60, 37, 115, 83, 125, 122, 75, 101, 48, 66, 107, 56, 39, 86,
	69, 113, 112, 96, 76, 118, 32, 120, 50, 94, 47, 127, 129, 128, 131, 130, 133, 132, 135, 134,
	137, 136, 139, 138, 141, 140, 143, 142, 145, 144, 147, 146, 149, 148, 151, 150, 153, 152, 155,
	154, 157, 156, 159, 158, 161, 160, 163, 162, 165, 164, 167, 166, 169, 168, 171, 170, 173, 172,
	175, 174, 177, 176, 179, 178, 181, 180, 183, 182, 185, 184, 187, 186, 189, 188, 191, 190, 193,
	192, 195, 194, 197, 196, 199, 198, 201, 200, 203, 202, 205, 204, 207, 206, 209, 208, 211, 210,
	213, 212, 215, 214, 217, 216, 219, 218, 221, 220, 223, 222, 225, 224, 227, 226, 229, 228, 231,
	230, 233, 232, 235, 234, 237, 236, 239, 238, 241, 240, 243, 242, 245, 244, 247, 246, 249, 248,
	251, 250, 253, 252, 255, 254,
]

/** 默认写入 ASCII 安全的 V2，避免 UTF-8 替换造成正文丢失。 */
export function shadow(input: string): string {
	return shadowV2(input)
}

/** 识别旧格式、新格式及需要明确报错的未知版本。 */
export function isShadowed(input: string): boolean {
	return /^SHADOWED(?:[0-9]+)?_/.test(input)
}

/** 将任意有效 Unicode 文本编码为只包含 ASCII 的 V2 载荷。 */
export function shadowV2(input: string): string {
	// TextEncoder 会替换孤立代理项，先校验避免把非法输入静默改成其他字符。
	assertValidUnicode(input)
	const bytes = new TextEncoder().encode(input)
	for (let i = 0; i < bytes.length; i += 1) bytes[i] = shuffleMap[bytes[i]]
	let binary = ""
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	}
	return PrefixV2 + btoa(binary)
}

/** 校验 UTF-16 字符串，合法代理对保留，孤立代理项拒绝。 */
function assertValidUnicode(input: string): void {
	for (let i = 0; i < input.length; i += 1) {
		const code = input.charCodeAt(i)
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = input.charCodeAt(i + 1)
			if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("Invalid shadow payload")
			i += 1
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			throw new Error("Invalid shadow payload")
		}
	}
}

/** 兼容读取 V1/V2；无标记文本保持原样，错误的新载荷不降级。 */
export function unshadow(input: string): string {
	if (input.startsWith(PrefixV2)) {
		try {
			const payload = input.slice(PrefixV2.length)
			const binary = atob(payload)
			if (btoa(binary) !== payload) throw new Error("Invalid shadow payload")
			const bytes = new Uint8Array(binary.length)
			for (let i = 0; i < binary.length; i += 1) {
				bytes[i] = unshuffleMap[binary.charCodeAt(i)]
			}
			// 忽略 BOM 的特殊处理，确保正文开头的 U+FEFF 也能原样还原。
			return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
		} catch {
			throw new Error("Invalid shadow payload")
		}
	}
	if (/^SHADOWED[0-9]+_/.test(input)) throw new Error("Unsupported shadow version")
	if (!input.startsWith(Prefix)) return input
	const u8Arr = new TextEncoder().encode(input.slice(Prefix.length))
	for (let i = 0; i < u8Arr.length; i += 1) u8Arr[i] = unshuffleMap[u8Arr[i]]
	return new TextDecoder("utf-8", { ignoreBOM: true }).decode(u8Arr)
}
