import type { Admin } from "@/opensource/types/admin"

export function isUnlimitedSubscription(subscriptionInfo: Admin.SubscriptionInfo | null): boolean {
	return true
}
