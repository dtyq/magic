import { type Container, ServiceContainer } from "@/services/ServiceContainer"
import { UserService } from "@/services/user/UserService"
import { AccountService } from "@/services/user/AccountService"
import * as apis from "@/apis"
import { LoginService } from "@/services/user/LoginService/LoginService"
import { OrganizationService } from "@/services/user/OrganizationService"
import { ConfigService } from "@/services/config/ConfigService"
import { initialApi } from "@/apis/clients/interceptor"
import { FlowService } from "./flow"

export function initializeApp() {
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

	container.registerFactory<FlowService>("flowService", () => new FlowService(apis as any))

	container.registerFactory<OrganizationService>(
		"organizationService",
		(c: Container) => new OrganizationService(apis as any, c),
	)

	// 获取服务实例 - 容器内部会处理异步工厂的情况
	// const userService = container.get<UserService>("userService")
	// const accountService = container.get<AccountService>("accountService")
	// const loginService = container.get<LoginService>("loginService")
	// const configService = container.get<ConfigService>("configService")
	// const flowService = container.get<FlowService>("flowService")
	// const organizationService = container.get<OrganizationService>("organizationService")

	initialApi(container)

	// 返回可供应用使用的服务实例
	return {
		service: container,
		// userService,
		// loginService,
		// configService,
		// flowService,
		// accountService,
		// organizationService,
	}
}
