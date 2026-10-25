import { useCallback, useEffect, useState } from "react"
import { reaction } from "mobx"
import { FunctionPermissionApi } from "@/apis"
import {
	PLATFORM_SUPER_ADMIN_PERMISSION_KEY,
	type FunctionPermissionCode,
	type FunctionPermissionMap,
} from "@/apis"
import { userStore } from "@/models/user"

type FunctionPermissionState = {
	data?: FunctionPermissionMap
	error?: unknown
	isLoading: boolean
}

type PlatformPermissionState = {
	permissionKeys?: string[]
	error?: unknown
	isLoading: boolean
}

const listeners = new Set<() => void>()

let permissionCache: FunctionPermissionMap | undefined
let permissionError: unknown
let permissionRequest: Promise<FunctionPermissionMap> | null = null
let hasRequestedPermission = false
let requestVersion = 0
let permissionContextKey = ""
let disposePermissionContextReaction: (() => void) | undefined

const getCurrentUserId = () => userStore.user.userInfo?.user_id ?? ""
const getPermissionContextKey = () =>
	`${getCurrentUserId()}:${userStore.user.organizationCode ?? ""}`

const notifyListeners = () => {
	listeners.forEach((listener) => listener())
}

const getPermissionState = (): FunctionPermissionState => ({
	data: permissionContextKey === getPermissionContextKey() ? permissionCache : undefined,
	error: permissionContextKey === getPermissionContextKey() ? permissionError : undefined,
	isLoading:
		permissionContextKey !== getPermissionContextKey() ||
		permissionRequest != null ||
		!hasRequestedPermission,
})

const resetFunctionPermissions = (contextKey = getPermissionContextKey()) => {
	permissionCache = undefined
	permissionError = undefined
	permissionRequest = null
	hasRequestedPermission = false
	permissionContextKey = contextKey
	requestVersion += 1
	notifyListeners()
}

const fetchFunctionPermissions = (force = false) => {
	const currentContextKey = getPermissionContextKey()
	if (permissionContextKey !== currentContextKey) {
		resetFunctionPermissions(currentContextKey)
	}

	if (permissionRequest && !force) return permissionRequest
	if (!force && permissionCache) return Promise.resolve(permissionCache)

	hasRequestedPermission = true
	permissionError = undefined
	const currentRequestVersion = requestVersion + 1
	requestVersion = currentRequestVersion
	const request = FunctionPermissionApi.getMe()
		.then((permissions) => {
			if (currentRequestVersion === requestVersion) {
				permissionCache = permissions
			}
			return permissions
		})
		.catch((error: unknown) => {
			if (currentRequestVersion === requestVersion) {
				permissionError = error
			}
			throw error
		})
		.finally(() => {
			if (currentRequestVersion === requestVersion) {
				permissionRequest = null
				notifyListeners()
			}
		})

	permissionRequest = request
	notifyListeners()
	return request
}

const startPermissionContextReaction = () => {
	if (disposePermissionContextReaction) return

	disposePermissionContextReaction = reaction(
		getPermissionContextKey,
		(contextKey, previousContextKey) => {
			if (contextKey === previousContextKey) return
			resetFunctionPermissions(contextKey)
			void fetchFunctionPermissions().catch(() => undefined)
		},
	)
}

const stopPermissionContextReaction = () => {
	if (listeners.size > 0) return

	disposePermissionContextReaction?.()
	disposePermissionContextReaction = undefined
}

const platformPermissionListeners = new Set<() => void>()

let platformPermissionCache: string[] | undefined
let platformPermissionError: unknown
let platformPermissionRequest: Promise<string[]> | null = null
let hasRequestedPlatformPermission = false
let platformPermissionContextKey = ""
let platformPermissionRequestVersion = 0
let disposePlatformPermissionReaction: (() => void) | undefined

const notifyPlatformPermissionListeners = () => {
	platformPermissionListeners.forEach((listener) => listener())
}

const getPlatformPermissionState = (): PlatformPermissionState => {
	const contextKey = getPermissionContextKey()

	return {
		permissionKeys:
			platformPermissionContextKey === contextKey ? platformPermissionCache : undefined,
		error: platformPermissionContextKey === contextKey ? platformPermissionError : undefined,
		isLoading:
			platformPermissionContextKey !== contextKey ||
			platformPermissionRequest != null ||
			!hasRequestedPlatformPermission,
	}
}

const resetPlatformPermission = (contextKey = getPermissionContextKey()) => {
	platformPermissionCache = undefined
	platformPermissionError = undefined
	platformPermissionRequest = null
	hasRequestedPlatformPermission = false
	platformPermissionContextKey = contextKey
	platformPermissionRequestVersion += 1
	notifyPlatformPermissionListeners()
}

