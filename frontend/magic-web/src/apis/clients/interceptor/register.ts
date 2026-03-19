import type { Container } from "@/services/ServiceContainer"
import magicClient from "../magic"
import {
	generateInvalidOrgResInterceptor,
	generateUnauthorizedResInterceptor,
	generateSuccessResInterceptor,
	generatePlatformUnauthorizedResInterceptor,
} from "./interceptor"

export function initialApi(service: Container) {
	magicClient.addResponseInterceptor(generateUnauthorizedResInterceptor(service))
	magicClient.addResponseInterceptor(generateInvalidOrgResInterceptor(service))
	magicClient.addResponseInterceptor(generatePlatformUnauthorizedResInterceptor())
	magicClient.addResponseInterceptor(generateSuccessResInterceptor())
}
