import { isUndefined, isArray } from "lodash-es"

export function genRequestUrl(
	baseUrl: string,
	params?: Record<string, string | number>,
	query?: Record<string, string | number | null | undefined | any>,
): string {
	// 替换 URL 中的参数
	let url = baseUrl
	Object.entries(params ?? {}).forEach(([key, value]) => {
		url = url.replace(`\${${key}}`, encodeURIComponent(String(value)))
	})

	const stringifyQueries = Object.entries(query ?? {}).reduce<string[][]>(
		(prev, [key, value]) => {
			if (!isUndefined(value) && !isArray(value)) {
				prev.push([key, `${value}`])
			} else if (isArray(value)) {
				value.forEach((item) => {
					prev.push([`${key}[]`, `${item}`])
				})
			}
			return prev
		},
		[],
	)

	const pars = new URLSearchParams(stringifyQueries)
	if (pars.size > 0) {
		url += `?${pars.toString()}`
	}
	return url
}
