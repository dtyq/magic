import { useRuntime } from "@magic-admin-v2/runtime/context"
import { hasRights, type RightsScope } from "@magic-admin-v2/permissions/rights"

export type UseRightsOptions = {
	scope?: RightsScope
}

/**
 * Legacy-admin-compatible permission hook.
 * An array of keys is treated as an OR expression.
 */
export function useRights(
	keys: string | readonly string[],
	options: UseRightsOptions = {},
) {
	const { access } = useRuntime()

	if (!access) return false

	return hasRights(access, keys, options.scope)
}

export default useRights
