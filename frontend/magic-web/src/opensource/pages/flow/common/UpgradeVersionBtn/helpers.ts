/**
 * 比较两个版本号的大小
 * @param version1 版本号1，例如 "v0", "v1", "v2"
 * @param version2 版本号2，例如 "v0", "v1", "v2"
 * @returns
 *   - 如果 version1 > version2，返回 1
 *   - 如果 version1 < version2，返回 -1
 *   - 如果 version1 === version2，返回 0
 */
export function compareNodeVersion(version1: string, version2: string): number {
	// 提取版本号中的数字部分
	const v1Number = parseInt(version1.replace("v", ""), 10)
	const v2Number = parseInt(version2.replace("v", ""), 10)

	// 比较数字大小
	if (v1Number > v2Number) {
		return 1
	}
	if (v1Number < v2Number) {
		return -1
	}
	return 0
}
