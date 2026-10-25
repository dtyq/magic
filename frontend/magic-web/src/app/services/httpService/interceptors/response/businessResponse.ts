import type { InterceptorContext } from "@/infrastructure/network/http/clients/types"
import { BusinessResponseCode } from "@/infrastructure/network/http/clients/magicResponse"

/** Successful response */
export function generateSuccessResInterceptor(showError: (message: string) => void) {
	return async function success({ request, response, http }: InterceptorContext) {
		const jsonResponse = response.data
		if (jsonResponse?.code !== BusinessResponseCode.Success) {
			if (request?.enableErrorMessagePrompt && jsonResponse?.message) {
				showError(jsonResponse.message)
			}
			throw jsonResponse
		}

		return { http, request, response }
	}
}
