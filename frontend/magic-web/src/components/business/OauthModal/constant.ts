export const enum OauthScope {
	OPENID = "openid",
	PROFILE = "profile",
	PHONE = "phone",
	EMAIL = "email",
	ADDRESS = "address",
}

// export const ScopeLabel = {
// 	[OauthScope.OPENID]: i18next.t("oauth.openid", { ns: "interface" }),
// 	[OauthScope.PROFILE]: i18next.t("oauth.profile", { ns: "interface" }),
// 	[OauthScope.PHONE]: i18next.t("oauth.phone", { ns: "interface" }),
// 	[OauthScope.EMAIL]: i18next.t("oauth.email", { ns: "interface" }),
// 	[OauthScope.ADDRESS]: i18next.t("oauth.address", { ns: "interface" }),
// }

export const ScopeLabel = {
	[OauthScope.OPENID]: "获取您的账号",
	[OauthScope.PROFILE]: "获取您的基础信息（姓名/手机号码/部门等基础信息）",
	[OauthScope.PHONE]: "获取您的手机号码",
	[OauthScope.EMAIL]: "获取您的邮箱信息",
	[OauthScope.ADDRESS]: "获取您的地址信息",
}
