import LockIcon from "@/assets/resources/lock-icon.svg"
import { PropsWithChildren, useEffect, useState } from "react"
import { useClusterConfig } from "@/models/config/hooks"
import { useTranslation } from "react-i18next"
import LanguageSelect from "@/layouts/SSOLayout/components/LanguageSelect"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

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
		<div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
			<div className="mx-auto flex w-full max-w-[1200px] shrink-0 justify-end p-4">
				<LanguageSelect />
			</div>
			{/* Keep actions reachable on short screens while centering short content. */}
			<ScrollArea
				className="min-h-0 w-full flex-1"
				viewportClassName="[&>div]:!flex [&>div]:min-h-full [&>div]:items-center [&>div]:justify-center [&>div]:px-4 [&>div]:py-8 md:[&>div]:py-16"
				data-testid="cluster-login-failed-root"
			>
				<div className="flex w-full max-w-[500px] flex-col items-center gap-10">
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
						className="flex min-h-[100px] w-full shrink-0 flex-col items-center justify-center gap-2.5 rounded-[12px] border border-border bg-muted p-4"
						data-testid="cluster-login-failed-section"
					>
						{children}
					</div>
				</div>
			</ScrollArea>
		</div>
	)
}
