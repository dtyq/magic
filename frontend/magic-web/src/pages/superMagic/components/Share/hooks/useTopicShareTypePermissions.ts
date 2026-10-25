import { useMemo } from "react"
import type { FunctionPermissionMap } from "@/apis"
import { useFunctionPermissions } from "@/hooks/useFunctionPermission"
import { useSharePermissionResource } from "../SharePermissionResourceContext"
import { ShareType, type SharePermissionResource } from "../types"
import { getPermittedShareTypes, hasSharePermissionGroup } from "./useShareTypePermissions"

/** Topic shares only expose public access and password protection. */
export const TOPIC_SHARE_TYPES: ShareType[] = [ShareType.Public, ShareType.PasswordProtected]

export interface TopicShareTypePermissions {
	/** Permitted share types for topics, or undefined while the permission request is loading. */
	permittedTypes: ShareType[] | undefined
	/** Public access is allowed for topic shares. */
	allowsPublicShare: boolean
	/** Password protection is allowed for topic shares. */
	allowsPasswordShare: boolean
	/** No permitted method means the topic cannot be shared at all. */
	hasNoPermittedShareType: boolean
	/** Only one method is permitted, so the password switch is locked to it. */
	isPasswordSwitchLocked: boolean
	/** Method a not yet shared topic starts with, or undefined while the permissions are unknown. */
	defaultShareType: ShareType | undefined
}

/**
 * Reduces the share type permissions to the two methods a topic share can use.
 * `undefined` means the permissions are still loading, so nothing is restricted yet.
 */
export function resolveTopicShareTypePermissions(
	permittedShareTypes: ShareType[] | undefined,
): TopicShareTypePermissions {
	const permittedTypes = permittedShareTypes?.filter((type) => TOPIC_SHARE_TYPES.includes(type))
	const allowsPublicShare =
		permittedTypes === undefined || permittedTypes.includes(ShareType.Public)
	const allowsPasswordShare =
		permittedTypes === undefined || permittedTypes.includes(ShareType.PasswordProtected)

	return {
		permittedTypes,
		allowsPasswordShare,
		allowsPublicShare,
		hasNoPermittedShareType: permittedTypes?.length === 0,
		isPasswordSwitchLocked: allowsPublicShare !== allowsPasswordShare,
		// A new share keeps the password default while it is granted, and otherwise starts on the
		// method the group opened instead of writing a share the administrator closed.
		defaultShareType:
			permittedTypes === undefined
				? undefined
				: permittedTypes.includes(ShareType.PasswordProtected)
					? ShareType.PasswordProtected
					: permittedTypes[0],
	}
}

/** A share type is allowed when the permissions are unknown (still loading) or explicitly granted. */
export function isTopicShareTypePermitted(
	shareType: ShareType | undefined,
	permittedTypes: ShareType[] | undefined,
): boolean {
	if (permittedTypes === undefined || shareType === undefined) return true
	return permittedTypes.includes(shareType)
}

/**
 * Keeps the password switch on a permitted value: password protection when public access is
 * closed, public access when password protection is closed, unchanged when both are open.
 */
export function resolveTopicPasswordEnabled(
	current: boolean,
	permissions: TopicShareTypePermissions,
): boolean {
	if (!permissions.allowsPasswordShare) return false
	if (!permissions.allowsPublicShare) return true
	return current
}

/**
 * Topic shares answer to their own permission group, so closing public access on topics never
 * changes how projects or files are shared. A backend that predates that group sends no topic code
 * at all, and then the group of the page owning the dialog keeps applying.
 */
export function resolveTopicSharePermissionResource(
	permissions: FunctionPermissionMap | undefined,
	pageResource: SharePermissionResource,
): SharePermissionResource {
	return hasSharePermissionGroup(permissions, "topic") ? "topic" : pageResource
}

/**
 * Shares one cached permission request across every topic share surface. The topic group wins over
 * the page group as soon as the response carries it, which is what the server enforces when a
 * topic share is created or opened.
 */
export function useTopicShareTypePermissions(): TopicShareTypePermissions & {
	error: unknown
	isLoading: boolean
	mutate: () => void
} {
	const pageResource = useSharePermissionResource()
	const { data, error, isLoading, mutate } = useFunctionPermissions()

	const resource = useMemo(
		() => resolveTopicSharePermissionResource(data, pageResource),
		[data, pageResource],
	)
	const permittedShareTypes = useMemo(
		() => getPermittedShareTypes(data, resource),
		[data, resource],
	)

	const permissions = useMemo(
		() => resolveTopicShareTypePermissions(isLoading ? undefined : permittedShareTypes),
		[isLoading, permittedShareTypes],
	)

	return { ...permissions, error, isLoading, mutate }
}
