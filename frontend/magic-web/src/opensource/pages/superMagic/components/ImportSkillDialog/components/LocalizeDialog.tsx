import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import { SupportLocales } from "@/opensource/constants/locale"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/opensource/components/shadcn-ui/dialog"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { Textarea } from "@/opensource/components/shadcn-ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/opensource/components/shadcn-ui/tabs"
import { Label } from "@/opensource/components/shadcn-ui/label"
import type { LocalizeField, SkillIdentityData } from "../types"

interface LocalizeDialogProps {
	open: boolean
	defaultTab: LocalizeField
	identity: SkillIdentityData
	onConfirm: (updated: SkillIdentityData) => void
	onCancel: () => void
}

function LocalizeDialog({ open, defaultTab, identity, onConfirm, onCancel }: LocalizeDialogProps) {
	const { t } = useTranslation("crew/market")

	// Local state for edits, initialized from identity
	const [name, setName] = useState(() => ({ ...identity.name }))
	const [description, setDescription] = useState(() => ({
		...identity.description,
	}))

	function handleConfirm() {
		onConfirm({ ...identity, name, description })
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
			<DialogContent
				className="w-[448px] max-w-[448px] p-0"
				data-testid="localize-identity-dialog"
			>
				<DialogHeader className="border-b border-border px-3 py-3">
					<DialogTitle className="text-base font-semibold">
						{t("localizeIdentity.title")}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-2.5 p-4">
					<Tabs defaultValue={defaultTab} className="w-full">
						<TabsList className="w-full" data-testid="localize-tabs">
							<TabsTrigger
								value="name"
								className="flex-1"
								data-testid="localize-tab-name"
							>
								{t("localizeIdentity.tabs.name")}
							</TabsTrigger>
							<TabsTrigger
								value="description"
								className="flex-1"
								data-testid="localize-tab-description"
							>
								{t("localizeIdentity.tabs.description")}
							</TabsTrigger>
						</TabsList>

						{/* Name tab */}
						<TabsContent value="name" className="flex flex-col gap-2 pt-2">
							<LocaleInputField
								label={t("localizeIdentity.originalDefault")}
								value={name[SupportLocales.fallback]}
								onChange={(v) =>
									setName((prev) => ({ ...prev, [SupportLocales.fallback]: v }))
								}
								data-testid="localize-name-original"
							/>
							<LocaleInputField
								label={t("localizeIdentity.english")}
								value={name[SupportLocales.enUS] ?? ""}
								placeholder={`${t("localizeIdentity.usingDefault")}: ${name[SupportLocales.fallback]}`}
								onChange={(v) =>
									setName((prev) => ({ ...prev, [SupportLocales.enUS]: v }))
								}
								data-testid="localize-name-en"
							/>
							<LocaleInputField
								label={t("localizeIdentity.simplifiedChinese")}
								value={name[SupportLocales.zhCN] ?? ""}
								placeholder={`${t("localizeIdentity.usingDefault")}: ${name[SupportLocales.fallback]}`}
								onChange={(v) =>
									setName((prev) => ({ ...prev, [SupportLocales.zhCN]: v }))
								}
								data-testid="localize-name-zh"
							/>
						</TabsContent>

						{/* Description tab */}
						<TabsContent value="description" className="flex flex-col gap-2 pt-2">
							<LocaleTextareaField
								label={t("localizeIdentity.originalDefault")}
								value={description[SupportLocales.fallback]}
								onChange={(v) =>
									setDescription((prev) => ({
										...prev,
										[SupportLocales.fallback]: v,
									}))
								}
								data-testid="localize-desc-original"
							/>
							<LocaleTextareaField
								label={t("localizeIdentity.english")}
								value={description[SupportLocales.enUS] ?? ""}
								placeholder={`${t("localizeIdentity.usingDefault")}: ${description[SupportLocales.fallback]}`}
								onChange={(v) =>
									setDescription((prev) => ({
										...prev,
										[SupportLocales.enUS]: v,
									}))
								}
								data-testid="localize-desc-en"
							/>
							<LocaleTextareaField
								label={t("localizeIdentity.simplifiedChinese")}
								value={description[SupportLocales.zhCN] ?? ""}
								placeholder={`${t("localizeIdentity.usingDefault")}: ${description[SupportLocales.fallback]}`}
								onChange={(v) =>
									setDescription((prev) => ({
										...prev,
										[SupportLocales.zhCN]: v,
									}))
								}
								data-testid="localize-desc-zh"
							/>
						</TabsContent>
					</Tabs>

					<p className="text-sm text-muted-foreground">
						{t("localizeIdentity.fallbackHint")}
					</p>
				</div>

				<DialogFooter className="border-t border-border px-3 py-3">
					<Button
						variant="outline"
						size="sm"
						onClick={onCancel}
						data-testid="localize-cancel-button"
					>
						{t("localizeIdentity.cancel")}
					</Button>
					<Button size="sm" onClick={handleConfirm} data-testid="localize-confirm-button">
						{t("localizeIdentity.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

interface LocaleInputFieldProps {
	label: string
	value: string
	readOnly?: boolean
	placeholder?: string
	onChange?: (value: string) => void
	"data-testid"?: string
}

function LocaleInputField({
	label,
	value,
	readOnly,
	placeholder,
	onChange,
	"data-testid": testId,
}: LocaleInputFieldProps) {
	return (
		<div className="flex flex-col gap-2">
			<Label className="text-sm font-medium leading-none">{label}</Label>
			<Input
				value={value}
				readOnly={readOnly}
				placeholder={placeholder}
				onChange={(e) => onChange?.(e.target.value)}
				className={readOnly ? "cursor-default bg-muted/50" : undefined}
				data-testid={testId}
			/>
		</div>
	)
}

interface LocaleTextareaFieldProps {
	label: string
	value: string
	readOnly?: boolean
	placeholder?: string
	onChange?: (value: string) => void
	"data-testid"?: string
}

function LocaleTextareaField({
	label,
	value,
	readOnly,
	placeholder,
	onChange,
	"data-testid": testId,
}: LocaleTextareaFieldProps) {
	return (
		<div className="flex flex-col gap-2">
			<Label className="text-sm font-medium leading-none">{label}</Label>
			<Textarea
				value={value}
				readOnly={readOnly}
				placeholder={placeholder}
				onChange={(e) => onChange?.(e.target.value)}
				className={readOnly ? "cursor-default resize-none bg-muted/50" : "resize-none"}
				rows={4}
				data-testid={testId}
			/>
		</div>
	)
}

export default memo(LocalizeDialog)
