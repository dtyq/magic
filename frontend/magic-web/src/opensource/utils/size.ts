export function getStringSizeInBytes(str: string) {
	// 使用UTF-8编码计算字符串的字节长度
	const totalBytes = new Blob([str]).size

	// 将字节长度转换为KB
	const sizeInKB = totalBytes / 1024

	// 返回结果
	return sizeInKB
}
