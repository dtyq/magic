import { useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Button } from "@/components/shadcn-ui/button"
import { Badge } from "@/components/shadcn-ui/badge"
import { cn } from "@/utils/cn"
import { usePublishPanelStore } from "../context"
import { getPublishToCopyKeys, getPublishToUiKey } from "../publishCopy"
import type { PublishTo } from "../types"
import PublishInternalTargetSection from "./PublishInternalTargetSection"

const publishToOrder: PublishTo[] = ["INTERNAL", "MARKET"]

interface PublishTargetFieldsProps {
	disabled?: boolean
}

export default observer(function PublishTargetFields({
	disabled = false,
}: PublishTargetFieldsProps) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const [pendingPublishTo, setPendingPublishTo] = useState<PublishTo | null>(null)
	const availablePublishTo = publishToOrder.filter((item) =>
		store.availablePublishTo.includes(item),
	)
	const handleSelectPublishTo = (nextPublishTo: PublishTo) => {
		if (store.isPublishToSelected(nextPublishTo)) return
		if (store.currentPublishTo && nextPublishTo !== store.currentPublishTo) {
			setPendingPublishTo(nextPublishTo)
			return
		}

		store.selectPublishTo(nextPublishTo)
	}

	return (
		<>
			<div className="flex flex-col gap-4" data-testid="skill-publish-target-fields">
				<p className="flex items-center gap-1 text-base font-medium text-foreground">
					{t("skillEditPage.publishPanel.create.fields.target.label")}
					<span className="text-destructive" aria-hidden="true">
						*
					</span>
				</p>

				<div className="grid gap-5 md:grid-cols-2">
					{availablePublishTo.map((publishTo) => (
						<PublishToCard
							key={publishTo}
							publishTo={publishTo}
							selected={store.isPublishToSelected(publishTo)}
							onSelect={handleSelectPublishTo}
							disabled={disabled}
						/>
					))}
				</div>

				{store.draft.publishTo === "INTERNAL" ? (
					<PublishInternalTargetSection disabled={disabled} />
				) : (
					<>
						<MarketCategoryField disabled={disabled} />
						<PublishingProcess />
					</>
				)}
			</div>
			<AlertDialog
				open={Boolean(pendingPublishTo)}
				onOpenChange={(open) => {
					if (!open) setPendingPublishTo(null)
				}}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("skillEditPage.publishPanel.create.channelChangeConfirm.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("skillEditPage.publishPanel.create.channelChangeConfirm.content")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("skillEditPage.publishPanel.actions.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (pendingPublishTo) store.selectPublishTo(pendingPublishTo)
								setPendingPublishTo(null)
							}}
						>
							{t("skillEditPage.publishPanel.create.channelChangeConfirm.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
})

const MarketCategoryField = observer(function MarketCategoryField({
	disabled = false,
}: {
	disabled?: boolean
}) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const selectedCategoryIds =
		store.draft.categoryIds ?? (store.draft.categoryId ? [store.draft.categoryId] : [])
	const selectedCategoryNames = selectedCategoryIds
		.map(
			(categoryId) =>
				store.marketCategories.find((category) => category.id === categoryId)?.name,
		)
		.filter((name): name is string => Boolean(name))

	if (store.marketCategories.length === 0) return null

	const toggleCategory = (categoryId: string, checked: boolean) => {
		const nextCategoryIds = checked
			? [...selectedCategoryIds, categoryId]
			: selectedCategoryIds.filter((selectedCategoryId) => selectedCategoryId !== categoryId)
		store.setCategoryIds(nextCategoryIds)
	}

	return (
		<div className="flex flex-col gap-1.5" data-testid="skill-publish-category-field">
			<label className="flex items-center gap-1 text-base font-medium text-foreground">
				{t("skillEditPage.publishPanel.create.fields.category.label")}
				<span className="text-destructive" aria-hidden="true">
					*
				</span>
				<span className="sr-only">
					{t("skillEditPage.publishPanel.create.fields.category.required")}
				</span>
			</label>
			<DropdownMenu>
				<DropdownMenuTrigger asChild disabled={disabled}>
					<Button
						type="button"
						variant="outline"
						className="h-auto min-h-9 w-full justify-between rounded-md px-3 py-1.5 font-normal"
						aria-required="true"
						data-testid="skill-publish-category-select"
					>
						<span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 overflow-hidden text-left">
							{selectedCategoryNames.length ? (
								selectedCategoryNames.map((categoryName) => (
									<Badge
										key={categoryName}
										variant="secondary"
										className="max-w-full rounded-md px-2 py-0.5 font-normal"
									>
										<span className="truncate">{categoryName}</span>
									</Badge>
								))
							) : (
								<span className="truncate text-muted-foreground">
									{t(
										"skillEditPage.publishPanel.create.fields.category.placeholder",
									)}
								</span>
							)}
						</span>
						<ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="max-h-64 w-[--radix-dropdown-menu-trigger-width] overflow-y-auto"
				>
					{store.marketCategories.map((category) => (
						<DropdownMenuCheckboxItem
							key={category.id}
							checked={selectedCategoryIds.includes(category.id)}
							onCheckedChange={(checked) =>
								toggleCategory(category.id, Boolean(checked))
							}
							onSelect={(event) => event.preventDefault()}
						>
							{category.name}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
})

function PublishToCard({
	publishTo,
	selected,
	onSelect,
	disabled = false,
}: {
	publishTo: PublishTo
	selected: boolean
	onSelect: (publishTo: PublishTo) => void
	disabled?: boolean
}) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const copy = getPublishToCopyKeys({
		publishTo,
		marketCopy: store.marketCopy,
	})
	const publishToUiKey = getPublishToUiKey(publishTo)

	return (
		<button
			type="button"
			className={cn(
				"flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors",
				selected ? "border-foreground" : "border-border",
			)}
			onClick={() => onSelect(publishTo)}
			disabled={disabled}
			data-testid={`skill-publish-to-${publishToUiKey}`}
		>
			<div
				className={cn(
					"mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
					selected ? "border-primary bg-primary" : "border-input bg-background",
				)}
				aria-hidden="true"
			>
				<div
					className={cn(
						"size-2 rounded-full",
						selected ? "bg-primary-foreground" : "bg-transparent",
					)}
				/>
			</div>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium leading-none text-foreground">
					{t(copy.labelKey)}
				</p>
				<p className="mt-1.5 text-sm leading-5 text-muted-foreground">
					{t(copy.descriptionKey)}
				</p>
			</div>
		</button>
	)
}

function PublishingProcess() {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const steps = [
		t("skillEditPage.publishPanel.create.fields.target.skillsLibrary.steps.submit"),
		t("skillEditPage.publishPanel.create.fields.target.skillsLibrary.steps.review"),
		t(store.marketCopy.publishToLabelKey),
	]

	return (
		<div className="flex flex-col gap-2" data-testid="skill-publish-process-section">
			<p className="text-base font-medium text-foreground">
				{t("skillEditPage.publishPanel.create.fields.publishingProcess.label")}
			</p>
			<div
				className="flex flex-wrap items-center justify-center gap-8 rounded-md border border-border bg-card px-3 py-6"
				data-testid="skill-publish-process-card"
			>
				{steps.map((step, index) => (
					<div key={step} className="flex items-center gap-3">
						<div
							className={cn(
								"flex size-8 items-center justify-center rounded-full border text-sm font-semibold leading-none",
								index === 0
									? "border-primary bg-primary text-primary-foreground"
									: "border-border bg-background text-muted-foreground",
							)}
						>
							{index + 1}
						</div>
						<p
							className={cn(
								"text-sm leading-none",
								index === 0 ? "text-foreground" : "text-muted-foreground",
							)}
						>
							{step}
						</p>
					</div>
				))}
			</div>
		</div>
	)
}
