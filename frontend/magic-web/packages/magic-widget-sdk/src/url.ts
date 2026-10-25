import type { MagicWidget } from "./types"
import { normalizeWidgetConfig, serializeWidgetConfig } from "./config"
import {
	WIDGET_PROTOCOL_VERSION,
	WIDGET_QUERY_EMBED,
	WIDGET_QUERY_DEPLOYMENT_CODE,
	WIDGET_QUERY_CONFIG,
	WIDGET_QUERY_HOST_ORIGIN,
	WIDGET_QUERY_INSTANCE_ID,
	WIDGET_QUERY_PROTOCOL_VERSION,
	WIDGET_QUERY_RENDER_MODE,
} from "./protocol"

export const LOGIN_STRATEGY_QUERY_KEY = "login-strategy"
export const ORGANIZATION_CODE_QUERY_KEY = "organizationCode"
export const PRIVATE_DEPLOYMENT_LOGIN_STRATEGY = "private_deployment"
const DEFAULT_CLUSTER_CODE = "global"

export interface BuildWidgetIframeUrlContext {
	fallbackAppOrigin?: string | null
	instanceId?: string
	hostOrigin?: string
	renderMode?: "inline" | "floating"
}

function normalizeScriptOrigin(scriptOrigin: string | null | undefined) {
	if (!scriptOrigin) {
		throw new Error("Magic widget script origin is required")
	}

	const url = new URL(scriptOrigin)
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new Error("Magic widget script origin must use http or https")
	}

	return url.origin
}

function requireMountOptions(
	options: MagicWidget.MountOptions | null | undefined,
): asserts options is MagicWidget.MountOptions {
	if (!options || typeof options !== "object") {
		throw new Error("Magic widget mount options are required")
	}
}

function assertNoLegacyTopLevelOrganizationCode(options: MagicWidget.MountOptions) {
	if (Object.prototype.hasOwnProperty.call(options, "organizationCode")) {
		throw new Error(
			"Magic widget organizationCode must be configured through auth.organizationCode",
		)
	}
}

/** Rejects the removed private-code field so Widget hosts do not silently target SaaS. */
function assertNoLegacyPrivateDeploymentCode(options: MagicWidget.MountOptions) {
	if (Object.prototype.hasOwnProperty.call(options.auth ?? {}, "privateDeploymentCode")) {
		throw new Error(
			"Magic widget auth.privateDeploymentCode has been removed; use auth.deploymentCode with loginStrategy: private_deployment",
		)
	}
}

function encodePathSegment(value: unknown, label: string) {
	if (typeof value !== "string") {
		throw new Error(`Magic widget ${label} must be a string`)
	}

	const trimmedValue = value.trim()

	if (!trimmedValue) {
		throw new Error(`Magic widget ${label} is required`)
	}

	return encodeURIComponent(trimmedValue)
}

function normalizeOptionalString(value: unknown, label: string) {
	if (value === null || value === undefined) return null
	if (typeof value !== "string") {
		throw new Error(`Magic widget ${label} must be a string`)
	}

	const trimmedValue = value.trim()
	return trimmedValue || null
}

/** Identifies the Widget login strategy that opens the private deployment code form. */
function isPrivateDeploymentLoginStrategy(loginStrategy: unknown) {
	return loginStrategy === PRIVATE_DEPLOYMENT_LOGIN_STRATEGY
}

/** Resolves a supported widget page inside the requested SaaS or private deployment. */
function resolvePagePath(
	page: MagicWidget.PageOptions | null | undefined,
	deploymentCode: string | null,
) {
	if (!page || typeof page !== "object") {
		throw new Error("Magic widget page is required")
	}

	const pageType = (page as { type?: unknown }).type
	if (pageType === "crew") {
		const crewPage = page as MagicWidget.CrewPageOptions
		const targetDeploymentCode = deploymentCode ?? DEFAULT_CLUSTER_CODE
		return `/${encodePathSegment(targetDeploymentCode, "auth.deploymentCode")}/super/crew/${encodePathSegment(crewPage.crewId, "crewId")}`
	}

	throw new Error(`Magic widget page type is not supported: ${String(pageType ?? "")}`)
}

export function validateWidgetMountOptions(options: MagicWidget.MountOptions | null | undefined) {
	requireMountOptions(options)
	assertNoLegacyTopLevelOrganizationCode(options)
	assertNoLegacyPrivateDeploymentCode(options)
	const deploymentCode = normalizeOptionalString(
		options.auth?.deploymentCode,
		"auth.deploymentCode",
	)
	resolvePagePath(options.page, deploymentCode)
	normalizeOptionalString(options.auth?.organizationCode, "auth.organizationCode")
	normalizeWidgetConfig(options.config)
}

function appendQueryValue(url: URL, key: string, value: MagicWidget.QueryValue) {
	if (Array.isArray(value)) {
		value.forEach((item) => appendQueryValue(url, key, item))
		return
	}

	if (value === null || value === undefined) return

	url.searchParams.append(key, String(value))
}

export function buildWidgetIframeUrl(
	options: MagicWidget.MountOptions,
	context: BuildWidgetIframeUrlContext = {},
) {
	requireMountOptions(options)
	assertNoLegacyTopLevelOrganizationCode(options)
	assertNoLegacyPrivateDeploymentCode(options)
	const origin = normalizeScriptOrigin(context.fallbackAppOrigin)
	const deploymentCode = normalizeOptionalString(
		options.auth?.deploymentCode,
		"auth.deploymentCode",
	)
	const isPrivateDeploymentLogin = isPrivateDeploymentLoginStrategy(options.auth?.loginStrategy)
	const pagePath = resolvePagePath(options.page, deploymentCode)
	const organizationCode = normalizeOptionalString(
		options.auth?.organizationCode,
		"auth.organizationCode",
	)
	const url = new URL(pagePath, origin)

	Object.entries(options.iframe?.query ?? {}).forEach(([key, value]) => {
		appendQueryValue(url, key, value)
	})

	if (organizationCode) {
		url.searchParams.set(ORGANIZATION_CODE_QUERY_KEY, organizationCode)
	}

	if (options.auth?.loginStrategy) {
		url.searchParams.set(LOGIN_STRATEGY_QUERY_KEY, options.auth.loginStrategy)
	}

	if (isPrivateDeploymentLogin && deploymentCode) {
		// Forward the code so a redirected login page can prefill the private deployment form.
		url.searchParams.set(WIDGET_QUERY_DEPLOYMENT_CODE, deploymentCode)
	}

	if (context.instanceId) {
		url.searchParams.set(WIDGET_QUERY_EMBED, "1")
		url.searchParams.set(WIDGET_QUERY_INSTANCE_ID, context.instanceId)
		url.searchParams.set(WIDGET_QUERY_PROTOCOL_VERSION, String(WIDGET_PROTOCOL_VERSION))
		if (context.hostOrigin) url.searchParams.set(WIDGET_QUERY_HOST_ORIGIN, context.hostOrigin)
		if (context.renderMode) url.searchParams.set(WIDGET_QUERY_RENDER_MODE, context.renderMode)
		url.searchParams.set(WIDGET_QUERY_CONFIG, serializeWidgetConfig(options.config ?? {}))
	}

	return url
}
