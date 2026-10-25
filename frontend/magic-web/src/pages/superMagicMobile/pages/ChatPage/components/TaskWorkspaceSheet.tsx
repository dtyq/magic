import { useState } from "react"
import { Check, Plus, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Input } from "@/components/shadcn-ui/input"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import SuperMagicService from "@/pages/superMagic/services"
import { MobileResourceTypeIcon } from "@/pages/superMagicMobile/components/icons/mobile-resource-type-icon"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { CreateWorkspaceSheet } from "../../WorkspacesPage/components/CreateWorkspaceSheet"
import { useTaskWorkspaceOptions } from "../hooks/useTaskWorkspaceOptions"

export default function TaskWorkspaceSheet({
	open,
	onClose,
	selectedId,
	onSelect,
}: {
	open: boolean
	onClose: () => void
	selectedId?: string
	onSelect: (workspace: Workspace) => void
}) {
	const { t } = useTranslation("super/mainInput")
	const { t: tSuper } = useTranslation("super")
	const options = useTaskWorkspaceOptions(open)
	const [creating, setCreating] = useState(false)
	const [saving, setSaving] = useState(false)
	return (
		<>
			<MagicPopup
				visible={open && !creating}
				onClose={onClose}
				onOpenChange={(value) => {
					if (!value) onClose()
				}}
				position="bottom"
				title={t("mobileHome.chooseWorkspace")}
				headerVariant="actionHeader"
				headerTitle={t("mobileHome.chooseWorkspace")}
				headerTrailingAction={{
					icon: <Plus className="size-4" />,
					ariaLabel: t("mobileHome.createWorkspace"),
					onClick: () => setCreating(true),
				}}
				className="flex flex-col overflow-hidden rounded-t-2xl bg-background"
				bodyClassName="flex min-h-0 flex-col p-4"
			>
				<div className="relative mb-3 shrink-0">
					<Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
					<Input
						className="pl-9"
						value={options.search}
						onChange={(event) => options.setSearch(event.target.value)}
						placeholder={t("mobileHome.searchWorkspaces")}
						aria-label={t("mobileHome.searchWorkspaces")}
					/>
				</div>
				<ScrollArea
					className="h-[45dvh] min-h-0"
					// Radix wraps content in a `display: table` box that grows with long names; keep it block so rows truncate within the sheet.
					viewportClassName="overscroll-contain [&>div]:!block"
				>
					<div
						// Match the sidebar rows: the body keeps padding for controls, while rows reach the same edge.
						className="-mx-4 flex flex-col gap-1"
						role="listbox"
						aria-label={t("mobileHome.chooseWorkspace")}
					>
						{options.items.map((workspace) => (
							<button
								key={workspace.id}
								type="button"
								role="option"
								aria-selected={workspace.id === selectedId}
								className="flex h-16 w-full shrink-0 items-center gap-2 rounded-lg px-4 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
								onClick={() => {
									onSelect(workspace)
									onClose()
								}}
							>
								<MobileResourceTypeIcon type="workspace" loaderSizeClass="size-6" />
								<div className="flex min-w-0 flex-1 flex-col items-start">
									<p className="max-w-full truncate text-[16px] font-medium leading-6 text-foreground">
										{workspace.name || tSuper("workspace.unnamedWorkspace")}
									</p>
									<p className="max-w-full truncate text-[12px] font-light leading-4 text-muted-foreground">
										{tSuper("workspace.projectCount", {
											count:
												workspace.project_count ??
												workspace.cooperate_project_count ??
												0,
										})}
									</p>
								</div>
								{workspace.id === selectedId && (
									<Check className="size-4 shrink-0 text-primary" />
								)}
							</button>
						))}
					</div>
					{options.loading && (
						<p className="p-4 text-center text-sm text-muted-foreground" role="status">
							{t("mobileHome.loading")}
						</p>
					)}
					{options.error ? (
						<Button variant="ghost" className="w-full" onClick={options.retry}>
							{t("mobileHome.retry")}
						</Button>
					) : (
						!options.loading &&
						!options.items.length && (
							<p className="p-4 text-center text-sm text-muted-foreground">
								{t("mobileHome.noWorkspaces")}
							</p>
						)
					)}
					{options.hasMore && !options.loading && !options.error && (
						<Button variant="ghost" className="w-full" onClick={options.loadMore}>
							{t("mobileHome.loadMore")}
						</Button>
					)}
				</ScrollArea>
			</MagicPopup>
			<CreateWorkspaceSheet
				isOpen={creating}
				onClose={() => {
					if (!saving) setCreating(false)
				}}
				onCreate={async (name) => {
					if (saving) return
					setSaving(true)
					try {
						const workspace = await SuperMagicService.workspace.createWorkspace(name)
						if (workspace) {
							onSelect(workspace)
							setCreating(false)
							onClose()
						}
					} finally {
						setSaving(false)
					}
				}}
			/>
		</>
	)
}
