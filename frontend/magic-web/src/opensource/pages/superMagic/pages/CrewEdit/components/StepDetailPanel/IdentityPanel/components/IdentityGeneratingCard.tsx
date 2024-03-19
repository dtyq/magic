import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Globe, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/opensource/components/shadcn-ui/badge"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { useMemberDisplay } from "../../../../hooks/useMemberDisplay"
import type { CrewMemberData } from "../../../../store"
import { RoleIcon } from "../../../common/RoleIcon"
import { IdentityScanLine } from "./IdentityScanLine"

const LOG_DELAY_RANGE = {
	min: 720,
	max: 1880,
}

const BURST_DELAY_RANGE = {
	min: 260,
	max: 520,
}

const PAUSE_DELAY_RANGE = {
	min: 1800,
	max: 3200,
}

interface IdentityGeneratingCardProps {
	member: CrewMemberData
}

function getRandomInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickRandomValue<T>(values: T[]) {
	return values[getRandomInt(0, values.length - 1)]
}

function useInfiniteTypewriter({
	initialText,
	getNextLogLine,
	speed = 10,
}: {
	initialText: string
	getNextLogLine: () => string
	speed?: number
}) {
	const [displayedText, setDisplayText] = useState("")
	const [isInitialDone, setIsInitialDone] = useState(false)
	const indexRef = useRef(0)
	const burstCountRef = useRef(0)

	useEffect(() => {
		indexRef.current = 0
		burstCountRef.current = 0
		setDisplayText("")
		setIsInitialDone(false)
	}, [initialText])

	useEffect(() => {
		if (isInitialDone) return

		const timer = setInterval(() => {
			const currentIndex = indexRef.current
			const currentTarget = initialText

			if (currentIndex < currentTarget.length) {
				const step = 3
				indexRef.current = Math.min(currentIndex + step, currentTarget.length)
				setDisplayText(currentTarget.slice(0, indexRef.current))
			} else if (!isInitialDone) {
				setIsInitialDone(true)
			}
		}, speed)

		return () => clearInterval(timer)
	}, [initialText, speed, isInitialDone])

	useEffect(() => {
		if (!isInitialDone) return

		let timerId: ReturnType<typeof setTimeout> | undefined
		let isCancelled = false

		function scheduleNextLog() {
			const shouldBurst = burstCountRef.current > 0 || Math.random() < 0.12
			const shouldPause = !shouldBurst && Math.random() < 0.28
			const delay = shouldBurst
				? getRandomInt(BURST_DELAY_RANGE.min, BURST_DELAY_RANGE.max)
				: shouldPause
					? getRandomInt(PAUSE_DELAY_RANGE.min, PAUSE_DELAY_RANGE.max)
					: getRandomInt(LOG_DELAY_RANGE.min, LOG_DELAY_RANGE.max)

			if (shouldBurst && burstCountRef.current === 0) burstCountRef.current = 1

			timerId = setTimeout(() => {
				if (isCancelled) return

				const time = new Date().toLocaleTimeString("en-US", {
					hour12: false,
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				})

				if (burstCountRef.current > 0) burstCountRef.current -= 1

				setDisplayText((prev) => prev + `\n[${time}] ${getNextLogLine()}`)
				scheduleNextLog()
			}, delay)
		}

		scheduleNextLog()

		return () => {
			isCancelled = true
			if (timerId) clearTimeout(timerId)
		}
	}, [getNextLogLine, isInitialDone])

	return displayedText
}

function buildAsciiPreview({
	name,
	role,
	description,
	prompt,
	skills,
	t,
}: {
	name: string
	role: string
	description: string
	prompt: string
	skills: string[]
	t: (key: string, options?: Record<string, unknown>) => string
}) {
	const previewSkills = skills.length > 0 ? skills.join(" | ") : t("noSkills")

	return [
		`# ${t("card.generating.asciiTitle")}`,
		"",
		`## ${t("card.generating.asciiIdentity")}`,
		`name: ${name || t("untitledCrew")}`,
		`role: ${role || t("card.enterRole")}`,
		"",
		`## ${t("card.generating.asciiDescription")}`,
		description || t("noDescription"),
		"",
		`## ${t("card.generating.asciiSkills")}`,
		previewSkills,
		"",
		`## ${t("card.prompt")}`,
		prompt || t("card.generating.asciiPromptFallback"),
		"",
		`> ${t("card.generating.asciiStatus")}`,
	].join("\n")
}

