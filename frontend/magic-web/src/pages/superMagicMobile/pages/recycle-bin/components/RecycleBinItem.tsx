import { memo } from "react"
import { MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Badge } from "@/components/shadcn-ui/badge"
import { Separator } from "@/components/shadcn-ui/separator"

export interface RecycleBinItemData {
	id: string
	type: "workspace" | "project" | "topic" | "file"
	title: string
	deletedBy: string
	deletedByUser?: { nickname: string; avatar: string }
	validDays: number
	resourceId: string
	resourceType: number
	selected?: boolean
}

interface RecycleBinItemProps {
	item: RecycleBinItemData
	onSelectionChange: (id: string, selected: boolean) => void
	onMoreClick: (id: string) => void
}

function RecycleBinItem(props: RecycleBinItemProps) {
	const { item, onSelectionChange, onMoreClick } = props
	const { t } = useTranslation("super")

	function handleCheckboxChange(checked: boolean) {
		onSelectionChange(item.id, checked)
	}

	function handleMoreClick() {
		onMoreClick(item.id)
	}

	function getTypeLabel(type: RecycleBinItemData["type"]) {
		switch (type) {
			case "workspace":
				return t("mobile.recycleBin.item.type.workspace")
			case "project":
				return t("mobile.recycleBin.item.type.project")
			case "topic":
				return t("mobile.recycleBin.item.type.topic")
			case "file":
				return t("mobile.recycleBin.item.type.file")
			default:
				return type
		}
	}

	return (
		<div
			className="flex items-start gap-2.5 px-2.5 py-3"
			data-testid={`mobile-recycle-bin-item-${item.id}`}
		>
			<div className="flex min-w-0 flex-1 items-start gap-2">
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<Checkbox
							checked={item.selected || false}
							onCheckedChange={handleCheckboxChange}
							className="size-4"
							data-testid={`mobile-recycle-bin-item-checkbox-${item.id}`}
						/>

						<Badge
							variant="outline"
							className="h-5 shrink-0 rounded-lg border-[#E5E5E5] px-2 text-xs font-normal leading-4 text-foreground"
							data-testid={`mobile-recycle-bin-item-badge-${item.id}`}
						>
							{getTypeLabel(item.type)}
						</Badge>

						<div
							className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-foreground"
							data-testid={`mobile-recycle-bin-item-title-${item.id}`}
						>
							{item.title}
						</div>
					</div>

					<div className="flex items-center gap-2">
						{/* 仅文件类型显示删除人信息（头像、昵称） */}
						{item.type === "file" && (
							<>
								<div
									className="flex items-center gap-1.5 text-xs font-normal leading-4 text-[#737373]"
									data-testid={`mobile-recycle-bin-item-deleted-by-${item.id}`}
								>
									{item.deletedByUser?.avatar ? (
										<img
											src={item.deletedByUser.avatar}
											alt=""
											className="size-4 shrink-0 rounded-full object-cover"
											referrerPolicy="no-referrer"
										/>
									) : null}
									{t("mobile.recycleBin.item.deletedBy", {
										username: item.deletedBy,
									})}
								</div>
								<Separator
									orientation="vertical"
									className="h-3 w-px bg-[#E5E5E5]"
								/>
							</>
						)}
						<div
							className="text-xs font-normal leading-3 text-[#737373]"
							data-testid={`mobile-recycle-bin-item-valid-days-${item.id}`}
						>
							{t("mobile.recycleBin.item.validDays", { days: item.validDays })}
						</div>
					</div>
				</div>
			</div>

			<Button
				variant="ghost"
				size="icon"
				className="size-5 shrink-0 rounded-lg p-0"
				onClick={handleMoreClick}
				aria-label={t("mobile.recycleBin.item.more")}
				data-testid={`mobile-recycle-bin-item-more-${item.id}`}
			>
				<MoreHorizontal className="size-4 text-foreground" />
			</Button>
		</div>
	)
}

export default memo(RecycleBinItem)
