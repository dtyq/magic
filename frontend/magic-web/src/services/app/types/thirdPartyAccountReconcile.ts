import type { RequestConfig } from "@/infrastructure/network/http/clients"
import type { Login } from "@/types/login"

export interface ThirdPartyAccountIdentity {
	magicId: string
	name: string
	avatar?: string
	organizationName?: string
}

export interface ThirdPartyAccountOrganizationLookupContext {
	authorization: string
	deployCode: string
}

export type ResolveThirdPartyAccountOrganizationName = (
	context: ThirdPartyAccountOrganizationLookupContext,
	options?: Pick<RequestConfig, "skipAppInitWait">,
) => Promise<string | undefined>

export interface ThirdPartyAccountConflictContext {
	platform: Login.LoginType
	currentUser: ThirdPartyAccountIdentity
	candidateUser: ThirdPartyAccountIdentity
}

export type ThirdPartyAccountConflictDecision = "use-candidate" | "keep-current"

export type RequestThirdPartyAccountConflictDecision = (
	context: ThirdPartyAccountConflictContext,
) => Promise<ThirdPartyAccountConflictDecision>

export type ThirdPartyAccountReconcileResult =
	"same-user" | "kept-current" | "switched" | "skipped" | "unsupported" | "stale" | "failed"
