import type { Admin } from "@/types/admin"

export function isUnlimitedSubscription(subscriptionInfo: Admin.SubscriptionInfo | null): boolean {
	return true
}
