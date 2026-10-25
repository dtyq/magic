import { SuperMagicApi } from "@/apis"
import type { RequestConfig } from "@/infrastructure/network/http/clients"
import { interfaceStore } from "@/stores/interface"
import type { User } from "@/types/user"
import { appStore } from "@/stores/app"
import {
	readProjectInitializationIdentity,
	isProjectInitializationIdentityCurrent,
} from "./projectStateInitialization"

const ORGANIZATION_SWITCH_SUPPRESSION_KEY = "super-magic:project-organization-access-suppression"
const ORGANIZATION_SWITCH_SUPPRESSION_DURATION = 30_000
const pendingAccessRequests = new Map<
	string,
	ReturnType<typeof SuperMagicApi.getProjectAccessibility>
>()

interface OrganizationSwitchSuppression {
	pathname: string
	expiresAt: number
}

interface ResolveRequiredProjectOrganizationCodeParams {
	projectId?: string
	currentOrganizationCode?: string | null
	requestOptions?: Omit<RequestConfig, "url">
}

export interface ProjectOrganizationTarget {
	account: User.UserAccount
	organization: User.MagicOrganization
}

/** Resolves the project organization from the active account to prevent an accidental account switch. */
export function findProjectOrganizationTarget(
	accounts: User.UserAccount[],
	organizationCode: string | null,
	currentMagicId: string | null,
): ProjectOrganizationTarget | null {
	if (!organizationCode || !currentMagicId) return null

	const currentAccount = accounts.find((account) => account.magic_id === currentMagicId)
	const organization = currentAccount?.organizations?.find(
		(item) => item.magic_organization_code === organizationCode,
	)

	return organization && currentAccount ? { account: currentAccount, organization } : null
}

/**
 * Keeps the accessibility guard out of a normal organization-switch transition. The short-lived,
 * path-scoped marker survives the account-context reload without affecting later project visits.
 */
export function suppressProjectOrganizationAccessCheckForCurrentRoute() {
	try {
		const suppression: OrganizationSwitchSuppression = {
			pathname: window.location.pathname,
			expiresAt: Date.now() + ORGANIZATION_SWITCH_SUPPRESSION_DURATION,
		}
		sessionStorage.setItem(ORGANIZATION_SWITCH_SUPPRESSION_KEY, JSON.stringify(suppression))
	} catch {
		// Storage may be unavailable in restricted browser contexts; the normal check remains safe.
	}
}

function isProjectOrganizationAccessCheckSuppressed() {
	try {
		const storedValue = sessionStorage.getItem(ORGANIZATION_SWITCH_SUPPRESSION_KEY)
		if (!storedValue) return false

		const suppression = JSON.parse(storedValue) as OrganizationSwitchSuppression
		const matchesCurrentRoute =
			suppression.pathname === window.location.pathname && suppression.expiresAt > Date.now()
		const navigationEntry = performance.getEntriesByType?.("navigation")[0] as
			PerformanceNavigationTiming | undefined
		const isOrganizationSwitchTransition = interfaceStore.isSwitchingOrganization
		const isOrganizationSwitchReload = navigationEntry?.type === "reload"
		const shouldSuppress =
			matchesCurrentRoute && (isOrganizationSwitchTransition || isOrganizationSwitchReload)

		if (!shouldSuppress) sessionStorage.removeItem(ORGANIZATION_SWITCH_SUPPRESSION_KEY)
		return shouldSuppress
	} catch {
		return false
	}
}

/**
 * Resolves the organization that must be active before normal project state initialization runs.
 * Failures return null to preserve the existing permission and missing-project behavior.
 */
export async function resolveRequiredProjectOrganizationCode({
	projectId,
	currentOrganizationCode,
	requestOptions,
}: ResolveRequiredProjectOrganizationCodeParams): Promise<string | null> {
	if (!projectId || isProjectOrganizationAccessCheckSuppressed()) return null

	try {
		const identity = readProjectInitializationIdentity()
		// 只合并原有两个入口的等价读取。独立信号、自定义请求头等选项仍保持独立。
		const canShare = Object.keys(requestOptions ?? {}).every(
			(key) => key === "skipAppInitWait" || key === "enableErrorMessagePrompt",
		)
		const appReady = !appStore.isInitialing && Boolean(appStore.appInitPromise)
		const requestKey = JSON.stringify([
			identity.sessionEpoch,
			projectId,
			currentOrganizationCode,
			!appReady && Boolean(requestOptions?.skipAppInitWait),
			requestOptions?.enableErrorMessagePrompt ?? true,
		])
		let request = canShare ? pendingAccessRequests.get(requestKey) : undefined
		if (!request) {
			request = SuperMagicApi.getProjectAccessibility(projectId, requestOptions)
			if (canShare) {
				const pending = request.finally(() => {
					if (pendingAccessRequests.get(requestKey) === pending)
						pendingAccessRequests.delete(requestKey)
				})
				pendingAccessRequests.set(requestKey, pending)
				request = pending
			}
		}
		const accessibility = await request
		if (!isProjectInitializationIdentityCurrent(identity)) return null
		const requiredOrganizationCode =
			accessibility?.required_magic_organization_code?.trim() || null

		if (!requiredOrganizationCode || requiredOrganizationCode === currentOrganizationCode) {
			return null
		}

		return requiredOrganizationCode
	} catch {
		return null
	}
}
