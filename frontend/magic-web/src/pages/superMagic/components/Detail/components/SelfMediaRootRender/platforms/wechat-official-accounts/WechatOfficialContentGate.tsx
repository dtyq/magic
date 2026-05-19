import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

export interface WechatOfficialContentGateProps {
	loading: boolean
	error: string | null
	hasPost: boolean
	children: ReactNode
}

/** Shared loading / error / empty gate for the WeChat shell view area. */
export function WechatOfficialContentGate(props: WechatOfficialContentGateProps) {
	const { loading, error, hasPost, children } = props
	const { t } = useTranslation("super")

	if (loading) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="wechat-content-loading"
			>
				{t("detail.selfMedia.common.loading")}
			</div>
		)
	}
	if (error) {
		return (
			<div
				className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive"
				data-testid="wechat-content-error"
			>
				{error}
			</div>
		)
	}
	if (!hasPost) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="wechat-content-empty"
			>
				{t("detail.selfMedia.common.noPosts")}
			</div>
		)
	}
	return <>{children}</>
}
