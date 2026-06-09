import { useState } from "react"
import { flushSync } from "react-dom"
import type { TFunction } from "i18next"
import { useMemoizedFn } from "ahooks"
import { pickManifestSkillName } from "../utils/skill-workspace-manifest"
import { ensureSkillConfigYamlForPublish } from "../utils/ensureSkillConfigYaml"
import type { SkillEditRootStore } from "../store/root-store"

interface UseSkillPublishGuardParams {
	store: SkillEditRootStore
	t: TFunction<"crew/market">
	onPublishReady: () => void
}

export function useSkillPublishGuard({ store, t, onPublishReady }: UseSkillPublishGuardParams) {
	const [isPublishIdentityDialogOpen, setIsPublishIdentityDialogOpen] = useState(false)
	const [isEnsuringSkillConfigForPublish, setIsEnsuringSkillConfigForPublish] = useState(false)

	const preparePublish = useMemoizedFn(async () => {
		flushSync(() => setIsEnsuringSkillConfigForPublish(true))
		try {
			const ensured = await ensureSkillConfigYamlForPublish({
				projectId: store.project?.id,
				getWorkspaceFilesList: () => store.projectFilesStore.workspaceFilesList,
				getWorkspaceFileTree: () => store.projectFilesStore.workspaceFileTree,
				getSkillName: () => store.skill?.name,
				t,
			})
			if (!ensured) return

			onPublishReady()
		} finally {
			setIsEnsuringSkillConfigForPublish(false)
		}
	})

	const handleOpenPublishPanel = useMemoizedFn(async () => {
		const hasApiName = Boolean(store.skill?.name?.trim())
		const hasManifestName = Boolean(pickManifestSkillName(store.skillWorkspaceManifest)?.trim())

		if (!hasApiName && !hasManifestName) {
			setIsPublishIdentityDialogOpen(true)
			return
		}

		await preparePublish()
	})

	const handlePublishIdentityDialogOpenChange = useMemoizedFn((open: boolean) => {
		setIsPublishIdentityDialogOpen(open)
	})

	const handlePublishIdentitySaved = useMemoizedFn(async () => {
		setIsPublishIdentityDialogOpen(false)
		await preparePublish()
	})

	return {
		isPublishIdentityDialogOpen,
		isEnsuringSkillConfigForPublish,
		handleOpenPublishPanel,
		handlePublishIdentityDialogOpenChange,
		handlePublishIdentitySaved,
	}
}
