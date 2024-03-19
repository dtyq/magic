import { UserService } from "@/opensource/services/user/UserService"
import { LoginService } from "@/opensource/services/user/LoginService/LoginService"
import { AccountService } from "@/opensource/services/user/AccountService"
import { ConfigService } from "@/opensource/services/config/ConfigService"
import * as globalApis from "@/opensource/apis"
import { type Container, ServiceContainer } from "@/opensource/services/ServiceContainer"
import { UserApi as openSourceUserApi, CommonApi as openSourceCommonApi } from "@/opensource/apis"

/**
 * @description 创建服务实例(在完全新的react根节点实例下，需要重新实例化业务层)
 */
function createService() {
	const UserApi = openSourceUserApi
	const CommonApi = openSourceCommonApi

	const apis = {
		...globalApis,
		UserApi,
		CommonApi,
	}

	const container = new ServiceContainer()

	// 将 API 初始化延迟到实际创建服务时进行
	container.registerFactory<UserService>(
		"userService",
		(c: Container) => new UserService(apis as any, c),
	)

	container.registerFactory<AccountService>(
		"accountService",
		(c: Container) => new AccountService(apis as any, c),
	)

	container.registerFactory<LoginService>(
		"loginService",
		(c: Container) => new LoginService(apis as any, c),
	)

	container.registerFactory<ConfigService>("configService", () => new ConfigService(apis as any))

	return { service: container }
}

export const { service } = createService()
