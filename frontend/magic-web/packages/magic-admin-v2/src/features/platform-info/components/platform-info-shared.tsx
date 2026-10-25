import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import { Separator } from "@magic-admin-v2/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs"
import type { PlatformLocale } from "@magic-admin-v2/features/platform-info/types"
import {
	localeLabels,
	platformLocales,
	toPlatformLocale,
	type LocaleCompletion,
} from "@magic-admin-v2/features/platform-info/utils"

export function PlatformInfoContentSection({
	children,
	description,
	title,
}: {
	children: ReactNode
	description: string
	title: string
}) {
	return (
		<div className="flex h-full flex-col">
			<div className="shrink-0">
				<h3 className="text-lg font-medium">{title}</h3>
				<p className="text-sm text-muted-foreground">{description}</p>
				<Separator className="my-4" />
			</div>
			<div className="faded-bottom flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth">
				<div className="-mx-1 px-1.5 pb-12 pe-4">{children}</div>
			</div>
		</div>
	)
}

export function PlatformInfoContentLanguageBar({
	completion,
	value,
	onValueChange,
}: {
	completion: LocaleCompletion
	value: PlatformLocale
	onValueChange: (value: PlatformLocale) => void
}) {
	const { t } = useTranslation()

	return (
		<div className="flex flex-wrap items-center gap-3">
			<span className="text-sm font-medium text-muted-foreground">
				{t("platformInfo.language")}
			</span>
			<Tabs
				value={value}
				onValueChange={(nextValue) => onValueChange(toPlatformLocale(nextValue))}
			>
				<TabsList>
					{platformLocales.map((locale) => (
						<TabsTrigger
							className="gap-2"
							data-testid="platform-info-tab-trigger"
							key={locale}
							value={locale}
						>
							<span>{localeLabels[locale]}</span>
							<Badge
								className="h-5 px-1.5 text-[11px] leading-none shadow-none"
								variant="secondary"
							>
								{completion[locale]
									? t("platformInfo.contentLanguage.complete")
									: t("platformInfo.contentLanguage.incomplete")}
							</Badge>
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
		</div>
	)
}
