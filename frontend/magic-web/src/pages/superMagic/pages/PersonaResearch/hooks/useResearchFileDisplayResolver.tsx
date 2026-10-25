import { useMemo } from "react"
import {
	ClipboardList,
	FileText,
	FlaskConical,
	Layers,
	LayoutTemplate,
	ListChecks,
	MessageSquareQuote,
	MessagesSquare,
	Search,
	Split,
	UserRound,
	Users,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ProjectFileDisplayResolver } from "@/components/business/MentionPanel/types"
import { usePersonaResearchStore } from "../context"
import { normalizeResearchPath } from "../services/researchFiles"
import { createResearchFileDisplayResolver } from "../services/researchFileDisplay"

/**
 * Readable names for the research project's files, shared by every file surface (the @ panel's
 * project files and the history files sidebar) so a file reads the same everywhere.
 * Names come from content the store has already parsed; unknown files keep their real names.
 */
export function useResearchFileDisplayResolver(): ProjectFileDisplayResolver {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()

	return useMemo(
		() =>
			createResearchFileDisplayResolver(
				{
					personas: t("mention.personasDir"),
					panels: t("mention.panelsDir"),
					studies: t("mention.studiesDir"),
					templates: t("mention.reportTemplates"),
					defaultTemplate: t("reportTemplates.defaultName"),
					interviews: t("mention.interviews"),
					discussions: t("mention.discussionsDir"),
					study: {
						report: t("console.docReport"),
						plan: t("console.docPlan"),
						deskResearch: t("console.docDeskResearch"),
						validation: t("console.docValidation"),
						panel: t("mention.participantList"),
					},
				},
				{
					personas: <Users size={16} />,
					panels: <Layers size={16} />,
					studies: <FlaskConical size={16} />,
					templates: <LayoutTemplate size={16} />,
					study: <FlaskConical size={16} />,
					interviews: <MessagesSquare size={16} />,
					discussions: <Split size={16} />,
					persona: <UserRound size={16} />,
					interview: <MessageSquareQuote size={16} />,
					template: <LayoutTemplate size={16} />,
					studyFiles: {
						report: <FileText size={16} />,
						plan: <ClipboardList size={16} />,
						deskResearch: <Search size={16} />,
						validation: <ListChecks size={16} />,
						panel: <Users size={16} />,
					},
				},
				{
					// Read at render time from what the store has already parsed; the library may be
					// only partly loaded, so unknown files keep their names.
					personaName: (path) =>
						store.personas.find((ref) => normalizeResearchPath(ref.path) === path)?.data
							.name,
					interviewLabel: (path) => {
						const personaId = store.interviews.find(
							(ref) => normalizeResearchPath(ref.path) === path,
						)?.data.persona_id
						const name = personaId ? store.personaById(personaId)?.name : undefined
						return name ? t("mention.interviewOf", { name }) : undefined
					},
					studyTitle: (path) => store.studyTitleOfDir(path),
				},
			),
		[store, t],
	)
}
