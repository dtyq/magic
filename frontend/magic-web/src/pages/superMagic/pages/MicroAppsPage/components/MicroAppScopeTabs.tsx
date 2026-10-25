import { useTranslation } from "react-i18next"
import type { MicroAppListScope } from "@/apis/modules/superMagic"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { cn } from "@/utils/cn"

interface MicroAppScopeTabsProps {
	value: MicroAppListScope
	availableScopes: MicroAppListScope[]
	onChange: (scope: MicroAppListScope) => void
	testIdPrefix: string
	className?: string
}

function MicroAppScopeTabs({
	value,
	availableScopes,
	onChange,
	testIdPrefix,
	className,
}: MicroAppScopeTabsProps) {
	const { t } = useTranslation("super")
	const labels = {
		all: t("microAppsPage.scopeAll"),
		created: t("microAppsPage.scopeCreated"),
		collaborated: t("microAppsPage.scopeCollaborated"),
		accessible: t("microAppsPage.scopeAccessible"),
		recent: t("microAppsPage.scopeRecent"),
	}
	if (availableScopes.length <= 1) return null

	return (
		<Tabs value={value} onValueChange={(nextValue) => onChange(nextValue as MicroAppListScope)}>
			<TabsList
				className={cn(
					"h-9 w-auto max-w-full rounded-xl border border-border/40 bg-muted/40 p-1",
					className,
				)}
			>
				{availableScopes.map((item) => (
					<TabsTrigger
						key={item}
						value={item}
						data-testid={`${testIdPrefix}-${item}`}
						className="rounded-lg px-3 text-xs"
					>
						{labels[item]}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	)
}

export default MicroAppScopeTabs
