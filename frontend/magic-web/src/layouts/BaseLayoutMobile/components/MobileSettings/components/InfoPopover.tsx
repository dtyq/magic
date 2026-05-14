import { createPortal } from "react-dom"
import { ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { InfoPopoverState } from "../types"

/** 右上角信息浮层复用原型布局，只承载静态说明入口与版本信息。 */
export function MobileSettingsInfoPopover(props: {
	state: InfoPopoverState
	onClose: () => void
	onSelect: (key: string) => void
}) {
	const { state, onClose, onSelect } = props
	const { t } = useTranslation("interface")

	const items = [
		{ key: "userAgreement", label: t("setting.info.userAgreement") },
		{ key: "privacyPolicy", label: t("setting.info.privacyPolicy") },
		{ key: "termsOfService", label: t("setting.info.termsOfService") },
		{ key: "aboutMagic", label: t("setting.info.aboutMagic") },
	]

	return createPortal(
		<>
			<div className="fixed inset-0 z-[200]" onClick={onClose} aria-hidden />
			<div
				className="fixed z-[201] min-w-52 overflow-hidden rounded-xl border border-border bg-background shadow-2xl shadow-black/20"
				style={{
					top: state.top,
					right: state.right,
				}}
			>
				{items.map((item, index) => (
					<div key={item.key}>
						<button
							type="button"
							onClick={() => {
								onSelect(item.key)
								onClose()
							}}
							className="flex h-12 w-full items-center gap-3 px-4 transition-opacity active:opacity-60"
						>
							<span className="flex-1 text-left text-base leading-5 text-foreground">
								{item.label}
							</span>
							<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
						</button>
						{index < items.length - 1 ? (
							<div className="h-px w-full bg-border" />
						) : null}
					</div>
				))}
				<div className="h-px w-full bg-border" />
				<div className="flex h-10 items-center justify-center px-4">
					<span className="text-xs leading-4 text-muted-foreground">
						{t("setting.info.version", {
							version: window.CONFIG?.MAGIC_APP_VERSION || "--",
						})}
					</span>
				</div>
			</div>
		</>,
		document.body,
	)
}
