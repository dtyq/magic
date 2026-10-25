import { UserService } from "@/services/user/UserService"
import { LoginService } from "@/services/user/LoginService"
import { AccountService } from "@/services/user/AccountService"
import { ConfigService } from "@/services/config/ConfigService"
import { ServiceContainer } from "@/services/ServiceContainer"
import { UserApi, CommonApi, AuthApi, ContactApi } from "@/apis"

/** OSS has one deployment: a popup owns services, while APIs retain their existing clients. */
export function createService() {
	const apis = { UserApi, CommonApi, AuthApi, ContactApi }
	const container = new ServiceContainer()
	container.registerFactory("userService", (c) => new UserService(apis, c))
	container.registerFactory("accountService", (c) => new AccountService(apis, c))
	container.registerFactory("loginService", (c) => new LoginService(apis, c))
	container.registerFactory("configService", () => new ConfigService(apis))
	return {
		service: container,
		dispose() {
			container.reset()
		},
	}
}
