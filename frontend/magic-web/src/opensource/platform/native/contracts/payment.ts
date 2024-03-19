import type { NativeDestroyFn } from "./types"

export interface NativeStartInAppPurchaseParams {
	productId: string
	skuId: string
	productName: string
	skuProductName: string
	iapProductId: string
	seatCount: number
	forMoreSeats: boolean
	userId: string
	organizationCode: string
	token: string
	domain: string
}

export interface NativePurchaseStatusPayload {
	status: number
	product_id: string
	sku_id: string
	iap_transaction_id: string
	iap_product_id: string
	iap_account_token: string
	product_name: string
	sku_product_name: string
}

export interface PaymentPort {
	startInAppPurchase(params: NativeStartInAppPurchaseParams): Promise<unknown>
	observePurchaseStatusChanged(
		callback: (payload: NativePurchaseStatusPayload) => unknown,
		uniqueId?: string,
	): NativeDestroyFn | undefined
	restorePurchases(): Promise<unknown>
	popupHtmlView(params: { html: string }): Promise<unknown>
	closeHtmlView(): Promise<unknown>
}