export function IdentityGeneratingCard({ member }: IdentityGeneratingCardProps) {
	const { t } = useTranslation("crew/create")
	const { name, role, description, avatarUrl, prompt, skillName } = useMemberDisplay(member)
	const skillLabels = member.skills.map((skill) => skillName(skill))
	const logFields = useMemo(
		() => [
			t("card.generating.logFields.name"),
			t("card.generating.logFields.role"),
			t("card.generating.logFields.description"),
			t("card.generating.logFields.skills"),
			t("card.generating.logFields.prompt"),
		],
		[t],
	)
	const asciiPreview = useMemo(
		() =>
			buildAsciiPreview({
				name,
				role,
				description,
				prompt,
				skills: skillLabels,
				t,
			}),
		[description, name, prompt, role, skillLabels, t],
	)
	const getNextLogLine = useCallback(() => {
		const fallbackSkill = role || t("card.generating.defaultRole")
		const selectedSkill = pickRandomValue(
			skillLabels.length > 0 ? skillLabels : [fallbackSkill],
		)
		const selectedField = pickRandomValue(logFields)
		const progress = getRandomInt(72, 99)
		const logTemplates = [
			t("card.generating.logs.initializingNeuralNetworks"),
			t("card.generating.logs.loadingKnowledgeBase"),
			t("card.generating.logs.verifyingSecurityProtocols"),
			t("card.generating.logs.optimizingResponsePatterns"),
			t("card.generating.logs.calibratingPersonalityMatrix"),
			t("card.generating.logs.syncingContextMemory"),
			t("card.generating.logs.analyzingInputConstraints"),
			t("card.generating.logs.generatingBehavioralModel"),
			t("card.generating.logs.establishingCognitivePathways"),
			t("card.generating.logs.finalizingSystemCheck"),
			t("card.generating.logs.allocatingVirtualResources"),
			t("card.generating.logs.compilingIdentityTraits"),
			t("card.generating.logs.matchingSkill", { skill: selectedSkill }),
			t("card.generating.logs.lockingField", { field: selectedField }),
			t("card.generating.logs.scoringCandidate", { score: progress }),
			t("card.generating.logs.reconcilingPersona"),
			t("card.generating.logs.refiningResponseTone"),
			t("card.generating.logs.persistingCrewMemory"),
		]

		return pickRandomValue(logTemplates)
	}, [logFields, role, skillLabels, t])

	const typedAscii = useInfiniteTypewriter({
		initialText: asciiPreview,
		getNextLogLine,
		speed: 15,
	})
	const scrollContainerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const el = scrollContainerRef.current
		if (!el) return

		const frameId = requestAnimationFrame(() => {
			el.scrollTop = el.scrollHeight
		})

		return () => cancelAnimationFrame(frameId)
	}, [typedAscii])

	return (
		<div
			className="absolute bottom-0 left-1/2 h-[580px] w-[700px] -translate-x-1/2 overflow-hidden"
			data-testid="crew-identity-generating-preview"
		>
			<div className="absolute left-1/2 top-[238px] h-[380px] w-[400px] -translate-x-1/2 overflow-hidden">
				<div className="relative -top-[116px] flex h-[458px] w-[400px] flex-col gap-10 overflow-hidden rounded-3xl border border-border bg-white/30 px-4 pb-4 pt-12 backdrop-blur-2xl">
					<div className="absolute left-1/2 top-[19px] h-[10px] w-20 -translate-x-1/2 rounded-full bg-gradient-to-r from-black to-zinc-500" />
					<div
						ref={scrollContainerRef}
						className="absolute left-4 right-4 top-[110px] h-[332px] overflow-y-auto rounded-b-xl border border-ring bg-card p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					>
						<pre
							className="no-scrollbar whitespace-pre-wrap break-words font-['JetBrains_Mono:Regular',monospace] text-xs leading-[1.1] text-muted-foreground"
							data-testid="crew-identity-generating-ascii"
						>
							{typedAscii}
							<span className="animate-pulse font-bold text-foreground">_</span>
						</pre>
					</div>
				</div>
			</div>

			<div className="absolute left-[140px] top-[10px] h-[228px] w-[420px] overflow-hidden">
				<div className="absolute left-[10px] top-0 flex h-[564px] w-[400px] flex-col gap-2 overflow-hidden rounded-3xl border border-border bg-white/30 px-4 pb-4 pt-12 backdrop-blur-2xl">
					<div className="absolute left-1/2 top-[19px] h-[10px] w-[100px] -translate-x-1/2 rounded-full bg-black" />
					<div className="relative flex min-h-0 flex-1 flex-col gap-6 rounded-xl border border-ring bg-card px-4 py-6">
						<Button
							type="button"
							variant="outline"
							size="icon"
							className="absolute right-[9px] top-[9px] h-9 w-9 shadow-xs"
							disabled
							data-testid="crew-identity-generating-localize-button"
						>
							<Globe className="h-4 w-4" />
						</Button>

						<div className="flex flex-col items-center gap-2.5">
							<div className="group relative rounded-3xl border border-border bg-card p-3">
								<div className="h-[50px] w-[50px]">
									{avatarUrl ? (
										<img
											src={avatarUrl}
											alt={name}
											className="h-full w-full rounded-xl object-cover"
										/>
									) : (
										<div className="flex h-full w-full items-center justify-center">
											<RoleIcon className="h-[44px] w-[44px]" />
										</div>
									)}
								</div>
								<Button
									variant="outline"
									size="icon"
									className="absolute -bottom-[4px] -right-[4px] size-6 rounded-lg bg-background shadow-xs"
									disabled
									data-testid="crew-identity-generating-avatar-button"
								>
									<Upload className="h-4 w-4" />
								</Button>
							</div>

							<div className="w-full px-1 text-center text-2xl font-medium leading-tight text-foreground">
								{name || t("untitledCrew")}
							</div>

							<Badge className="max-w-full rounded-md px-2 text-xs font-semibold">
								<span className="truncate">
									{role || t("card.generating.defaultRole")}
								</span>
							</Badge>
						</div>

						<div className="flex flex-1 flex-col gap-6">
							<div className="flex flex-col items-center gap-2.5">
								<p className="w-full text-center text-[32px] font-medium text-foreground">
									{t("card.description")}
								</p>
								<p className="line-clamp-4 px-5 text-center text-sm leading-relaxed text-foreground">
									{description || t("noDescription")}
								</p>
							</div>
						</div>
					</div>

					<Button
						variant="outline"
						className="relative h-9 w-full shrink-0 overflow-hidden text-base font-medium shadow-xs"
						disabled
						data-testid="crew-identity-generating-prompt-button"
					>
						<span className="min-w-0 truncate">{t("card.prompt")}</span>
					</Button>
				</div>
			</div>

			<IdentityScanLine />
		</div>
	)
}
