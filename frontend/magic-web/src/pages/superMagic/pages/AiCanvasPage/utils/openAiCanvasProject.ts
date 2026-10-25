import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import SuperMagicService from "@/pages/superMagic/services"
import { interfaceStore } from "@/stores/interface"

/**
 * Opens an AI canvas project in the current shell: the desktop project route (which renders the
 * canvas-only layout) or the H5 project page. The shared project actions only know the desktop
 * switch, so the AI canvas home routes every open through here.
 */
export function openAiCanvasProject(project: ProjectListItem) {
	return interfaceStore.isMobile
		? SuperMagicService.switchProjectInMobile(project)
		: SuperMagicService.switchProjectInDesktop(project)
}
