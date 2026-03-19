import { useMemo, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Switch } from "@/components/shadcn-ui/switch"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import { IconPickerPanel } from "../components/IconPickerPanel"
import { LocaleTextInput } from "../components/LocaleTextInput"
import { ColorPickerPopover } from "../components/ColorPickerPopover"
import type { LocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { useSceneEditStore } from "../store"

interface FormState {
	name: LocaleText
	description: LocaleText
	theme_color: string
	enabled: boolean
	icon: string
}

function isLocaleTextEqual(a: LocaleText, b: LocaleText): boolean {
	return JSON.stringify(a) === JSON.stringify(b)
}

export const BasicInfoPanel = observer(function BasicInfoPanel() {
	const { t } = useTranslation("crew/create")
	const store = useSceneEditStore()
	const { scene } = store

	const initialForm = useMemo<FormState>(
		() => ({
			name: scene.name,
			description: scene.description,
			theme_color: scene.theme_color || "#6366f1",
			enabled: scene.enabled,
			icon: scene.icon || "Circle",
		}),
		[scene],
	)

	const [form, setForm] = useState<FormState>(initialForm)

	const isDirty =
		!isLocaleTextEqual(form.name, initialForm.name) ||
		!isLocaleTextEqual(form.description, initialForm.description) ||
		form.theme_color !== initialForm.theme_color ||
		form.enabled !== initialForm.enabled ||
		form.icon !== initialForm.icon

	function handleReset() {
		setForm(initialForm)
	}

	async function handleSave() {
		store.updateBasicInfo({
			name: form.name,
			description: form.description,
			icon: form.icon,
			theme_color: form.theme_color,
			enabled: form.enabled,
		})
		await store.save()
	}

	return (
		<div className="flex h-full flex-col gap-3.5">
			{/* Content header */}
			<div className="flex shrink-0 items-center">
				<p className="flex-1 truncate text-lg font-medium text-foreground">
					{t("playbook.edit.basicInfo.title")}
				</p>
			</div>

			{/* Form card */}
			<div className="shrink-0 rounded-lg border border-border p-6">
				<div className="flex flex-col gap-4">
					{/* Icon row */}
					<div className="flex items-center gap-2">
						<div className="flex h-9 w-[40%] shrink-0 items-center">
							<span className="text-base font-medium text-foreground">
								{t("playbook.edit.basicInfo.icon")}
							</span>
						</div>
						<IconPickerPanel
							value={form.icon}
							onChange={(icon) => setForm((prev) => ({ ...prev, icon }))}
						>
							<span>
								<Button
									variant="outline"
									className="h-9 gap-2 px-4 shadow-xs"
									data-testid="basic-info-icon-picker"
								>
									<LucideLazyIcon icon={form.icon} size={24} />
									<ChevronDown className="h-4 w-4" />
								</Button>
							</span>
						</IconPickerPanel>
					</div>

					{/* Title row */}
					<div className="flex items-center gap-2">
						<div className="flex h-9 w-[40%] shrink-0 items-center">
							<span className="text-base font-medium text-foreground">
								{t("playbook.edit.basicInfo.name")}
							</span>
						</div>
						<LocaleTextInput
							value={form.name}
							onChange={(name) => setForm((prev) => ({ ...prev, name }))}
							localizeLabel={t("playbook.edit.basicInfo.name")}
							placeholder={t("playbook.edit.basicInfo.namePlaceholder")}
							data-testid="basic-info-name-input"
						/>
					</div>

					{/* Description row */}
					<div className="flex items-start gap-2">
						<div className="flex h-9 w-[40%] shrink-0 items-center">
							<span className="text-base font-medium text-foreground">
								{t("playbook.edit.basicInfo.description")}
							</span>
						</div>
						<LocaleTextInput
							value={form.description}
							onChange={(description) =>
								setForm((prev) => ({ ...prev, description }))
							}
							placeholder={t("playbook.edit.basicInfo.descriptionPlaceholder")}
							localizeLabel={t("playbook.edit.basicInfo.description")}
							multiline
							className="min-h-[120px]"
							data-testid="basic-info-description-textarea"
						/>
					</div>

					{/* Color row */}
					<div className="flex items-center gap-2">
						<div className="flex h-9 w-[40%] shrink-0 items-center">
							<span className="text-base font-medium text-foreground">
								{t("playbook.edit.basicInfo.color")}
							</span>
						</div>
						<ColorPickerPopover
							value={form.theme_color}
							onChange={(color) =>
								setForm((prev) => ({ ...prev, theme_color: color }))
							}
						>
							<span>
								<Button
									variant="outline"
									className="h-9 gap-2 px-4 shadow-xs"
									data-testid="basic-info-color-picker"
								>
									<div
										className="h-6 w-6 rounded-sm border border-border"
										style={{ backgroundColor: form.theme_color }}
									/>
									<ChevronDown className="h-4 w-4" />
								</Button>
							</span>
						</ColorPickerPopover>
					</div>

					{/* Enable row */}
					<div className="flex items-center gap-2">
						<div className="flex h-9 w-[40%] shrink-0 items-center">
							<span className="text-base font-medium text-foreground">
								{t("playbook.edit.basicInfo.enable")}
							</span>
						</div>
						<Switch
							checked={form.enabled}
							onCheckedChange={(checked) =>
								setForm((prev) => ({ ...prev, enabled: checked }))
							}
							data-testid="basic-info-enable-switch"
						/>
					</div>
				</div>
			</div>

			{/* Footer actions */}
			<div className="flex shrink-0 items-center justify-end gap-1.5">
				<Button
					variant="outline"
					className="h-9 shadow-xs"
					onClick={handleReset}
					data-testid="basic-info-reset-button"
				>
					{t("playbook.edit.basicInfo.reset")}
				</Button>
				<Button
					className="h-9 shadow-xs"
					onClick={handleSave}
					disabled={!isDirty}
					data-testid="basic-info-save-button"
				>
					{t("playbook.edit.basicInfo.save")}
				</Button>
			</div>
		</div>
	)
})
