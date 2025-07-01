import type { Container } from "@/opensource/services/ServiceContainer"
import magicClient from "../magic"
import {
	generateInvalidOrgResInterceptor,
	generateUnauthorizedResInterceptor,
	generateSuccessResInterceptor,
} from "./interceptor"

export function initialApi(service: Container) {
	magicClient.addResponseInterceptor(generateUnauthorizedResInterceptor(service))
	magicClient.addResponseInterceptor(generateInvalidOrgResInterceptor(service))
	magicClient.addResponseInterceptor(generateSuccessResInterceptor())
}

export {
	generateInvalidOrgResInterceptor,
	generateUnauthorizedResInterceptor,
	generateSuccessResInterceptor,
}
