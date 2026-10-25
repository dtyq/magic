import { useTranslation } from "react-i18next"
import { ResearchOnboardingAnchor, type ResearchOnboardingPage } from "./onboardingState"
import type { ResearchSpotlightStep } from "./ResearchSpotlight"

/**
 * Step copy per page. Respondents are always called AI-simulated: the tour must never suggest a
 * study speaks for real customers. Each anchor is optional — see `ResearchSpotlight`.
 */
export function useResearchOnboardingSteps(page: ResearchOnboardingPage): {
	steps: ResearchSpotlightStep[]
	finishLabel: string
} {
	const { t } = useTranslation("personaResearch")

	if (page === "home") {
		return {
			finishLabel: t("onboarding.home.finish"),
			steps: [
				{
					anchor: ResearchOnboardingAnchor.HomeComposer,
					title: t("onboarding.home.composer.title"),
					text: t("onboarding.home.composer.text"),
				},
				{
					anchor: ResearchOnboardingAnchor.HomeSettings,
					title: t("onboarding.home.settings.title"),
					text: t("onboarding.home.settings.text"),
				},
				{
					anchor: ResearchOnboardingAnchor.HomeTemplates,
					placement: "top",
					title: t("onboarding.home.templates.title"),
					text: t("onboarding.home.templates.text"),
				},
				{
					anchor: ResearchOnboardingAnchor.HomePersonaLibrary,
					placement: "bottom-end",
					title: t("onboarding.home.library.title"),
					text: t("onboarding.home.library.text"),
				},
				{
					anchor: ResearchOnboardingAnchor.HomeStudies,
					placement: "top",
					title: t("onboarding.home.studies.title"),
					text: t("onboarding.home.studies.text"),
				},
			],
		}
	}

	return {
		finishLabel: t("onboarding.studio.finish"),
		steps: [
			{
				anchor: ResearchOnboardingAnchor.StudioProgress,
				placement: "bottom-start",
				title: t("onboarding.studio.progress.title"),
				text: t("onboarding.studio.progress.text"),
			},
			{
				anchor: ResearchOnboardingAnchor.StudioTabs,
				placement: "bottom-start",
				title: t("onboarding.studio.tabs.title"),
				text: t("onboarding.studio.tabs.text"),
			},
			{
				anchor: ResearchOnboardingAnchor.StudioValidation,
				title: t("onboarding.studio.validation.title"),
				text: t("onboarding.studio.validation.text"),
			},
			{
				anchor: ResearchOnboardingAnchor.StudioConversation,
				placement: "left",
				title: t("onboarding.studio.conversation.title"),
				text: t("onboarding.studio.conversation.text"),
			},
			{
				anchor: ResearchOnboardingAnchor.StudioRespondents,
				placement: "bottom-end",
				title: t("onboarding.studio.respondents.title"),
				text: t("onboarding.studio.respondents.text"),
			},
			{
				anchor: ResearchOnboardingAnchor.StudioShare,
				placement: "bottom-end",
				title: t("onboarding.studio.share.title"),
				text: t("onboarding.studio.share.text"),
			},
		],
	}
}
