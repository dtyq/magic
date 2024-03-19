import { HttpException, HttpExceptionCode } from "../Exception/HttpException"
import { InitException, InitExceptionCode } from "../Exception/InitException"
import type { GlobalCache, PlatformParams, Request, UploadSource } from "../types"
import { request } from "./request"
import type { Result } from "../types/request"

const globalCache: GlobalCache<PlatformParams> = {
	// "http://xxx": {
	// 	platform: PlatformType.OSS,
	// 	temporary_credential: {} as AuthParams,
	// 	expire: 0
	// }
}

interface Task {
	resolve: (uploadSource: any) => void
	reject: (err: Error) => void
}

let running = false
const tasks: Task[] = []

async function fetchUploadConfig<T extends PlatformParams>(uploadSource: Request) {
	const { url, method, headers, body } = uploadSource
	const { code, data, message } = await request<Result<UploadSource<T>>>({
		url,
		method: method || "GET",
		headers: headers || {},
		data: body,
		fail: (status, reject) => {
			reject(new HttpException(HttpExceptionCode.REQUEST_FAILED_WITH_STATUS_CODE, status))
		},
	})

	if (code !== 1000) {
		throw new InitException(InitExceptionCode.UPLOAD_REQUEST_CREDENTIALS_ERROR, message)
	}
	globalCache[url] = data

	return data
}

function runTask<T extends PlatformParams>(uploadSource: Request, useCache: Boolean) {
	const { url } = uploadSource
	running = true
	const task = tasks.shift()
	let isResolve = false
	// 是否存在该 url 请求缓存
	if (Object.keys(globalCache).includes(url) && useCache) {
		const { expire } = globalCache[url]
		// 判断后端返回值是否具有 expire 字段
		if (expire) {
			// ps: 距离过期还有 10分钟重新请求临时凭证
			if (new Date(expire * 1000 - 60 * 10 * 1000).getTime() > Date.now()) {
				task?.resolve(globalCache[url] as UploadSource<T>)
				isResolve = true
			}
		} else {
			// eslint-disable-next-line no-console
			console.warn(
				`[Upload SDK]: Receive request return value does not contain "expire" field, please contact the back end for confirmation`,
			)
		}
	}

	new Promise<void>((resolve) => {
		if (!isResolve) {
			fetchUploadConfig(uploadSource)
				.then((data) => {
					task?.resolve({ ...data } as UploadSource<T>)
				})
				.catch((err) => {
					task?.reject(err)
				})
				.finally(() => {
					resolve()
				})
		} else {
			resolve()
		}
	}).finally(() => {
		running = false

		if (tasks.length > 0) {
			runTask(uploadSource, useCache)
		}
	})
}

/**
 * @description: 判断临时凭证是否过期，如果过期，则重新获取临时凭证
 * @param {Request} uploadSource
 * @param useCache
 */
export function getUploadConfig<T extends PlatformParams>(
	uploadSource: Request,
	useCache: boolean = true, // 不使用缓存
): Promise<UploadSource<T>> {
	return new Promise((resolve, reject) => {
		tasks.push({ resolve, reject })
		if (!running) {
			runTask(uploadSource, useCache)
		}
	})
}
