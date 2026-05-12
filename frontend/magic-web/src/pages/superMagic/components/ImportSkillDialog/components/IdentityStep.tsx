import { memo, useCallback, useMemo, useRef } from "react"
import { ChevronDown, ChevronRight, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SupportLocales } from "@/constants/locale"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { Label } from "@/components/shadcn-ui/label"
import { Separator } from "@/components/shadcn-ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/shadcn-ui/collapsible"
import type { SkillIdentityData } from "../types"

const LOCALES = [SupportLocales.enUS, SupportLocales.zhCN] as const

interface IdentityStepProps {
	identity: SkillIdentityData
	onChange: React.Dispatch<React.SetStateAction<SkillIdentityData>>
	namePlaceholder?: string
	descriptionPlaceholder?: string
	sourcePlaceholder?: string
	nameError?: string
	isDefaultNameRequired?: boolean
	onDefaultNameChange?: () => void
}

function IdentityStep({
	identity,
	onChange,
	namePlaceholder,
	descriptionPlaceholder,
	sourcePlaceholder,
	nameError,
	isDefaultNameRequired = false,
	onDefaultNameChange,
}: IdentityStepProps) {
	const { t } = useTranslation("crew/market")
	const { i18n } = useTranslation()
	const iconInputRef = useRef<HTMLInputElement>(null)

	const hasLocaleValues = useMemo(
		() =>
			[SupportLocales.enUS, SupportLocales.zhCN].some(
				(locale) =>
					identity.name[locale] ||
					identity.description[locale] ||
					identity.source[locale],
			),
		[identity],
	)

	const localeLabels = useMemo<Record<string, string>>(
		() => ({
			[SupportLocales.enUS]: t("localizeIdentity.english"),
			[SupportLocales.zhCN]: t("localizeIdentity.simplifiedChinese"),
		}),
		[t],
	)

	const sortedLocales = useMemo(() => {
		const current = i18n.language
		if ((LOCALES as readonly string[]).includes(current)) {
			return [current as (typeof LOCALES)[number], ...LOCALES.filter((l) => l !== current)]
		}
		return [...LOCALES]
	}, [i18n.language])

	const handleIconUpload = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0]
			if (!file) return
			const url = URL.createObjectURL(file)
			onChange((prev) => ({ ...prev, iconUrl: url, iconFile: file }))
			e.target.value = ""
		},
		[onChange],
	)

	return (
		<div className="flex w-full flex-col gap-4">
			<input
				ref={iconInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={handleIconUpload}
				data-testid="skill-icon-input"
			/>

			{/* Icon row */}
			<div className="flex items-start gap-2">
				<div className="flex h-9 flex-1 items-center">
					<Label className="w-[172px] shrink-0 text-base font-medium">
						{t("importSkill.identity.icon")}
					</Label>
				</div>
				<div className="mr-12 flex flex-col items-center gap-2">
					<div
						className="flex size-[128px] items-center justify-center overflow-clip rounded-sm border border-border"
						data-testid="skill-icon-preview"
					>
						{identity.iconUrl ? (
							<img
								src={identity.iconUrl}
								alt="Skill icon"
								className="size-full object-cover"
							/>
						) : (
							<div className="flex size-full items-center justify-center bg-muted">
								<Upload className="size-8 text-muted-foreground" />
							</div>
						)}
					</div>
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5"
						onClick={() => iconInputRef.current?.click()}
						data-testid="skill-icon-upload-button"
					>
						<Upload className="size-4" />
						{t("importSkill.identity.upload")}
					</Button>
				</div>
			</div>

			{/* Skill Name row */}
			<div className="flex items-start gap-2">
				<div className="flex h-9 flex-1 items-center">
					<Label className="w-[172px] shrink-0 text-base font-medium">
						{t("importSkill.identity.skillName")}
						{isDefaultNameRequired ? (
							<span className="ml-0.5 text-destructive" aria-hidden="true">
								*
							</span>
						) : null}
					</Label>
				</div>
				<div className="flex w-[320px] shrink-0 flex-col gap-2">
					<Input
						value={identity.name[SupportLocales.fallback]}
						onChange={(e) => {
							onDefaultNameChange?.()
							onChange((prev) => ({
								...prev,
								name: {
									...prev.name,
									[SupportLocales.fallback]: e.target.value,
								},
							}))
						}}
						placeholder={namePlaceholder}
						aria-invalid={Boolean(nameError)}
						data-testid="skill-name-input"
					/>
					{nameError ? (
						<p className="text-sm text-destructive" data-testid="skill-name-error">
							{nameError}
						</p>
					) : null}
				</div>
			</div>

			{/* Description row */}
			<div className="flex items-start gap-2">
				<div className="flex h-9 flex-1 items-center">
					<Label className="w-[172px] shrink-0 text-base font-medium">
						{t("importSkill.identity.description")}
					</Label>
				</div>
				<div className="flex w-[320px] shrink-0 flex-col gap-2">
					<Textarea
						value={identity.description[SupportLocales.fallback]}
						onChange={(e) =>
							onChange((prev) => ({
								...prev,
								description: {
									...prev.description,
									[SupportLocales.fallback]: e.target.value,
								},
							}))
						}
						placeholder={descriptionPlaceholder}
						className="min-h-[126px] resize-none"
						data-testid="skill-description-textarea"
					/>
				</div>
			</div>

			{/* Source row */}
			<div className="flex items-start gap-2">
				<div className="flex h-9 flex-1 items-center">
					<Label className="w-[172px] shrink-0 text-base font-medium">
						{t("importSkill.identity.source")}
					</Label>
				</div>
				<div className="flex w-[320px] shrink-0 flex-col gap-2">
					<Input
						value={identity.source[SupportLocales.fallback]}
						onChange={(e) =>
							onChange((prev) => ({
								...prev,
								source: {
									...prev.source,
									[SupportLocales.fallback]: e.target.value,
								},
							}))
						}
						placeholder={sourcePlaceholder}
						data-testid="skill-source-input"
					/>
				</div>
			</div>

			<Separator />

			{/* Language tabs */}
			<Collapsible defaultOpen={hasLocaleValues} className="flex flex-col gap-3">
				<CollapsibleTrigger className="group flex w-full items-center gap-1 text-left">
					<ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:hidden" />
					<ChevronDown className="hidden size-4 shrink-0 text-muted-foreground group-data-[state=open]:block" />
					<p className="text-sm font-medium text-muted-foreground">
						{t("localizeIdentity.title")}
					</p>
				</CollapsibleTrigger>
				<CollapsibleContent className="flex flex-col gap-3">
					<Tabs defaultValue={sortedLocales[0]}>
						<TabsList className="w-full">
							{sortedLocales.map((locale) => (
								<TabsTrigger
									key={locale}
									value={locale}
									className="flex-1"
									data-testid={`skill-locale-tab-${locale}`}
								>
									{localeLabels[locale]}
								</TabsTrigger>
							))}
						</TabsList>

						{sortedLocales.map((locale) => (
							<TabsContent
								key={locale}
								value={locale}
								className="mt-3 flex flex-col gap-3"
							>
								<div className="flex items-center gap-2">
									<div className="flex h-9 flex-1 items-center">
										<Label className="w-[172px] shrink-0 text-base font-medium">
											{t("importSkill.identity.skillName")}
										</Label>
									</div>
									<Input
										value={identity.name[locale] ?? ""}
										onChange={(e) =>
											onChange((prev) => ({
												...prev,
												name: { ...prev.name, [locale]: e.target.value },
											}))
										}
										placeholder={
											identity.name[SupportLocales.fallback]
												? `${t("localizeIdentity.usingDefault")}: ${identity.name[SupportLocales.fallback]}`
												: namePlaceholder
										}
										className="w-[320px] shrink-0"
										data-testid={`skill-locale-name-${locale}`}
									/>
								</div>
								<div className="flex items-start gap-2">
									<div className="flex min-h-[96px] flex-1 items-start pt-2">
										<Label className="w-[172px] shrink-0 text-base font-medium">
											{t("importSkill.identity.description")}
										</Label>
									</div>
									<Textarea
										value={identity.description[locale] ?? ""}
										onChange={(e) =>
											onChange((prev) => ({
												...prev,
												description: {
													...prev.description,
													[locale]: e.target.value,
												},
											}))
										}
										placeholder={
											identity.description[SupportLocales.fallback]
												? `${t("localizeIdentity.usingDefault")}: ${identity.description[SupportLocales.fallback]}`
												: descriptionPlaceholder
										}
										className="min-h-[96px] w-[320px] shrink-0 resize-none"
										data-testid={`skill-locale-description-${locale}`}
									/>
								</div>
								<div className="flex items-center gap-2">
									<div className="flex h-9 flex-1 items-center">
										<Label className="w-[172px] shrink-0 text-base font-medium">
											{t("importSkill.identity.source")}
										</Label>
									</div>
									<Input
										value={identity.source[locale] ?? ""}
										onChange={(e) =>
											onChange((prev) => ({
												...prev,
												source: {
													...prev.source,
													[locale]: e.target.value,
												},
											}))
										}
										placeholder={
											identity.source[SupportLocales.fallback]
												? `${t("localizeIdentity.usingDefault")}: ${identity.source[SupportLocales.fallback]}`
												: sourcePlaceholder
										}
										className="w-[320px] shrink-0"
										data-testid={`skill-locale-source-${locale}`}
									/>
								</div>
								<p className="text-sm text-muted-foreground">
									{t("localizeIdentity.fallbackHint")}
								</p>
							</TabsContent>
						))}
					</Tabs>
				</CollapsibleContent>
			</Collapsible>
		</div>
	)
}

export default memo(IdentityStep)
