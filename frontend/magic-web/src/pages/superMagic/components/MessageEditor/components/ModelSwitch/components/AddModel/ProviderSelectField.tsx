import { useState, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	Select,
	SelectTrigger,
	SelectSeparator,
	SelectValue,
} from "@/components/shadcn-ui/select"
import * as SelectPrimitive from "@radix-ui/react-select"
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/shadcn-ui/dropdown-menu"
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from "@/components/shadcn-ui/alert-dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { Plus, Ellipsis, Check, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAddModelStore } from "./context"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { ServiceIcon } from "@dtyq/magic-admin"

interface ProviderSelectFieldProps {
	showError: boolean
	onProviderTouchedChange: () => void
}

// Shared viewport class for loading / empty states
const VIEWPORT_CLS = "p-1 w-full min-w-[var(--radix-select-trigger-width)]"

function ProviderSelectField({ showError, onProviderTouchedChange }: ProviderSelectFieldProps) {
	const { t } = useTranslation("super")
	const store = useAddModelStore()
	const [selectOpen, setSelectOpen] = useState(false)

	const handleSelectOpenChange = useCallback(
		(open: boolean) => {
			setSelectOpen(open)
			if (!open) onProviderTouchedChange()
		},
		[onProviderTouchedChange],
	)

	// Close the Select first, then execute the action to avoid
	// Radix DismissableLayer unmounting the DropdownMenu before click fires.
	const handleProviderAction = useCallback((action: () => void) => {
		setSelectOpen(false)
		queueMicrotask(action)
	}, [])

	// Prevent Select from auto-closing when pointer-down lands inside a
	// DropdownMenu portal (outside the Select's DOM subtree).
	const handlePointerDownOutside = useCallback(
		(e: { target: EventTarget | null; preventDefault: () => void }) => {
			const target = e.target
			if (!(target instanceof Element)) return
			if (target.closest('[data-slot="dropdown-menu-content"]')) e.preventDefault()
		},
		[],
	)

	const selectedProvider = store.serviceProviders.find((p) => p.id === store.selectedProviderId)

	return (
		<>
			<div className="flex flex-col gap-1">
				<Select
					open={selectOpen}
					onOpenChange={handleSelectOpenChange}
					value={store.selectedProviderId}
					onValueChange={store.setSelectedProviderId}
				>
					<SelectTrigger
						className={cn(
							"h-9 w-full",
							showError && "border-destructive focus-visible:ring-destructive/20",
						)}
						data-testid="add-model-provider-select"
					>
						<span className="flex min-w-0 flex-1 items-center gap-2">
							{selectedProvider && (
								<ServiceIcon
									code={selectedProvider.providerTypeId}
									size={16}
									className="shrink-0"
								/>
							)}
							<SelectValue
								placeholder={t("messageEditor.addModel.selectPlaceholder")}
							/>
						</span>
					</SelectTrigger>

					{/*
					 * Use SelectPrimitive.Content directly so we can place the
					 * "Add Provider" button OUTSIDE SelectPrimitive.Viewport.
					 * This keeps the button pinned at the top and prevents it
					 * from scrolling with the provider list.
					 */}
					<SelectPrimitive.Portal>
						<SelectPrimitive.Content
							data-slot="select-content"
							className={cn(
								"max-h-(--radix-select-content-available-height) origin-(--radix-select-content-transform-origin)",
								"relative min-w-[8rem] overflow-hidden rounded-md border bg-popover",
								"text-popover-foreground shadow-md",
								"data-[state=open]:animate-in data-[state=closed]:animate-out",
								"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
								"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
								"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
								"data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
								"data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1",
								"data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
								"z-select flex flex-col",
							)}
							position="popper"
							onPointerDownOutside={handlePointerDownOutside}
						>
							{store.isLoadingProviders ? (
								<SelectPrimitive.Viewport className={VIEWPORT_CLS}>
									<div
										className="flex items-center justify-center py-6"
										data-testid="provider-select-loading"
									>
										<Spinner
											size={20}
											className="animate-spin text-muted-foreground"
										/>
									</div>
								</SelectPrimitive.Viewport>
							) : store.serviceProviders.length > 0 ? (
								<>
									{/* Fixed header — outside Viewport, always visible */}
									<div className="shrink-0 p-1 pb-0">
										<button
											type="button"
											className={cn(
												"flex h-9 w-full items-center justify-center gap-2",
												"rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground",
												"shadow-xs transition-colors",
												"hover:bg-primary/90 active:bg-primary/80",
												"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
											)}
											onMouseDown={(e) => e.preventDefault()}
											onClick={() => store.openAddProvider()}
											data-testid="add-model-add-provider-button"
										>
											<Plus size={16} />
											{t("messageEditor.addModel.addProvider")}
										</button>
										<SelectSeparator className="mt-1" />
									</div>

									{/* Scrollable list inside Viewport */}
									<SelectPrimitive.Viewport className={VIEWPORT_CLS}>
										<ScrollArea
											className="max-h-[300px]"
											onWheel={(e) => e.stopPropagation()}
										>
											{store.serviceProviders.map((provider) => (
												<SelectPrimitive.Item
													key={provider.id}
													value={provider.id}
													className={cn(
														"relative flex w-full cursor-default select-none items-center gap-2",
														"rounded-[2px] px-2 py-1.5 text-sm outline-none",
														"focus:bg-accent focus:text-accent-foreground",
														"data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
													)}
												>
													<ServiceIcon
														code={provider.providerTypeId}
														size={16}
													/>
													<span className="min-w-0 flex-1 truncate text-popover-foreground">
														<SelectPrimitive.ItemText>
															{provider.name}
														</SelectPrimitive.ItemText>
													</span>
													<SelectPrimitive.ItemIndicator className="flex items-center text-foreground">
														<Check size={16} />
													</SelectPrimitive.ItemIndicator>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<button
																type="button"
																className={cn(
																	"shrink-0 rounded p-0.5",
																	"text-muted-foreground",
																	"hover:bg-fill hover:text-foreground",
																	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
																)}
																onPointerDown={(e) =>
																	e.stopPropagation()
																}
																onClick={(e) => e.stopPropagation()}
																data-testid={`provider-actions-${provider.id}`}
															>
																<Ellipsis size={16} />
															</button>
														</DropdownMenuTrigger>
														<DropdownMenuContent
															align="end"
															side="right"
															onCloseAutoFocus={(e) =>
																e.preventDefault()
															}
														>
															<DropdownMenuItem
																onPointerDown={(e) => {
																	e.preventDefault()
																	e.stopPropagation()
																	handleProviderAction(() =>
																		store.openEditProvider(
																			provider.id,
																		),
																	)
																}}
																data-testid={`provider-edit-${provider.id}`}
															>
																<Pencil size={16} />
																{t("messageEditor.addModel.edit")}
															</DropdownMenuItem>
															<DropdownMenuItem
																className="text-destructive focus:text-destructive"
																onPointerDown={(e) => {
																	e.preventDefault()
																	e.stopPropagation()
																	handleProviderAction(() =>
																		store.openDeleteProvider(
																			provider.id,
																		),
																	)
																}}
																data-testid={`provider-delete-${provider.id}`}
															>
																<Trash2 size={16} />
																{t("messageEditor.addModel.delete")}
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</SelectPrimitive.Item>
											))}
										</ScrollArea>
									</SelectPrimitive.Viewport>
								</>
							) : (
								<SelectPrimitive.Viewport className={VIEWPORT_CLS}>
									<div className="flex flex-col items-center gap-3 p-6">
										<div className="flex size-12 items-center justify-center rounded-md border border-border bg-card shadow-xs">
											<span className="text-muted-foreground">?</span>
										</div>
										<div className="flex flex-col items-center gap-2 text-center">
											<p className="text-lg font-medium text-foreground">
												{t("messageEditor.addModel.noProvidersAvailable")}
											</p>
											<p className="text-sm text-muted-foreground">
												{t("messageEditor.addModel.addProviderHint")}
											</p>
										</div>
										<Button
											className="w-full"
											onClick={() => store.openAddProvider()}
											data-testid="add-model-add-provider-button"
										>
											{t("messageEditor.addModel.addProvider")}
										</Button>
									</div>
								</SelectPrimitive.Viewport>
							)}
						</SelectPrimitive.Content>
					</SelectPrimitive.Portal>
				</Select>

				{showError && (
					<p className="text-xs text-destructive" role="alert">
						{t("messageEditor.addModel.fieldRequired")}
					</p>
				)}
			</div>

			{/* Delete confirmation dialog */}
			<AlertDialog
				open={!!store.deletingProviderId}
				onOpenChange={(open) => {
					if (!open) store.closeDeleteProvider()
				}}
			>
				<AlertDialogContent data-testid="delete-provider-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("messageEditor.addModel.deleteProviderTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("messageEditor.addModel.deleteProviderDesc")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel data-testid="delete-provider-cancel">
							{t("messageEditor.addModel.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={store.confirmDeleteProvider}
							data-testid="delete-provider-confirm"
						>
							{t("messageEditor.addModel.delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

export default observer(ProviderSelectField)
