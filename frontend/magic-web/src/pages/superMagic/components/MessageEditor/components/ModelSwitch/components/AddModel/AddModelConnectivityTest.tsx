import { useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { OrgAiModelProviderApi } from "@/apis"
import { useAddModelStore } from "./context"

interface AddModelConnectivityTestProps {
	onBeforeTest?: () => void
	onLoadingChange?: (isLoading: boolean) => void
}

interface ConnectivityResultState {
	content: string
}

function AddModelConnectivityTest({
	onBeforeTest,
	onLoadingChange,
}: AddModelConnectivityTestProps) {
	const { t } = useTranslation("super")
	const store = useAddModelStore()
	const [isTestingConnectivity, setIsTestingConnectivity] = useState(false)
	const [connectivityResult, setConnectivityResult] = useState<ConnectivityResultState | null>(
		null,
	)

	useEffect(() => {
		onLoadingChange?.(isTestingConnectivity)
	}, [isTestingConnectivity, onLoadingChange])

	const handleConnectivityTest = async () => {
		onBeforeTest?.()

		const modelId = store.providerModelId.trim()
		if (!store.selectedProviderId || !modelId) return

		try {
			setIsTestingConnectivity(true)
			const result = await OrgAiModelProviderApi.testAiModelConnectivity({
				service_provider_config_id: store.selectedProviderId,
				model_version: modelId,
			})

			if (result.status) {
				setConnectivityResult({
					content: t("messageEditor.addModel.connectivitySuccess"),
				})
			} else {
				setConnectivityResult({
					content:
						result.message?.trim() || t("messageEditor.addModel.connectivityFailed"),
				})
			}
		} catch (error: any) {
			setConnectivityResult({
				content: error?.message?.trim() || t("messageEditor.addModel.connectivityFailed"),
			})
		} finally {
			setIsTestingConnectivity(false)
		}
	}

	return (
		<>
			<Button
				variant="outline"
				onClick={handleConnectivityTest}
				disabled={store.isSubmitting || isTestingConnectivity}
				data-testid="add-model-connectivity-test-button"
			>
				{isTestingConnectivity ? (
					<>
						<Spinner size={16} className="animate-spin" />
						{t("messageEditor.addModel.connectivityTest")}
					</>
				) : (
					t("messageEditor.addModel.connectivityTest")
				)}
			</Button>

			<AlertDialog
				open={!!connectivityResult}
				onOpenChange={(open) => {
					if (!open) setConnectivityResult(null)
				}}
			>
				<AlertDialogContent data-testid="add-model-connectivity-result-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("messageEditor.addModel.connectivityResultTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription
							className="whitespace-pre-wrap break-all text-sm leading-5 text-muted-foreground"
							data-testid="add-model-connectivity-result-content"
						>
							{connectivityResult?.content}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="border-t border-border bg-muted px-4 py-4">
						<AlertDialogAction
							onClick={() => setConnectivityResult(null)}
							data-testid="add-model-connectivity-result-close-button"
						>
							{t("messageEditor.addModel.close")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

export default observer(AddModelConnectivityTest)
