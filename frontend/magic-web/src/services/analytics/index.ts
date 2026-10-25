/**
 * Open-source analytics boundary.
 *
 * Shared business code only knows this generic reporting contract. The enterprise
 * overlay mirrors this module and owns all commercial event names, payload schemas,
 * transformations, and delivery. The baseline build intentionally remains inert.
 */
import { AnalyticsService } from "./contract"

class NoopAnalyticsService extends AnalyticsService<Record<string, unknown>> {
	report(eventType: string, payload?: unknown): void {
		void eventType
		void payload
	}
}

export const analyticsService = new NoopAnalyticsService()

export function setupAnalytics(): () => void {
	return () => undefined
}

export function refreshAnalyticsSubscription(): void {
	// The enterprise overlay refreshes the active organization's Group profile.
}
