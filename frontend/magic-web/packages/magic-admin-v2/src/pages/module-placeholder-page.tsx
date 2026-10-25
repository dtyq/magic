import { Boxes } from "lucide-react"
import { PageHeaderActionButton } from "@magic-admin-v2/components/page-header-action-button"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { PageHeader } from "@magic-admin-v2/components/page-header"
import { Separator } from "@magic-admin-v2/components/ui/separator"
import { useTranslation } from "react-i18next"

type ModulePlaceholderPageProps = {
	titleKey: string
	descriptionKey: string
}

export default function ModulePlaceholderPage({
	titleKey,
	descriptionKey,
}: ModulePlaceholderPageProps) {
	const { t } = useTranslation()

	return (
		<div className="-m-4 px-4 py-6 lg:px-6" data-testid="module-placeholder-page">
			<PageHeader
				title={t(titleKey)}
				description={t(descriptionKey)}
				actions={
					<PageHeaderActionButton data-testid="module-placeholder-pending-button" disabled>
						<Boxes className="size-4" aria-hidden="true" />
						{t("common.modulePending")}
					</PageHeaderActionButton>
				}
			/>

			<Separator className="my-4 lg:my-6" />

			<div className="mt-2 pb-6">
				<EmptyState
					icon={Boxes}
					testId="module-placeholder-empty"
					title={t("modulePlaceholder.title")}
					description={t("modulePlaceholder.description")}
				/>
			</div>
		</div>
	)
}
