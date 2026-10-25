import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { ProjectFileTag } from "@/pages/superMagic/components/TopicFilesButton/components/TopicFileTag"
import type { TopicFileRowDecorationResolver } from "@/pages/superMagic/components/TopicFilesButton"

export function createClawPlaygroundFileRowDecorationResolver(
	projectId?: string,
): TopicFileRowDecorationResolver {
	return ({ item, isVirtual }) => {
		if (isVirtual || !projectId) return
		const presentation = resolveFilePresentation(item, { context: { kind: "claw", projectId } })
		if (!presentation.clawKind) return
		return {
			icon: <FileResourceIcon presentation={presentation} />,
			tag: <ProjectFileTag item={item} presentation={presentation} />,
		}
	}
}
