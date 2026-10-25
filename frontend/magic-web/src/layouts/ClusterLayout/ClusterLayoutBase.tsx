import { Outlet, useParams } from "react-router"
import { useMemoizedFn } from "ahooks"
import { useClusterCode } from "@/providers/ClusterProvider"
import ClusterLoginFailed from "./ClusterLoginFailed"
import { defaultClusterCode } from "@/routes/helpers"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { useClusterSwitch } from "./hooks/useClusterSwitch"
import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"
import type { ClusterLoginAdapter } from "@/layouts/ClusterLayout/cluster-login"
import { useSearchParams } from "react-router-dom"

interface ClusterLayoutBaseProps {
	loginAdapter: ClusterLoginAdapter
}

function ClusterLayoutBaseComponent(props: ClusterLayoutBaseProps) {
	const { loginAdapter } = props
	const { clusterCode } = useParams()
	const [searchParams] = useSearchParams()
	// Explicit query overrides include "global" (the empty SaaS cluster).
	const requestedCluster = searchParams.get("thirdPartyAuthDeployCode") ?? clusterCode ?? ""
	const targetClusterCode = requestedCluster === defaultClusterCode ? "" : requestedCluster

	const { setClusterCode } = useClusterCode()
	const { t } = useTranslation("interface")

	const { isSameCluster, loading, setSameCluster } = useClusterSwitch({
		targetClusterCode,
	})

	const onClick = useMemoizedFn(() => {
		loginAdapter.open({
			clusterCode: targetClusterCode,
			onClusterChange(code) {
				setClusterCode(code)
				setSameCluster(true)
			},
		})
	})

	if (loading) {
		return (
			<div
				className="flex h-screen w-full flex-col items-center justify-center gap-3"
				data-testid="cluster-layout-loading"
			>
				<Spinner className="animate-spin text-muted-foreground" />
				<span className="text-sm text-muted-foreground">{t("spin.loadingLogin")}</span>
			</div>
		)
	}

	if (isSameCluster) {
		return <Outlet />
	}

	return (
		<ClusterLoginFailed clusterCode={targetClusterCode}>
			<>
				<span className="text-sm leading-5 text-foreground/80">
					{t("cluster.notLoggedIn")}
				</span>
				<Button onClick={onClick} data-testid="cluster-layout-login-button">
					{t("cluster.loginButton")}
				</Button>
			</>
		</ClusterLoginFailed>
	)
}

export const ClusterLayoutBase = observer(ClusterLayoutBaseComponent)
