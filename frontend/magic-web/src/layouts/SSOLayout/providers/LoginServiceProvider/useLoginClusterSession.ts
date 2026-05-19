import { useDeepCompareEffect, useMemoizedFn, useMount } from "ahooks"
import { useImmer } from "use-immer"
import type { ConfigService } from "@/services/config/ConfigService"
import { LoginDeployment } from "@/pages/login/constants"
import { useClusterCode } from "@/providers/ClusterProvider"
import { configStore } from "@/models/config"
import type { ServiceContainer } from "@/services/ServiceContainer"

interface UseLoginClusterSessionParams {
	service: ServiceContainer
}

export function useLoginClusterSession(params: UseLoginClusterSessionParams) {
	const { service } = params
	// 登录页当前会话使用的局部 cluster / Login-scoped cluster for the current login session.
	const { clusterCode, setClusterCode } = useClusterCode()
	// 控制当前展示公网还是私有化登录 UI / Controls whether the current UI shows public or private login.
	const [deployment, setDeployment] = useImmer(LoginDeployment.PublicDeploymentLogin)

	const setPrivateClusterCode = useMemoizedFn((code: string) => {
		// 立即更新登录页局部 cluster，并持久化缓存私有码，
		// 方便后续恢复同一私有化登录入口 /
		// Update the login-scoped cluster immediately, then persist the cached
		// private cluster so the login page can restore the same private option later.
		setClusterCode(code)
		if (code) {
			service.get<ConfigService>("configService")?.setClusterCodeCache(code)
		}
	})

	useMount(() => {
		// `clusterCodeCache` 表示记住的私有化登录偏好。
		// 它决定登录页初始展示，但不代表请求已经切到该私有化环境 /
		// `clusterCodeCache` is the remembered private login preference.
		// It decides the initial login UI, but it does not mean requests are already
		// using that private environment.
		if (configStore.cluster.clusterCodeCache) {
			setDeployment(LoginDeployment.PrivateDeploymentLogin)
		}
	})

	useDeepCompareEffect(() => {
		if (deployment === LoginDeployment.PublicDeploymentLogin) {
			// 切回公网登录时清空登录页局部 cluster，但保留缓存私有码，
			// 以便未来恢复私有化 UI /
			// Public login clears the login-scoped cluster while preserving the cached
			// private code for future UI restoration.
			setClusterCode("")
			return
		}

		// 切回私有化登录时，把缓存私有码恢复到当前登录页局部 cluster /
		// Private login restores the remembered private code into the login-scoped
		// cluster for the current page session.
		setClusterCode(configStore.cluster.clusterCodeCache ?? "")
	}, [deployment, setClusterCode])

	const showPublicDeployment = useMemoizedFn(() => {
		setDeployment(LoginDeployment.PublicDeploymentLogin)
	})

	const showPrivateDeployment = useMemoizedFn(() => {
		setDeployment(LoginDeployment.PrivateDeploymentLogin)
	})

	return {
		clusterCode,
		deployment,
		showPrivateDeployment,
		showPublicDeployment,
		setPrivateClusterCode,
	}
}
