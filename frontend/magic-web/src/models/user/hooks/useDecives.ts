import { useClientDataSWR } from "@/utils/swr"
import type { User } from "@/types/user"

import { UserApi } from "@/apis"
import { useMemo } from "react"
import { useOrganization } from "./useOrganization"

/**
 * @description 获取当前账号所登录的设备
 */
export const useUserDevices = () => {
	return useClientDataSWR<User.UserDeviceInfo[]>("/v4/users/login/devices", () =>
		UserApi.getUserDevices(),
	)
}

/**
 * @description 获取当前账号所处组织信息 Hook
 * @return {User.UserOrganization | undefined}
 */
export const useCurrentMagicOrganization = (): User.MagicOrganization | null => {
	const { organizationCode, magicOrganizationMap } = useOrganization()

	return useMemo(() => {
		return magicOrganizationMap[organizationCode]
	}, [organizationCode, magicOrganizationMap])
}
