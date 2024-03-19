// 模拟 lodash-es 的 omit 函数
export function omit(obj: Record<string, any>, fields: string | string[]) {
	const result: Record<string, any> = {}
	const fieldsArray = typeof fields === "string" ? [fields] : fields

	Object.keys(obj || {}).forEach((key) => {
		if (!fieldsArray.includes(key)) {
			result[key] = obj[key]
		}
	})

	return result
}
