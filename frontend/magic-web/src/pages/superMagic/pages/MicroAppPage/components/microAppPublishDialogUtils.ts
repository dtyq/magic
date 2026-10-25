import type {
	MicroAppPublishShareRange,
	MicroAppPublishShareType,
	MicroAppPublishTarget,
	PublishedMicroAppProjectItem,
	PublishMicroAppProjectBody,
} from "@/apis/modules/superMagic"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import { generateSharePassword } from "@/pages/superMagic/components/Share/utils"
import {
	DEFAULT_NEW_ORGANIZATION_SHARE_RANGE,
	isOrganizationDesignatedShareIncomplete,
} from "@/pages/superMagic/components/Share/utils/organizationShareGuards"

export interface MicroAppPublishFormState {
	appName: string
	shareType: MicroAppPublishShareType
	shareRange: MicroAppPublishShareRange
	targets: MicroAppPublishTarget[]
	password: string
	coverFileKey?: string | null
	coverUrl: string
	fullScreen: boolean
	shareExpiry: number | null
	defaultOpenFileId: string | null
}

export type MicroAppPublishValidationError =
	| "projectNameRequired"
	| "projectNameTooLong"
	| "passwordInvalid"
	| "organizationDesignatedMembersRequired"

export function normalizeMicroAppPublishShareType(
	shareType: MicroAppPublishShareType,
	isPersonalOrganization = false,
): MicroAppPublishShareType {
	return isPersonalOrganization && shareType === ShareType.Organization
		? ShareType.Public
		: shareType
}

/**
 * Share type used when nothing has been published yet. Team sharing is unavailable to a personal
 * organization and to a free-plan organization alike, so both fall back to public access.
 *
 * This only decides the *initial* value: an already published micro app keeps its own share type
 * (see `createFormStateFromPublishedItem`) so loading the dialog never rewrites a live share.
 */
export function resolveDefaultMicroAppPublishShareType(
	isPersonalOrganization = false,
	isFreePlan = false,
): MicroAppPublishShareType {
	return isPersonalOrganization || isFreePlan ? ShareType.Public : ShareType.Organization
}

export function createDefaultMicroAppPublishFormState(
	appName = "",
	isPersonalOrganization = false,
	isFreePlan = false,
): MicroAppPublishFormState {
	return {
		appName,
		shareType: resolveDefaultMicroAppPublishShareType(isPersonalOrganization, isFreePlan),
		shareRange: DEFAULT_NEW_ORGANIZATION_SHARE_RANGE,
		targets: [],
		password: generateSharePassword(),
		coverFileKey: undefined,
		coverUrl: "",
		fullScreen: false,
		shareExpiry: null,
		defaultOpenFileId: null,
	}
}

export function buildMicroAppPublishPayload(
	formState: MicroAppPublishFormState,
	isPersonalOrganization = false,
): PublishMicroAppProjectBody {
	const shareType = normalizeMicroAppPublishShareType(formState.shareType, isPersonalOrganization)
	const payload: PublishMicroAppProjectBody = {
		app_name: formState.appName.trim(),
		share_type: shareType,
	}

	if (formState.coverFileKey !== undefined) {
		payload.cover_file_key = formState.coverFileKey
	}
	payload.extra = { pure_mode: formState.fullScreen }
	if (formState.shareExpiry !== null) {
		payload.expire_days = formState.shareExpiry
	}
	if (formState.defaultOpenFileId !== null) {
		payload.default_open_file_id = formState.defaultOpenFileId
	}

	if (shareType === ShareType.Organization) {
		payload.share_range = formState.shareRange
		if (formState.shareRange === "designated") {
			payload.target_ids = formState.targets.map((target) => ({
				target_type: target.target_type,
				target_id: target.target_id,
			}))
		}
	}

	if (shareType === ShareType.PasswordProtected) {
		payload.password = formState.password.trim()
	}

	return payload
}

export function getMicroAppPublishValidationError(
	formState: MicroAppPublishFormState,
): MicroAppPublishValidationError | null {
	const appName = formState.appName.trim()
	if (!appName) return "projectNameRequired"
	if (appName.length > 100) return "projectNameTooLong"

	if (formState.shareType === ShareType.PasswordProtected) {
		const passwordLength = formState.password.trim().length
		if (passwordLength < 4 || passwordLength > 32) return "passwordInvalid"
	}

	if (
		isOrganizationDesignatedShareIncomplete(
			formState.shareType,
			formState.shareRange,
			formState.targets.length,
		)
	) {
		return "organizationDesignatedMembersRequired"
	}

	return null
}

