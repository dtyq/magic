import { HttpException, HttpExceptionCode } from "../Exception/HttpException"
import { InitException, InitExceptionCode } from "../Exception/InitException"
import type { GlobalCache, PlatformParams, Request, UploadSource } from "../types"
import { request } from "./request"
import type { Result } from "../types/request"
import sha256 from "crypto-js/sha256"

const AUTHORIZATION_SCOPE_LENGTH = 32

/** 上传凭证接口原始响应，仅在请求边界兼容 expire 和 expires。 */
type UploadSourceResponse<T extends PlatformParams> = Omit<UploadSource<T>, "expire"> & {
	expire?: number
	expires?: number
}

/**
 * 获取请求头中的 Authorization，兼容不同大小写写法。
 */
function getAuthorization(headers?: Record<string, string>): string | undefined {
	const authorizationEntry = Object.entries(headers ?? {}).find(
		([key]) => key.toLowerCase() === "authorization",
	)
	return authorizationEntry?.[1]
}

/**
 * 根据 Authorization 生成仅用于本地缓存隔离的短哈希值。
 */
function getAuthorizationScope(headers?: Record<string, string>): string | undefined {
	const authorization = getAuthorization(headers)
	if (!authorization) return undefined

	return sha256(authorization).toString().slice(0, AUTHORIZATION_SCOPE_LENGTH)
}

/**
 * 生成上传凭证缓存键，旧调用未携带 Authorization 时保持原有 URL 键行为。
 */
function getCacheKey(uploadSource: Request): string {
	const authorizationScope = getAuthorizationScope(uploadSource.headers)
	return authorizationScope ? `${uploadSource.url}:${authorizationScope}` : uploadSource.url
}

/**
 * 读取上传凭证的过期时间，兼容 expire 和 expires 两种字段。
 */
function getCredentialExpire(uploadSource: { expire?: number; expires?: number }): number | undefined {
	for (const value of [uploadSource.expire, uploadSource.expires]) {
		const expire = typeof value === "number" ? value : Number(value)
		if (Number.isFinite(expire) && expire > 0) return expire
	}

	return undefined
}

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
	const { code, data, message } = await request<Result<UploadSourceResponse<T>>>({
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
	const normalizedData: UploadSource<T> = {
		platform: data.platform,
		temporary_credential: data.temporary_credential,
		expire: getCredentialExpire(data) ?? 0,
	}
	globalCache[getCacheKey(uploadSource)] = normalizedData

	return normalizedData
}

function runTask<T extends PlatformParams>(uploadSource: Request, useCache: Boolean) {
	const cacheKey = getCacheKey(uploadSource)
	running = true
	const task = tasks.shift()
	let isResolve = false
	// 是否存在该 url 请求缓存
	if (Object.keys(globalCache).includes(cacheKey) && useCache) {
		const cachedUploadSource = globalCache[cacheKey]
		const { expire } = cachedUploadSource
		// 判断缓存凭证是否具有有效的过期时间
		if (expire) {
			// ps: 距离过期还有 10分钟重新请求临时凭证
			if (new Date(expire * 1000 - 60 * 10 * 1000).getTime() > Date.now()) {
				task?.resolve(cachedUploadSource as UploadSource<T>)
				isResolve = true
			}
		} else {
			// eslint-disable-next-line no-console
			console.warn(
				`[Upload SDK]: Receive request return value does not contain a valid "expire" field, please contact the back end for confirmation`,
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
