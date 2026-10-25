import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
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
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { usePersonaResearchStore } from "../context"

/**
 * Opening and deleting studies from a list (the home and the full study list): `requestDelete`
 * asks first, and `deleteDialog` must be rendered once by the page that uses the hook.
 */
export function useStudyActions() {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const navigate = useNavigate()
	const [pendingDelete, setPendingDelete] = useState<Topic | null>(null)

	const openStudy = useMemoizedFn((topic: Topic) => {
		navigate({ name: RouteName.PersonaResearchStudy, params: { topicId: topic.id } })
	})

	const confirmDelete = useMemoizedFn(async () => {
		const topic = pendingDelete
		setPendingDelete(null)
		if (!topic) return
		try {
			await store.deleteStudy(topic.id)
			toast.success(t("home.deleted"))
		} catch {
			toast.error(t("home.deleteFailed"))
		}
	})

	const deleteDialog = (
		<AlertDialog
			open={Boolean(pendingDelete)}
			onOpenChange={(open) => !open && setPendingDelete(null)}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("home.deleteTitle")}</AlertDialogTitle>
					<AlertDialogDescription>{t("home.deleteDescription")}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
					<AlertDialogAction
						className="bg-destructive text-white hover:bg-destructive/90"
						onClick={() => void confirmDelete()}
					>
						{t("home.delete")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)

	return { openStudy, requestDelete: setPendingDelete, deleteDialog }
}
