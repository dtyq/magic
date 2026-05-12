import { useCallback, useEffect, useState } from "react"
import { reaction } from "mobx"
import { FunctionPermissionApi } from "@/apis"
import type { FunctionPermissionCode, FunctionPermissionMap } from "@/apis"
import { userStore } from "@/models/user"

type FunctionPermissionState = {
	data?: FunctionPermissionMap
	error?: unknown
	isLoading: boolean
}

const listeners = new Set<() => void>()

let permissionCache: FunctionPermissionMap | undefined
let permissionError: unknown
let permissionRequest: Promise<FunctionPermissionMap> | null = null
let hasRequestedPermission = false
let requestVersion = 0
let permissionUserId = ""
let disposeUserIdReaction: (() => void) | undefined

const getCurrentUserId = () => userStore.user.userInfo?.user_id ?? ""

const notifyListeners = () => {
	listeners.forEach((listener) => listener())
}

const getPermissionState = (): FunctionPermissionState => ({
	data: permissionUserId === getCurrentUserId() ? permissionCache : undefined,
	error: permissionUserId === getCurrentUserId() ? permissionError : undefined,
	isLoading:
		permissionUserId !== getCurrentUserId() ||
		permissionRequest != null ||
		!hasRequestedPermission,
})

const resetFunctionPermissions = (userId = getCurrentUserId()) => {
	permissionCache = undefined
	permissionError = undefined
	permissionRequest = null
	hasRequestedPermission = false
	permissionUserId = userId
	requestVersion += 1
	notifyListeners()
}

const fetchFunctionPermissions = (force = false) => {
	const currentUserId = getCurrentUserId()
	if (permissionUserId !== currentUserId) {
		resetFunctionPermissions(currentUserId)
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

const startUserIdReaction = () => {
	if (disposeUserIdReaction) return

	disposeUserIdReaction = reaction(getCurrentUserId, (userId, previousUserId) => {
		if (userId === previousUserId) return
		resetFunctionPermissions(userId)
		void fetchFunctionPermissions().catch(() => undefined)
	})
}

const stopUserIdReaction = () => {
	if (listeners.size > 0) return

	disposeUserIdReaction?.()
	disposeUserIdReaction = undefined
}

export const useFunctionPermissions = () => {
	const [state, setState] = useState<FunctionPermissionState>(getPermissionState)

	useEffect(() => {
		const handleStateChange = () => setState(getPermissionState())

		listeners.add(handleStateChange)
		startUserIdReaction()
		void fetchFunctionPermissions().catch(() => undefined)

		return () => {
			listeners.delete(handleStateChange)
			stopUserIdReaction()
		}
	}, [])

	const mutate = useCallback(() => fetchFunctionPermissions(true), [])

	return {
		...state,
		mutate,
	}
}

export const useFunctionPermission = (code: FunctionPermissionCode) => {
	const { data, error, isLoading, mutate } = useFunctionPermissions()

	return {
		error,
		isAllowed: data?.[code] === true,
		isLoading,
		mutate,
		permissions: data,
	}
}
