import type { InterceptorContext } from "@/infrastructure/network/http/clients/types"
import { BusinessResponseCode } from "@/infrastructure/network/http/clients/magicResponse"

/** Invalid organization */
export function generateInvalidOrgResInterceptor(
	onInvalidOrganization: () => void | Promise<void>,
) {
	return async function invalidOrg({ request, response, http }: InterceptorContext) {
		const jsonResponse = response.data
		if (jsonResponse?.code === BusinessResponseCode.InvalidOrganization) {
			await onInvalidOrganization()
		}
		return { http, request, response }
	}
}
