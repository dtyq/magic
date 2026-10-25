import { useTranslation } from "react-i18next"
import type { DesignStyle } from "./catalog"
import { getStyleVisuals } from "./designStyleVisuals"
import { readableText } from "./sceneTheme"
import DesignStyleSectionHeader from "./DesignStyleSectionHeader"

export default function DesignStyleComponentStates({ style }: { style: DesignStyle }) {
	const { t } = useTranslation("super")
	const visuals = getStyleVisuals(style)
	const textStyle = { fontFamily: visuals.fontFamily }

	return (
		<section
			className="space-y-2.5"
			data-testid="design-style-component-states"
			style={textStyle}
		>
			<DesignStyleSectionHeader
				title={t("htmlEditor.designStyle.componentStates")}
				description={t("htmlEditor.designStyle.componentStatesDescription")}
				testId="design-style-component-states-header"
			/>
			<div className="grid gap-2.5 lg:grid-cols-3">
				<div className="border-t border-border/60 py-4">
					<div className="mb-2.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
						{t("htmlEditor.designStyle.buttons")}
					</div>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className="rounded-lg px-3 py-2 text-xs font-medium text-white"
							style={{
								backgroundColor: visuals.primary,
								color: readableText(visuals.primary),
								borderRadius: visuals.controlRadius,
							}}
						>
							{t("htmlEditor.designStyle.defaultState")}
						</button>
						<button
							type="button"
							disabled
							className="rounded-lg px-3 py-2 text-xs font-medium opacity-50"
							style={{
								backgroundColor: visuals.primary,
								color: readableText(visuals.primary),
								borderRadius: visuals.controlRadius,
							}}
						>
							{t("htmlEditor.designStyle.disabledState")}
						</button>
						<button
							type="button"
							className="rounded-lg border px-3 py-2 text-xs font-medium"
							style={{
								borderColor: visuals.primary,
								color: visuals.primary,
								borderRadius: visuals.controlRadius,
							}}
						>
							{t("htmlEditor.designStyle.outlineState")}
						</button>
					</div>
				</div>
				<div className="border-t border-border/60 py-4">
					<div className="mb-2.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
						{t("htmlEditor.designStyle.formStates")}
					</div>
					<div className="space-y-2">
						<div
							className="h-8 rounded-lg border px-2 text-xs leading-8 text-muted-foreground"
							style={{
								borderColor: visuals.border,
								backgroundColor: visuals.canvas,
								borderRadius: visuals.controlRadius,
							}}
						>
							{t("htmlEditor.designStyle.inputState")}
						</div>
						<div
							className="h-8 rounded-lg border px-2 text-xs leading-8"
							style={{
								borderColor: visuals.primary,
								outline: `2px solid ${visuals.primary}`,
								outlineOffset: 1,
								borderRadius: visuals.controlRadius,
							}}
						>
							{t("htmlEditor.designStyle.focusState")}
						</div>
						<div
							className="h-8 rounded-lg border px-2 text-xs leading-8"
							style={{
								borderColor: visuals.danger,
								color: visuals.danger,
								borderRadius: visuals.controlRadius,
							}}
						>
							{t("htmlEditor.designStyle.errorState")}
						</div>
					</div>
				</div>
				<div className="border-t border-border/60 py-4">
					<div className="mb-2.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
						{t("htmlEditor.designStyle.statusStates")}
					</div>
					<div className="flex flex-wrap gap-2">
						{[
							[t("htmlEditor.designStyle.successState"), visuals.success],
							[t("htmlEditor.designStyle.warningState"), visuals.warning],
							[t("htmlEditor.designStyle.dangerState"), visuals.danger],
						].map(([label, color]) => (
							<span
								key={label}
								className="rounded-full border px-2.5 py-1 text-xs font-medium"
								style={{ borderColor: color, color }}
							>
								{label}
							</span>
						))}
					</div>
				</div>
			</div>
		</section>
	)
}
