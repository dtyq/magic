import { genRequestUrl } from "@/utils/http"
import type {
	AuthRequestParams,
	ResourceTypes,
} from "@/opensource/pages/flow/components/AuthControlButton/types"
import type { User } from "@/types/user"
import { RequestUrl } from "../constant"
import { isCommercial } from "@/utils/env"
import type { HttpClient } from "../core/HttpClient"

export const generateAuthApi = (fetch: HttpClient) => ({
	/** 更新资源授权 */
	updateResourceAccess(params: AuthRequestParams) {
		return fetch.post<null>(genRequestUrl(RequestUrl.updateResourceAccess), params)
	},

	/** 查询资源授权 */
	getResourceAccess(resource_type: ResourceTypes, resource_id: string) {
		return fetch.get<AuthRequestParams>(
			genRequestUrl(
				RequestUrl.getResourceAccess,
				{},
				{
					resource_type,
					resource_id,
				},
			),
		)
	},

	/**
	 * @description 登录后需要将 授权码 + authorization 在 magic service 进行绑定
	 * @param {string} authorization 用户token
	 * @param {string} authCode 登录授权码（私有化部署就有用，非私有化传空字符串）
	 * @param {string} teamshareOrganizationCode 第一次创建组织时，返回的 Teamshare组织code，后端同步用户账号信息
	 */
	bindMagicAuthorization(
		authorization: string,
		authCode: string,
		teamshareOrganizationCode?: string,
	) {
		return fetch.get<Array<User.MagicOrganization>>(
			genRequestUrl(
				RequestUrl.bindMagicAuthorization,
				{},
				{
					login_code: authCode || "",
					authorization,
				},
			),
			{
				headers: {
					authorization,
					["Organization-Code"]: teamshareOrganizationCode || "",
				},
				showErrorMessage: false,
			},
		)
	},

	/**
	 * @description 获取当前账号所归属的环境 code
	 */
	getAccountDeployCode() {
		if (!isCommercial()) {
			return { login_code: "", teamshare_login_code: "" }
		}
		return fetch.get<{ login_code: string, teamshare_login_code?: string }>(genRequestUrl(RequestUrl.getDeploymentCode))
	},

	/**
	 * @description 用户 Token 换取一次性临时授权 Token
	 */
	getTempTokenFromUserToken() {
		return fetch.get<{ temp_token: string }>(genRequestUrl(RequestUrl.userTokenToTempToken))
	},

	/**
	 * @description 临时授权 Token 换取用户 Token
	 */
	getUserTokenFromTempToken(tempToken: string) {
		return fetch.get<{ teamshare_token: string }>(
			genRequestUrl(RequestUrl.tempTokenToUserToken, {
				tempToken,
			}),
		)
	},

	/**
	 * @description 获取管理后台用户信息
	 * @returns {Promise<User.UserInfo>}
	 */
	getAdminPermission() {
		return fetch.get<{ is_admin: boolean }>(genRequestUrl(RequestUrl.getAdminPermission))
	},
})
