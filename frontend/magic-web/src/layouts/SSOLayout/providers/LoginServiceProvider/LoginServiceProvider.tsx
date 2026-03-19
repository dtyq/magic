import type { PropsWithChildren } from "react"
import { createContext, useMemo } from "react"
import type { ConfigService } from "@/services/config/ConfigService"
import { LoginDeployment } from "@/pages/login/constants"
import { useClusterCode } from "@/providers/ClusterProvider"
import { useImmer } from "use-immer"
import { useDeepCompareEffect, useMemoizedFn, useMount } from "ahooks"
import { configStore } from "@/models/config"
import type { ServiceContainer } from "@/services/ServiceContainer"

interface LoginServiceStore extends LoginServiceProviderProps {
	deployment: LoginDeployment
	setDeployment: (deployment: LoginDeployment) => void
	clusterCode: string
	setDeployCode: (clusterCode: string) => void
}

interface LoginServiceProviderProps {
	service: ServiceContainer
}

export const LoginServiceContext = createContext<LoginServiceStore>({
	deployment: LoginDeployment.PublicDeploymentLogin,
	setDeployment: () => { },
	clusterCode: "",
	setDeployCode: () => { },
	service: {} as ServiceContainer,
})

/**
 * @description 登录下根据多环境需要切换对应的服务请求
 */
export const LoginServiceProvider = (props: PropsWithChildren<LoginServiceProviderProps>) => {
	const { service } = props
	const { clusterCode, setClusterCode } = useClusterCode()

	// 私有化部署环境名称
	const [deployment, setDeployment] = useImmer(LoginDeployment.PublicDeploymentLogin)

	const setDeployCode = useMemoizedFn((code: string) => {
		setClusterCode(code)
		if (code) {
			service.get<ConfigService>("configService")?.setClusterCodeCache(code)
		}
	})

	useMount(() => {
		if (configStore.cluster.clusterCode) {
			setDeployment(LoginDeployment.PrivateDeploymentLogin)
		}
	})

	useDeepCompareEffect(() => {
		if (deployment === LoginDeployment.PublicDeploymentLogin) {
			setClusterCode("")
		} else {
			setClusterCode(configStore.cluster.clusterCodeCache ?? "")
		}
	}, [deployment, setClusterCode])

	const store = useMemo(() => {
		return {
			service,
			deployment,
			setDeployment,
			clusterCode,
			setDeployCode,
		}
	}, [clusterCode, deployment, setDeployCode, setDeployment, service])

	return (
		<LoginServiceContext.Provider value={store}>{props?.children}</LoginServiceContext.Provider>
	)
}
