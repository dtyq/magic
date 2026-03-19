/**
 * @description 暂时用来做所有服务层的初始化出口，后续在架构更新中需要迁移出口
 */
import { initializeApp } from "./initializeApp"

// 导出单例
export const {
	service,
	// userService,
	// accountService,
	// loginService,
	// configService,
	// flowService,
	// organizationService,
} = initializeApp()
