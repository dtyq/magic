import LockIcon from "@/opensource/assets/resources/lock-icon.svg"
import { PropsWithChildren, useEffect, useState } from "react"
import { useClusterConfig } from "@/opensource/models/config/hooks"
import { useTranslation } from "react-i18next"
import LanguageSelect from "@/opensource/layouts/SSOLayout/components/LanguageSelect"

interface ClusterLoginFailedProps {
	clusterCode: string
}

export default function ClusterLoginFailed(props: PropsWithChildren<ClusterLoginFailedProps>) {
	const { children, clusterCode } = props

	const { clustersConfig } = useClusterConfig()
	const { t } = useTranslation("interface")

	const [isLoading, setLoading] = useState(true)

	useEffect(() => {
		const timer = setTimeout(() => {
			setLoading(false)
		}, 500)
		return () => clearTimeout(timer)
	}, [])

	if (isLoading) {
		return <div data-testid="cluster-login-failed-loading" />
	}

	return (
		<div className="flex h-full w-full flex-col bg-background">
			<div className="mx-auto flex w-full max-w-[1200px] justify-end p-4">
				<LanguageSelect />
			</div>
			<div
				className="flex h-full w-full items-center justify-center"
				data-testid="cluster-login-failed-root"
			>
				<div className="my-[120px] inline-flex w-[360px] flex-col items-center gap-10 md:w-[500px]">
					<div className="w-[100px]">
						<img src={LockIcon} alt="" />
					</div>
					<div className="flex flex-col items-center gap-1">
						<span className="text-center text-lg font-semibold leading-6 text-foreground">
							{t("cluster.noAccessTitle")}
						</span>
						<span className="text-center text-sm leading-5 text-muted-foreground">
							{t("cluster.accessingClusterData", {
								clusterName: clustersConfig?.[clusterCode]?.name || "SaaS",
							})}
						</span>
					</div>
					<div
						className="flex h-[100px] w-[360px] shrink-0 flex-col items-center justify-center gap-2.5 rounded-[12px] border border-border bg-muted md:w-[500px]"
						data-testid="cluster-login-failed-section"
					>
						{children}
					</div>
				</div>
			</div>
		</div>
	)
}
