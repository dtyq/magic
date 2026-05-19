import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

export interface InstagramShellContentGateProps {
	loading: boolean
	error: string | null
	hasPost: boolean
	children: ReactNode
}

/** Loading / error / empty states for Instagram shell view areas. */
export function InstagramShellContentGate(props: InstagramShellContentGateProps) {
	const { loading, error, hasPost, children } = props
	const { t } = useTranslation("super")

	if (loading) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="instagram-content-loading"
			>
				{t("detail.selfMedia.common.loading")}
			</div>
		)
	}
	if (error) {
		return (
			<div
				className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive"
				data-testid="instagram-content-error"
			>
				{error}
			</div>
		)
	}
	if (!hasPost) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="instagram-content-empty"
			>
				{t("detail.selfMedia.common.noPosts")}
			</div>
		)
	}
	return <>{children}</>
}
