import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

export interface RednoteShellContentGateProps {
	loading: boolean
	error: string | null
	hasPost: boolean
	children: ReactNode
}

/** Shared loading / error / empty states for Red shell view areas. */
export function RednoteShellContentGate(props: RednoteShellContentGateProps) {
	const { loading, error, hasPost, children } = props
	const { t } = useTranslation("super")

	if (loading) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="red-content-loading"
			>
				{t("detail.selfMedia.common.loading")}
			</div>
		)
	}
	if (error) {
		const errorMap: Record<string, string> = {
			magicProjectNotFound: t("detail.selfMedia.errors.magicProjectNotFound"),
			selfMediaConfigMissing: t("detail.selfMedia.errors.selfMediaConfigMissing"),
			postManifestMissing: t("detail.selfMedia.errors.postManifestMissing"),
			postManifestInvalid: t("detail.selfMedia.errors.postManifestInvalid"),
			unknownError: t("detail.selfMedia.common.unknownError"),
		}
		return (
			<div
				className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive"
				data-testid="red-content-error"
			>
				{errorMap[error] || error}
			</div>
		)
	}
	if (!hasPost) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="red-content-empty"
			>
				{t("detail.selfMedia.common.noPosts")}
			</div>
		)
	}
	return <>{children}</>
}
