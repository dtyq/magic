import type { InterceptorContext } from "@/infrastructure/network/http/clients/types"
import { BusinessResponseCode } from "@/infrastructure/network/http/clients/magicResponse"

/** No API platform permission */
export function generatePlatformUnauthorizedResInterceptor(showError: (message: string) => void) {
	return async function invalidPlatform({ request, response, http }: InterceptorContext) {
		const jsonResponse = response.data
		if (jsonResponse?.code !== BusinessResponseCode.PlatformUnauthorized) {
			return { http, request, response }
		}

		if (request?.enableErrorMessagePrompt && jsonResponse?.message) {
			showError(jsonResponse.message)
		}

		throw jsonResponse
	}
}