const fetchPlatformPermissions = (force = false) => {
	const contextKey = getPermissionContextKey()
	if (platformPermissionContextKey !== contextKey) {
		resetPlatformPermission(contextKey)
	}

	if (platformPermissionRequest && !force) return platformPermissionRequest
	if (!force && platformPermissionCache !== undefined) {
		return Promise.resolve(platformPermissionCache)
	}

	hasRequestedPlatformPermission = true
	platformPermissionError = undefined
	const currentRequestVersion = platformPermissionRequestVersion + 1
	platformPermissionRequestVersion = currentRequestVersion
	const request = FunctionPermissionApi.getPermissionGroups()
		.then(({ permission_key }) => {
			const permissionKeys = Array.isArray(permission_key) ? permission_key : []
			if (currentRequestVersion === platformPermissionRequestVersion) {
				platformPermissionCache = permissionKeys
			}
			return permissionKeys
		})
		.catch((error: unknown) => {
			if (currentRequestVersion === platformPermissionRequestVersion) {
				platformPermissionError = error
			}
			throw error
		})
		.finally(() => {
			if (currentRequestVersion === platformPermissionRequestVersion) {
				platformPermissionRequest = null
				notifyPlatformPermissionListeners()
			}
		})

	platformPermissionRequest = request
	notifyPlatformPermissionListeners()
	return request
}

const startPlatformPermissionReaction = () => {
	if (disposePlatformPermissionReaction) return

	disposePlatformPermissionReaction = reaction(
		getPermissionContextKey,
		(contextKey, previous) => {
			if (contextKey === previous) return
			resetPlatformPermission(contextKey)
			void fetchPlatformPermissions().catch(() => undefined)
		},
	)
}

const stopPlatformPermissionReaction = () => {
	if (platformPermissionListeners.size > 0) return

	disposePlatformPermissionReaction?.()
	disposePlatformPermissionReaction = undefined
}

const usePlatformPermissionKeys = (enabled: boolean) => {
	const [state, setState] = useState<PlatformPermissionState>(getPlatformPermissionState)

	useEffect(() => {
		if (!enabled) return

		const handleStateChange = () => setState(getPlatformPermissionState())
		platformPermissionListeners.add(handleStateChange)
		startPlatformPermissionReaction()
		handleStateChange()
		void fetchPlatformPermissions().catch(() => undefined)

		return () => {
			platformPermissionListeners.delete(handleStateChange)
			stopPlatformPermissionReaction()
		}
	}, [enabled])

	const mutate = useCallback(() => fetchPlatformPermissions(true), [])

	return enabled
		? { ...state, mutate }
		: {
				permissionKeys: undefined,
				error: undefined,
				isLoading: false,
				mutate,
			}
}

const usePlatformSuperAdmin = (enabled: boolean) => {
	const { permissionKeys, error, isLoading } = usePlatformPermissionKeys(enabled)

	return {
		isSuperAdmin:
			enabled && permissionKeys?.includes(PLATFORM_SUPER_ADMIN_PERMISSION_KEY) === true,
		error,
		isLoading,
	}
}

export interface UsePermissionKeyOptions {
	/** Allow platform super administrators to bypass a missing permission key. */
	allowSuperAdmin?: boolean
}

/**
 * Check a permission key returned by `/api/v1/permissions/me`.
 * This hook intentionally does not request `/api/v1/function-permissions/me`.
 */
export const usePermissionKey = (permissionKey: string, options: UsePermissionKeyOptions = {}) => {
	const { permissionKeys, error, isLoading, mutate } = usePlatformPermissionKeys(true)
	const directPermissionGranted = permissionKeys?.includes(permissionKey) === true
	const superAdminGranted =
		options.allowSuperAdmin === true &&
		permissionKeys?.includes(PLATFORM_SUPER_ADMIN_PERMISSION_KEY) === true

	return {
		error,
		isAllowed: directPermissionGranted || superAdminGranted,
		isLoading,
		mutate,
		permissionKeys,
	}
}

export const useFunctionPermissions = () => {
	const [state, setState] = useState<FunctionPermissionState>(getPermissionState)

	useEffect(() => {
		const handleStateChange = () => setState(getPermissionState())

		listeners.add(handleStateChange)
		startPermissionContextReaction()
		void fetchFunctionPermissions().catch(() => undefined)

		return () => {
			listeners.delete(handleStateChange)
			stopPermissionContextReaction()
		}
	}, [])

	const mutate = useCallback(() => fetchFunctionPermissions(true), [])

	return {
		...state,
		mutate,
	}
}

export interface UseFunctionPermissionOptions {
	/** Allow platform super administrators to bypass a missing function permission. */
	allowSuperAdmin?: boolean
}

export const useFunctionPermission = (
	code: FunctionPermissionCode,
	options: UseFunctionPermissionOptions = {},
) => {
	const { data, error, isLoading, mutate } = useFunctionPermissions()
	const directPermissionGranted = data?.[code] === true
	const shouldCheckSuperAdmin =
		options.allowSuperAdmin === true && !isLoading && !directPermissionGranted
	const platformSuperAdmin = usePlatformSuperAdmin(shouldCheckSuperAdmin)
	const refresh = useCallback(async () => {
		const permissions = await mutate()
		if (options.allowSuperAdmin === true && permissions?.[code] !== true) {
			await fetchPlatformPermissions(true)
		}
		return permissions
	}, [code, mutate, options.allowSuperAdmin])

	return {
		error: error ?? platformSuperAdmin.error,
		isAllowed: directPermissionGranted || platformSuperAdmin.isSuperAdmin,
		isLoading: isLoading || platformSuperAdmin.isLoading,
		mutate: refresh,
		permissions: data,
	}
}
