import { useAdmin } from "@/provider/AdminProvider"
import { generateAIManageApi } from "./modules/aiManage"
import { generateSecurityApi } from "./modules/security"
import { generatePlatformPackageApi } from "./modules/platformPackage"
import { generatePlatformInfoApi } from "./modules/platformInfo"
import { generateFileApi } from "./modules/file"
import { generateAppMenuApi } from "./modules/appMenu"

export function useApis() {
	const { apiClients } = useAdmin()
	if (!apiClients) {
		throw new Error("apiClients is not defined")
	}
	const { magicClient } = apiClients

	return {
		/** AI管理 - API */
		AIManageApi: generateAIManageApi(magicClient),
		/** 安全控制 - API */
		SecurityApi: generateSecurityApi(magicClient),
		/** 平台套餐 - API */
		PlatformPackageApi: generatePlatformPackageApi(magicClient),
		/** 平台信息 - API */
		PlatformInfoApi: generatePlatformInfoApi(magicClient),

		/** 文件 - API */
		FileApi: generateFileApi(magicClient),
		/** 应用菜单 - API */
		AppMenuApi: generateAppMenuApi(magicClient),
	}
}
