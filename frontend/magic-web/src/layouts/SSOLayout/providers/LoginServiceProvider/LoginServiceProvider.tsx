import type { PropsWithChildren } from "react"
import { createContext, useMemo } from "react"
import { LoginDeployment } from "@/pages/login/constants"
import type { ServiceContainer } from "@/services/ServiceContainer"
import { useLoginClusterSession } from "./useLoginClusterSession"

interface LoginServiceStore extends LoginServiceProviderProps {
	deployment: LoginDeployment
	clusterCode: string
	/** 展示公网登录 / Show public deployment login */
	showPublicDeployment: () => void
	/** 展示私有化登录 / Show private deployment login */
	showPrivateDeployment: () => void
	/** 设置私有码 / Set cached and login-scoped private cluster code */
	setPrivateClusterCode: (clusterCode: string) => void
}

interface LoginServiceProviderProps {
	service: ServiceContainer
}

function noop() {
	return undefined
}

export const LoginServiceContext = createContext<LoginServiceStore>({
	deployment: LoginDeployment.PublicDeploymentLogin,
	clusterCode: "",
	showPublicDeployment: noop,
	showPrivateDeployment: noop,
	setPrivateClusterCode: noop,
	service: {} as ServiceContainer,
})

/**
 * @description 登录下根据多环境需要切换对应的服务请求
 */
export const LoginServiceProvider = (props: PropsWithChildren<LoginServiceProviderProps>) => {
	const { service } = props
	const {
		clusterCode,
		deployment,
		showPrivateDeployment,
		showPublicDeployment,
		setPrivateClusterCode,
	} = useLoginClusterSession({ service })

	const store = useMemo(() => {
		return {
			service,
			deployment,
			clusterCode,
			showPrivateDeployment,
			showPublicDeployment,
			setPrivateClusterCode,
		}
	}, [
		clusterCode,
		deployment,
		service,
		setPrivateClusterCode,
		showPrivateDeployment,
		showPublicDeployment,
	])

	return (
		<LoginServiceContext.Provider value={store}>{props?.children}</LoginServiceContext.Provider>
	)
}
