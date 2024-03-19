//@ts-ignore
import SnowFlakeId from "snowflake-id"

/**
 * @description 随机生成
 * @param min
 * @param max
 * @return {*}
 */
export const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

/**
 * @description 随机生成不同类型的指定长度字符串
 * @param len
 * @param type
 * @param {string} prexfix
 * @return {string}
 */
export const randomString = (len = 64, type = "default", prexfix = "") => {
	const strMap: Record<string, string> = {
		default: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
		number: "0123456789",
		lowerCase: "abcdefghijklmnopqrstuvwxyz",
		upperCase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	}
	let result = ""

	const str = strMap[type]
	len -= prexfix.length
	while (len--) {
		result += str[random(0, str.length - 1)]
	}
	return prexfix + result
}

// 雪花id生成
const snowflake = new SnowFlakeId({
	mid: Math.floor(Math.random() * 1e10),
	offset: (2021 - 1970) * 365 * 24 * 3600 * 1000
})

export function generateSnowFlake (prefix = "") {
	if (prefix) {
		// return prefix + md5(snowflake.generate())
		// 不再使用雪花 + md5 的组合，长度过长，数据量大，改为 8 位随机字符串
		return randomString(8)
	} else {
		return snowflake.generate()
	}
}

export default snowflake
