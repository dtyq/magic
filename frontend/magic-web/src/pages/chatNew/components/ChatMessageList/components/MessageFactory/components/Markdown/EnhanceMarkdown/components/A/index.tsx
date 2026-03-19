import { Suspense, type AnchorHTMLAttributes } from "react"
import { useMessageRenderContext } from "@/components/business/MessageRenderProvider/hooks"
import { useTranslation } from "react-i18next"
import MagicFunctionLink from "../MagicFunctionLink"
import ARenderFactory from "../../factories/ARenderFactory"
export function A(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
	const { children, href, ...restProps } = props
	const { hiddenDetail } = useMessageRenderContext()
	const { t } = useTranslation("interface")

	if (hiddenDetail) {
		return (
			<span role="link" aria-label={t("chat.messageTextRender.link")}>
				{t("chat.messageTextRender.link")}
			</span>
		)
	}

	const uncodeHref = decodeURIComponent(href as string)

	switch (true) {
		case uncodeHref.startsWith("magic://"):
			return <MagicFunctionLink href={uncodeHref}>{children}</MagicFunctionLink>
		default:
			const MatchComponent = ARenderFactory.getMatchComponent(props)

			if (MatchComponent) {
				return (
					<Suspense>
						<MatchComponent {...props}>{children}</MatchComponent>
					</Suspense>
				)
			}

			return (
				<a {...restProps} href={uncodeHref} target="_blank" rel="noreferrer">
					{children}
				</a>
			)
	}
}
