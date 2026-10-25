import { ShareType } from "../types"

/**
 * Paid-plan (VIP) gate for sharing methods.
 *
 * This is a completely different gate from the administrator's function permissions: a plan gate can
 * be lifted by upgrading, a permission gate cannot. Both act on the same rows, so the two reasons a
 * row is unusable must never be conflated in the UI (see `ShareTypeField`).
 *
 * It lives in the front end only — the backend `assertAllowed()` checks the function code but never
 * `is_paid_plan`, so the front end is the only thing stopping a free organization from submitting
 * these methods today.
 */

/** `true` only for a plan that is known to be free; an unknown plan must not be treated as free. */
export function isFreePlanFromSubscription(
	subscriptionInfo: { is_paid_plan?: boolean } | undefined | null,
): boolean {
	return subscriptionInfo?.is_paid_plan === false
}

/**
 * Password-protected sharing is reserved for paid organizations. The row stays in the list but is
 * disabled, so it must never be selected or submitted.
 */
export function isShareTypePlanDisabled(type: ShareType, isFreePlan: boolean): boolean {
	return isFreePlan && type === ShareType.PasswordProtected
}

/** Team sharing is not offered to free organizations at all — the row is removed, not disabled. */
export function isShareTypePlanHidden(type: ShareType, isFreePlan: boolean): boolean {
	return isFreePlan && type === ShareType.Organization
}

/** A free organization may create neither a hidden method nor a plan-disabled one. */
export function canCreateShareType(type: ShareType, isFreePlan: boolean): boolean {
	return !isShareTypePlanHidden(type, isFreePlan) && !isShareTypePlanDisabled(type, isFreePlan)
}

/**
 * First method that both the administrator and the plan allow, in the order the caller passes them
 * (`permittedShareTypes` is ordered by `SHARE_TYPE_ORDER`). Returns `undefined` when the intersection
 * is empty: the caller must then keep the current method instead of inventing one.
 */
export function pickDefaultShareType(
	types: readonly ShareType[],
	isFreePlan: boolean,
): ShareType | undefined {
	return types.find((type) => canCreateShareType(type, isFreePlan))
}
