/** Pick the order number shown to users for feedback prefill (platform id preferred). */
export function resolveSubscriptionBillOrderId(order: {
	id: string
	payment_platform_order_id?: string | null
}): string {
	const platformOrderId = order.payment_platform_order_id?.trim()
	if (platformOrderId) return platformOrderId

	return order.id
}
