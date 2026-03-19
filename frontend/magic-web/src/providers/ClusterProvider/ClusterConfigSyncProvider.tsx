import type { PropsWithChildren } from "react"
import { useState } from "react"
import { userStore } from "@/models/user"
import { service } from "@/services"
import type { LoginService } from "@/services/user/LoginService"
import { useMount, useDebounceFn } from "ahooks"
import { createStyles } from "antd-style"
import MagicSpin from "@/components/base/MagicSpin"
import { useClusterCode } from "@/providers/ClusterProvider"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		spin: css`
			.${prefixCls}-spin-blur {
				opacity: 1;
			}

			& > div > .${prefixCls}-spin {
				--${prefixCls}-spin-content-height: unset;
				max-height: unset;
			}
		`,
	}
})

/**
 * @description 集群配置同步
 * @constructor
 */
export function ClusterConfigSyncProvider(props: PropsWithChildren) {
	const { children } = props

	const { styles } = useStyles()

	const [loading, setLoading] = useState(true)

	const { t } = useTranslation("interface")
	const { setClusterCode } = useClusterCode()

	/**
	 * @description 同步环境配置
	 * @param {string|null} authorization 用户token
	 */
	const { run: onUserLoginChange } = useDebounceFn(
		async (access_token: string | null) => {
			try {
				if (access_token) {
					const { clusterCode } = await service
						.get<LoginService>("loginService")
						.syncClusterConfig()
					setClusterCode(clusterCode)
				}
			} catch (error) {
				console.error(error)
			} finally {
				setLoading(false)
				// 这里的重定向要移除
			}
		},
		{ wait: 3000, leading: true, trailing: false },
	)

	// 登录成功时同步所有状态（用户信息、组织信息、环境配置、授权码等）
	useMount(() => {
		const { authorization } = userStore.user
		if (authorization) {
			onUserLoginChange(authorization)?.catch(console.error)
		} else {
			setLoading(false)
		}
	})

	return loading ? (
		<MagicSpin spinning wrapperClassName={styles.spin} tip={t("spin.loadingCluster")}>
			<div style={{ height: "100vh" }} />
		</MagicSpin>
	) : (
		children
	)
}
