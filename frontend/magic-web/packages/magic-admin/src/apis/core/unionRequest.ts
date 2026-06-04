/**
 * @description Request to remove duplicates
 */
import { nanoid } from "nanoid"
import type { HttpClient, RequestConfig } from "./HttpClient"

// Generate a unique identifier key for the request
const generateRequestKey = (config: RequestConfig) => {
	const {
		baseURL,
		unwrapData,
		enableErrorMessagePrompt,
		enableAuthorizationVerification,
		enableRequestUnion,
		method = "get",
		url,
		body,
	} = config
	try {
		return JSON.stringify({
			method: method.toLowerCase(),
			url,
			baseURL,
			unwrapData,
			enableErrorMessagePrompt,
			enableAuthorizationVerification,
			enableRequestUnion,
			body,
		})
	} catch (error) {
		console.error("Generate a unique identifier key for the request", error)
		return nanoid(32)
	}
}

export default function generatorUnionRequest() {
	const pendingRequests = new Map()

	return (client: HttpClient) => {
		// Packaging the original request method and adding deduplication function
		const originalRequest = client.request.bind(client)

		client.request = ({ enableRequestUnion, ...config }) => {
			// Check if deduplication is enabled
			if (config && !enableRequestUnion) {
				return originalRequest(config)
			}

			// Generate request unique identifier
			const requestKey = generateRequestKey(config)

			// If there are identical pending requests, return the existing Promise
			if (pendingRequests.has(requestKey)) {
				return pendingRequests.get(requestKey)
			}

			// Create a new request Promise
			const requestPromise = originalRequest(config).then(
				(response) => {
					// Request successful, remove from cache
					pendingRequests.delete(requestKey)
					return response
				},
				(error) => {
					// Request failed, remove from cache
					pendingRequests.delete(requestKey)
					throw error
				},
			)

			// Store Promise in cache
			pendingRequests.set(requestKey, requestPromise)

			return requestPromise
		}

		return client
	}
}
