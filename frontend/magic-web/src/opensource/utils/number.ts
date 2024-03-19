/**
 * 将数值格式化为带千分位分隔符的字符串
 * @param number 数值
 * @returns 格式化后的数值
 */
export function splitNumber(
	number: number,
	delimiterPosition: number = 3,
	char: string = ",",
): string {
	// 将数值转换为字符串
	const numStr: string = number.toString()
	// 将小数点前的部分与小数点后的部分分离
	const parts: string[] = numStr.split(".")

	// 将整数部分添加千分位分隔符
	parts[0] = parts[0].replace(new RegExp(`\\B(?=(\\d{${delimiterPosition}})+(?!\\d))`, "g"), char)

	// 返回格式化后的数值
	return parts.join(".")
}

/**
 * 将大于1000的数值格式化为K结尾的形式
 * @param number 要格式化的数值
 * @returns 格式化后的字符串，无效数值返回空字符串
 */
export function formatToK(number: number): string {
	// 检查参数是否为有效数值
	if (Number.isNaN(number) || !Number.isFinite(number)) {
		return ""
	}

	// 不超过1000的直接返回字符串形式
	if (number < 1000) {
		return number.toString()
	}

	// 计算以K为单位的值（向下取整）
	const kValue = Math.floor(number / 1000)

	// 返回格式化后的值，以K结尾
	return `${kValue}K`
}

/**
 * 将数值格式化为带千分位分隔符的字符串，超过6位数时使用k结尾
 * @param number 要格式化的数值
 * @param delimiterPosition 分隔符位置，默认为3（千分位）
 * @param char 分隔符字符，默认为逗号
 * @returns 格式化后的字符串，无效数值返回空字符串
 */
export function formatNumberWithK(
	number: number,
	delimiterPosition: number = 3,
	char: string = ",",
): string {
	// 检查参数是否为有效数值
	if (Number.isNaN(number) || !Number.isFinite(number)) {
		return ""
	}

	// 超过6位数（100,000及以上）时使用K结尾
	if (number >= 100000) {
		// 计算以K为单位的值（向下取整）
		const kValue = Math.floor(number / 1000)
		// 对K值进行千分位格式化
		return `${splitNumber(kValue, delimiterPosition, char)}K`
	}

	// 不超过6位数的使用千分位分隔符格式化
	return splitNumber(number, delimiterPosition, char)
}

/**
 * 将字节数转换为 GB 或 TB 格式的字符串
 * @param bytes 字节数
 * @returns 格式化后的存储容量字符串（如："10GB", "2TB"）
 */
export function formatBytes(bytes?: string): string {
	const bytesNumber = Number(bytes)
	// 检查参数是否为有效数值
	if (Number.isNaN(bytesNumber) || !Number.isFinite(bytesNumber) || bytesNumber < 0) {
		return "0GB"
	}

	// 定义存储单位的字节数
	const GB = 1024 * 1024 * 1024 // 1,073,741,824 bytes
	const TB = 1024 * GB // 1,099,511,627,776 bytes

	// 如果大于等于1TB，转换为TB
	if (bytesNumber >= TB) {
		const tbValue = bytesNumber / TB
		// 保留1位小数，去除末尾的0
		const formatted =
			tbValue % 1 === 0 ? tbValue.toString() : tbValue.toFixed(1).replace(/\.0$/, "")
		return `${formatted}TB`
	}

	// 否则转换为GB
	const gbValue = bytesNumber / GB
	// 保留1位小数，去除末尾的0
	const formatted =
		gbValue % 1 === 0 ? gbValue.toString() : gbValue.toFixed(1).replace(/\.0$/, "")
	return `${formatted}GB`
}
