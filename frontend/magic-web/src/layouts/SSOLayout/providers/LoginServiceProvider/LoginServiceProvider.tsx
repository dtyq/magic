import type { PropsWithChildren } from "react"
import { createContext, useMemo } from "react"
import { LoginDeployment } from "@/pages/login/constants"
import type { ServiceContainer } from "@/services/ServiceContainer"
import { useLoginClusterSession } from "./useLoginClusterSession"

export interface LoginServiceStore extends LoginServiceProviderProps {
	deployment: LoginDeployment
	clusterCode: string
	/**
	 * The Widget-provided code used only as the initial private-login form value.
	 * It must not be treated as the active cluster until the user confirms it.
	 */
	prefilledDeploymentCode: string
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
	prefilledDeploymentCode: "",
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
		prefilledDeploymentCode,
		showPrivateDeployment,
		showPublicDeployment,
		setPrivateClusterCode,
	} = useLoginClusterSession({ service })

	const store = useMemo(() => {
		return {
			service,
			deployment,
			clusterCode,
			prefilledDeploymentCode,
			showPrivateDeployment,
			showPublicDeployment,
			setPrivateClusterCode,
		}
	}, [
		clusterCode,
		deployment,
		prefilledDeploymentCode,
		service,
		setPrivateClusterCode,
		showPrivateDeployment,
		showPublicDeployment,
	])

	return (
		<LoginServiceContext.Provider value={store}>{props?.children}</LoginServiceContext.Provider>
	)
}