export function getPublishedItemFromResponse(
	response: PublishedMicroAppProjectItem | { data?: PublishedMicroAppProjectItem },
): PublishedMicroAppProjectItem {
	if ("data" in response && response.data) return response.data
	return response as PublishedMicroAppProjectItem
}

export function createFormStateFromPublishedItem(
	item: PublishedMicroAppProjectItem | null,
	appName?: string,
	isPersonalOrganization = false,
	isFreePlan = false,
): MicroAppPublishFormState {
	return {
		appName: item?.app_name || appName || "",
		shareType: normalizeMicroAppPublishShareType(
			item?.share_type ||
				resolveDefaultMicroAppPublishShareType(isPersonalOrganization, isFreePlan),
			isPersonalOrganization,
		),
		shareRange: item?.share_range ?? (item ? "all" : DEFAULT_NEW_ORGANIZATION_SHARE_RANGE),
		targets: item?.target_ids || [],
		// 只有后端明确标记为已发布时才保留空密码，未发布的密码分享需要可直接编辑的初始密码。
		password:
			item?.password || (item?.publish_status === "published" ? "" : generateSharePassword()),
		coverFileKey: item?.cover_file_key ?? undefined,
		coverUrl: item?.cover_url || "",
		fullScreen: item?.extra?.pure_mode === true,
		shareExpiry: item?.expire_days ?? null,
		defaultOpenFileId: item?.default_open_file_id ?? null,
	}
}

function normalizePublishTargets(targets: MicroAppPublishTarget[]): string[] {
	return targets
		.map((target) => `${target.target_type}:${target.target_id}`)
		.sort((left, right) => left.localeCompare(right))
}

export function hasMicroAppPublishFormChanged(
	formState: MicroAppPublishFormState,
	publishedFormState: MicroAppPublishFormState | null,
): boolean {
	if (!publishedFormState) return false
	if (formState.appName.trim() !== publishedFormState.appName.trim()) return true
	if (formState.shareType !== publishedFormState.shareType) return true
	if ((formState.coverFileKey ?? null) !== (publishedFormState.coverFileKey ?? null)) return true
	if (formState.coverUrl.trim() !== publishedFormState.coverUrl.trim()) return true
	if (formState.fullScreen !== publishedFormState.fullScreen) return true
	if ((formState.shareExpiry ?? null) !== (publishedFormState.shareExpiry ?? null)) return true
	if ((formState.defaultOpenFileId ?? null) !== (publishedFormState.defaultOpenFileId ?? null))
		return true

	if (formState.shareType === ShareType.Organization) {
		if (formState.shareRange !== publishedFormState.shareRange) return true
		if (formState.shareRange === "designated") {
			const currentTargets = normalizePublishTargets(formState.targets)
			const publishedTargets = normalizePublishTargets(publishedFormState.targets)
			if (currentTargets.join("|") !== publishedTargets.join("|")) return true
		}
	}

	if (formState.shareType === ShareType.PasswordProtected) {
		return formState.password.trim() !== publishedFormState.password.trim()
	}

	return false
}

export function formatMicroAppPublishedAt(value?: string): string {
	if (!value) return ""
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return date.toLocaleString()
}

export function buildMicroAppAccessUrl(item: PublishedMicroAppProjectItem | null): string {
	if (!item) return ""
	if (item.access_url) return item.access_url
	if (item.app_id) return `${window.location.origin}/micro-app/${item.app_id}`
	return ""
}

export function buildMicroAppCopyUrl(accessUrl: string, password?: string): string {
	const normalizedPassword = password?.trim()
	if (!normalizedPassword) return accessUrl

	const url = new URL(accessUrl, window.location.origin)
	url.searchParams.set("password", normalizedPassword)
	return url.toString()
}

export function buildMicroAppShareText({
	accessUrl,
	shareTitle,
	accessHint,
	passwordText,
}: {
	accessUrl: string
	shareTitle: string
	accessHint: string
	passwordText?: string
}): string {
	const lines = [shareTitle, "", accessHint, accessUrl]
	if (passwordText) lines.push("", passwordText)
	return lines.join("\n")
}
