import { resolveToString } from "@dtyq/es6-template-strings"
import { isArray, isUndefined } from "lodash-es"

/**
 * 生成请求地址
 * @param url 请求地址模板
 * @param params 参数列表
 * @returns 请求地址
 */
export function genRequestUrl(
	url: string,
	params: Record<string, string | number | null> = {},
	queries?: Record<string, string | number | null | undefined | any>,
) {
	const requestUrl = resolveToString(url, params)
	const stringifyQueries = Object.entries(queries ?? {}).reduce<string[][]>(
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
	/** 因兼容低版本浏览器所以不能使用 pars.size */
	if (stringifyQueries.length > 0) {
		return `${requestUrl}?${pars.toString()}`
	}
	return requestUrl
}

/**
 * 判断是否是有效的 URL
 * @param url
 * @returns
 */
export function isValidUrl(url: string) {
	return /^https?:\/\//.test(url)
}

/**
 * 判断是否是有效的 URL
 * @param text
 * @returns
 */
export function isUrl(text: string) {
	if (text.match(/\n/)) {
		return false
	}

	try {
		const url = new URL(text)
		return url.hostname !== ""
	} catch (err) {
		return false
	}
}
