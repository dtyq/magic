import { type ReactNode, useMemo } from "react"
import { BookMarked, FileUp, FolderDot, TextCursorInput } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import MagicDropdown from "@/components/base/MagicDropdown"

interface DocumentAddDropdownProps {
	children: ReactNode
	onLocalDocuments?: () => void
	onCustomContent?: () => void
	onFromProject?: () => void
	onFromEnterpriseWiki?: () => void
	placement?: string
	className?: string
	overlayClassName?: string
}

function DocumentAddDropdown({
	children,
	onLocalDocuments,
	onCustomContent,
	onFromProject,
	onFromEnterpriseWiki,
	placement = "bottomLeft",
	className,
	overlayClassName,
}: DocumentAddDropdownProps) {
	const { t } = useTranslation("crew/create")

	const menuItems = useMemo(() => {
		const items = []

		// 只渲染传入了对应 callback 的菜单项
		if (onLocalDocuments) {
			items.push({
				key: "local-documents",
				icon: <FileUp className="mt-0.5 size-4 shrink-0" aria-hidden />,
				label: (
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">
							{t("knowledgeDetail.addContentMenu.localDocuments.title")}
						</span>
						<span className="text-xs text-muted-foreground">
							{t("knowledgeDetail.addContentMenu.localDocuments.description")}
						</span>
					</div>
				),
				onClick: onLocalDocuments,
				"data-testid": "document-add-menu-local",
			})
		}

		if (onCustomContent) {
			items.push({
				key: "custom-content",
				icon: <TextCursorInput className="mt-0.5 size-4 shrink-0" aria-hidden />,
				label: (
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">
							{t("knowledgeDetail.addContentMenu.customContent.title")}
						</span>
						<span className="text-xs text-muted-foreground">
							{t("knowledgeDetail.addContentMenu.customContent.description")}
						</span>
					</div>
				),
				onClick: onCustomContent,
				"data-testid": "document-add-menu-custom",
			})
		}

		if (onFromProject) {
			items.push({
				key: "from-project",
				icon: <FolderDot className="mt-0.5 size-4 shrink-0" aria-hidden />,
				label: (
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">
							{t("knowledgeDetail.addContentMenu.project.title")}
						</span>
						<span className="text-xs text-muted-foreground">
							{t("knowledgeDetail.addContentMenu.project.description")}
						</span>
					</div>
				),
				onClick: onFromProject,
				"data-testid": "document-add-menu-project",
			})
		}

		if (onFromEnterpriseWiki) {
			items.push({
				key: "enterprise-wiki",
				icon: <BookMarked className="mt-0.5 size-4 shrink-0" aria-hidden />,
				label: (
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">
							{t("knowledgeDetail.addContentMenu.enterpriseWiki.title")}
						</span>
						<span className="text-xs text-muted-foreground">
							{t("knowledgeDetail.addContentMenu.enterpriseWiki.description")}
						</span>
					</div>
				),
				onClick: onFromEnterpriseWiki,
				"data-testid": "document-add-menu-wiki",
			})
		}

		return items
	}, [t, onCustomContent, onLocalDocuments, onFromProject, onFromEnterpriseWiki])

	return (
		<MagicDropdown
			menu={{ items: menuItems }}
			placement={placement}
			overlayClassName={cn(
				"w-[320px] min-w-[320px]",
				"[&_[data-slot='dropdown-menu-item']]:items-start",
				"[&_[data-slot='dropdown-menu-item']]:!p-2",
				overlayClassName,
			)}
		>
			<span className={className}>{children}</span>
		</MagicDropdown>
	)
}

export default DocumentAddDropdown
