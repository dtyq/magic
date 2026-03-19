import { useEffect, useCallback, useRef, useState } from "react"
import { CirclePlus, Loader2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import PageTopBar from "@/pages/superMagic/components/PageTopBar"
import { crewService } from "@/services/crew/CrewService"
import { MyCrewStore } from "./stores/my-crew"
import MyCrewCard from "./components/MyCrewCard"

function MyCrewPage() {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const storeRef = useRef(new MyCrewStore())
	const store = storeRef.current

	useEffect(() => {
		store.fetchAgents()
		return () => store.reset()
	}, [store])

	const [isCreating, setIsCreating] = useState(false)

	async function handleCreateCrew() {
		if (isCreating) return
		setIsCreating(true)
		try {
			const { code } = await crewService.createDefaultAgent()
			navigate({ name: RouteName.CrewEdit, params: { id: code } })
		} catch {
			// Error handled by service / UI
		} finally {
			setIsCreating(false)
		}
	}

	const handleEdit = useCallback(
		(agentCode: string) => {
			navigate({ name: RouteName.CrewEdit, params: { id: agentCode } })
		},
		[navigate],
	)

	const { confirm, dialog } = useConfirmDialog()

	const handleDismiss = useCallback(
		(agentCode: string) => {
			const employee = store.list.find((e) => e.agentCode === agentCode)
			confirm({
				title: t("myCrewPage.dismissConfirm.title"),
				description: t("myCrewPage.dismissConfirm.description", {
					name: (employee?.name || t("crew/create:untitledCrew")) ?? agentCode,
				}),
				confirmText: t("myCrewPage.dismissConfirm.confirm"),
				variant: "destructive",
				onConfirm: () => store.deleteAgent(agentCode),
			})
		},
		[store, t, confirm],
	)

	const handleUpgrade = useCallback(
		(agentCode: string) => {
			store.upgradeAgent(agentCode)
		},
		[store],
	)

	return (
		<>
			{dialog}
			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
				data-testid="my-crew-page"
			>
				{/* Top header bar */}
				<PageTopBar data-testid="my-crew-top-bar" backButtonTestId="my-crew-back-button" />

				{/* Main scrollable section */}
				<ScrollArea className="min-h-0 flex-1">
					<div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-7">
						{/* Title + action buttons */}
						<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<h1 className="break-words text-2xl leading-tight text-foreground sm:text-3xl lg:text-4xl">
									{t("myCrewPage.title")}
								</h1>
								<p className="max-w-2xl break-words text-sm text-muted-foreground">
									{t("myCrewPage.subtitle")}
								</p>
							</div>
							<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
								<Button
									className="h-9 flex-1 gap-2 shadow-xs sm:flex-none"
									onClick={handleCreateCrew}
									disabled={isCreating}
									data-testid="my-crew-create-button"
								>
									{isCreating ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<CirclePlus className="h-4 w-4" />
									)}
									{t("createCrew")}
								</Button>
							</div>
						</div>

						{/* Loading state */}
						{store.loading && (
							<div
								className="flex items-center justify-center py-16"
								data-testid="my-crew-loading"
							>
								<Loader2 className="size-6 animate-spin text-muted-foreground" />
							</div>
						)}

						{/* Empty state */}
						{store.isEmpty && (
							<div
								className="flex flex-col items-center justify-center gap-3 py-16 text-center"
								data-testid="my-crew-empty"
							>
								<p className="text-sm text-muted-foreground">
									{t("myCrewPage.empty")}
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={handleCreateCrew}
									disabled={isCreating}
									className="gap-2"
								>
									{isCreating ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<CirclePlus className="h-4 w-4" />
									)}
									{t("createCrew")}
								</Button>
							</div>
						)}

						{/* Crew card grid */}
						{!store.loading && store.list.length > 0 && (
							<div
								className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
								data-testid="my-crew-card-grid"
							>
								{store.list.map((employee) => (
									<MyCrewCard
										key={employee.id}
										employee={employee}
										onEdit={handleEdit}
										onDismiss={handleDismiss}
										onUpgrade={handleUpgrade}
									/>
								))}
							</div>
						)}
					</div>
				</ScrollArea>
			</div>
		</>
	)
}

export default observer(MyCrewPage)
