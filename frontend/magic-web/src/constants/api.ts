export const enum BUSINESS_API_ERROR_CODE {
	/** User has not created an account */
	USER_NOT_CREATE_ACCOUNT = 3102,
	/** token expired */
	USER_TOKEN_EXPIRED = 3103,
	/** Account has been disabled by the platform (hard login block) */
	ACCOUNT_DISABLED = 3109,
	/** Invitation code has been used */
	INVITE_CODE_USED = 2152,
	/** Verification code is incorrect */
	VERIFICATION_CODE_ERROR = 2168,
	/** Account has been activated */
	ACCOUNT_ACTIVATED = 2201,
	/** Account has no permission(No token carried) */
	ACCOUNT_NO_PERMISSION = 2179,
	/** User does not exist */
	USER_NOT_EXIST = 2155,
}
