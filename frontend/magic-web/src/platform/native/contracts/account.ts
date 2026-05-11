export interface NativeSyncAccountInfoParams {
	domain: string
	keewoodDomain: string
	token: string
	userId: string
	organizationCode: string
}

export interface AccountPort {
	syncAccountInfo(params: NativeSyncAccountInfoParams): Promise<unknown>
}
