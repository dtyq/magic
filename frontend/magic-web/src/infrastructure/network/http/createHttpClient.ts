import { HttpClient } from "./HttpClient"
import type { HttpClientParams } from "./types"

export function createHttpClient(options: HttpClientParams) {
	return new HttpClient(options)
}
