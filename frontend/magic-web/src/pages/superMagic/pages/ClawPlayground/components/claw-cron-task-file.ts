import yaml from "js-yaml"
import dayjs from "@/lib/dayjs"
import { SuperMagicApi } from "@/apis"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import {
	downloadFileContent,
	getFileContentById,
	getTemporaryDownloadUrl,
} from "@/pages/superMagic/utils/api"
import {
	findAttachmentByRelativePath,
	findDirectoryIdByRelativePath,
	findDirectoryIdBySegmentWalk,
	normalizeRelativeFilePath,
} from "@/pages/superMagic/pages/SkillEdit/utils/skill-workspace-manifest"

export interface ClawCronIntervalParts {
	days: number
	hours: number
	minutes: number
}

export const CLAW_CRON_SCHEDULE_TYPE = {
	OneTime: "one-time",
	IntervalLoop: "interval-loop",
	Recurring: "recurring",
} as const

export type ClawCronScheduleType =
	(typeof CLAW_CRON_SCHEDULE_TYPE)[keyof typeof CLAW_CRON_SCHEDULE_TYPE]

export const CLAW_CRON_RECURRING_CYCLE = {
	Daily: "daily",
} as const

export type ClawCronRecurringCycle =
	(typeof CLAW_CRON_RECURRING_CYCLE)[keyof typeof CLAW_CRON_RECURRING_CYCLE]

export interface ClawCronTaskCandidateFile extends AttachmentItem {
	file_id: string
	relative_file_path?: string
	path?: string
	is_directory?: boolean
}

export interface ClawCronTaskDraft {
	taskName: string
	prompt: string
	enabled: boolean
	timezone: string
	startAt: string
	scheduleType: ClawCronScheduleType
	interval?: ClawCronIntervalParts | null
	recurringCycle?: ClawCronRecurringCycle | null
	recurringTime?: string | null
	endAt?: string | null
	agentCode?: string | null
	modelId?: string | null
	imageModelId?: string | null
}

export interface ClawCronTaskRecord extends ClawCronTaskDraft {
	fileId: string
	jobId: string
	relativePath: string
	content: string
	createdAt: string
	updatedAt?: string
}

interface BuildClawCronTaskMarkdownOptions {
	includeStartAt?: boolean
}

interface ClawCronFrontmatter {
	created_at?: string
	enabled?: boolean
	name?: string
	timezone?: string
	schedule?: {
		kind?: string
		at?: string
		expr?: string
		every_ms?: number
		tz?: string
		end_at?: string
		start_at?: string
	}
	payload?: {
		kind?: string
		model_id?: string
		image_model_id?: string
	}
}

interface ClawCronDocument {
	frontmatter: ClawCronFrontmatter
	bodyRaw: string
}

const CRON_ROOT_SEGMENTS = [".magic", "cron"] as const
const LEGACY_CRON_ROOT_SEGMENTS = [".workspace", ".magic", "cron"] as const
export const CLAW_CRON_ROOT_RELATIVE_PATH = CRON_ROOT_SEGMENTS.join("/")
export const CLAW_CRON_LEGACY_ROOT_RELATIVE_PATH = LEGACY_CRON_ROOT_SEGMENTS.join("/")
export const CLAW_CRON_FILE_SUFFIX = ".md"
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const MANAGED_SCHEDULE_KEYS = [
	"kind",
	"at",
	"expr",
	"every_ms",
	"tz",
	"end_at",
	"start_at",
] as const
const MANAGED_PAYLOAD_KEYS = ["kind", "model_id", "image_model_id"] as const
const clawCronTaskContentCache = new Map<string, { updatedAt?: string; content: string }>()

export function getDefaultClawCronTimezone() {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

export function toClawCronIsoString(value: string | Date | dayjs.Dayjs) {
	return dayjs(value).format("YYYY-MM-DDTHH:mm:ssZ")
}

export function createClawCronJobId(name: string) {
	const normalized = name
		.trim()
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")

	if (normalized) return normalized
	return `cron-${Date.now()}`
}

export function intervalPartsToMs(interval: ClawCronIntervalParts) {
	return (
		interval.days * 24 * 60 * 60 * 1000 +
		interval.hours * 60 * 60 * 1000 +
		interval.minutes * 60 * 1000
	)
}

export function intervalMsToParts(intervalMs: number): ClawCronIntervalParts {
	const roundedMinutes = Math.max(1, Math.ceil(intervalMs / (60 * 1000)))
	const days = Math.floor(roundedMinutes / (24 * 60))
	const daysRemainder = roundedMinutes % (24 * 60)
	const hours = Math.floor(daysRemainder / 60)
	const minutes = daysRemainder % 60

	return {
		days,
		hours,
		minutes,
	}
}

export function getDefaultClawCronScheduleType(): ClawCronScheduleType {
	return CLAW_CRON_SCHEDULE_TYPE.OneTime
}

export function getDefaultClawCronRecurringCycle(): ClawCronRecurringCycle {
	return CLAW_CRON_RECURRING_CYCLE.Daily
}

export function getClawCronTaskRelativePath(item: AttachmentItem) {
	return item.relative_file_path || item.path || ""
}

export function normalizeClawCronTaskRelativePath(path: string | undefined | null) {
	const normalizedPath = normalizeRelativeFilePath(path)
	if (!normalizedPath) return ""

	if (normalizedPath.startsWith(`${CLAW_CRON_LEGACY_ROOT_RELATIVE_PATH}/`)) {
		return normalizedPath.replace(
			`${CLAW_CRON_LEGACY_ROOT_RELATIVE_PATH}/`,
			`${CLAW_CRON_ROOT_RELATIVE_PATH}/`,
		)
	}

	return normalizedPath
}

function isClawCronTaskPath(path: string | undefined | null) {
	const normalizedPath = normalizeClawCronTaskRelativePath(path)
	if (!normalizedPath) return false
	if (!normalizedPath.endsWith(CLAW_CRON_FILE_SUFFIX)) return false
	if (normalizedPath.endsWith(".cron-state.json")) return false

	return (
		normalizedPath.startsWith(`${CLAW_CRON_ROOT_RELATIVE_PATH}/`) ||
		normalizedPath.includes(`/${CLAW_CRON_ROOT_RELATIVE_PATH}/`)
	)
}

export function isClawCronTaskFile(item: AttachmentItem): item is ClawCronTaskCandidateFile {
	if (!item.file_id || item.is_directory || item.type === "directory") return false

	const relativePath = getClawCronTaskRelativePath(item)
	return isClawCronTaskPath(relativePath)
}

export function getClawCronTaskCandidateFiles(attachments: AttachmentItem[]) {
	return attachments.filter(isClawCronTaskFile)
}

function getCachedClawCronTaskContent(fileId: string, updatedAt?: string) {
	const cached = clawCronTaskContentCache.get(fileId)
	if (!cached) return null
	if (updatedAt && cached.updatedAt && cached.updatedAt !== updatedAt) return null
	return cached.content
}

function setCachedClawCronTaskContent(fileId: string, content: string, updatedAt?: string) {
	if (!fileId) return
	clawCronTaskContentCache.set(fileId, {
		content,
		updatedAt,
	})
}

function deleteCachedClawCronTaskContent(fileId?: string | null) {
	if (!fileId) return
	clawCronTaskContentCache.delete(String(fileId))
}

function buildDailyCronExpression(time: string) {
	const [hours = "00", minutes = "00"] = time.split(":")
	return `${Number(minutes)} ${Number(hours)} * * *`
}

function parseDailyCronExpression(expr?: string | null) {
	if (!expr) return null

	const [minute, hour, dayOfMonth, month, dayOfWeek] = expr.trim().split(/\s+/)
	if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return null
	if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") return null

	return {
		cycle: CLAW_CRON_RECURRING_CYCLE.Daily,
		time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function omitManagedKeys(
	value: Record<string, unknown>,
	keys: readonly string[],
): Record<string, unknown> {
	return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))
}

function parseClawCronTaskDocument(content: string): ClawCronDocument | null {
	const match = content.match(FRONTMATTER_PATTERN)
	if (!match) return null

	const [, frontmatterRaw, bodyRaw] = match
	const parsedFrontmatter = yaml.load(frontmatterRaw)
	if (!isRecord(parsedFrontmatter)) return null

	return {
		frontmatter: parsedFrontmatter as ClawCronFrontmatter,
		bodyRaw,
	}
}

function buildClawCronSchedule(
	draft: ClawCronTaskDraft,
	options: BuildClawCronTaskMarkdownOptions = {},
	existingSchedule?: Record<string, unknown>,
) {
	const { includeStartAt = true } = options
	const scheduleBase = omitManagedKeys(existingSchedule || {}, MANAGED_SCHEDULE_KEYS)

	if (draft.scheduleType === CLAW_CRON_SCHEDULE_TYPE.OneTime) {
		return {
			...scheduleBase,
			kind: "at",
			at: draft.startAt,
			tz: draft.timezone,
		}
	}

	if (draft.scheduleType === CLAW_CRON_SCHEDULE_TYPE.Recurring) {
		const resolvedRecurringTime = draft.recurringTime || dayjs(draft.startAt).format("HH:mm")
		return {
			...scheduleBase,
			kind: "cron",
			expr:
				draft.recurringCycle === CLAW_CRON_RECURRING_CYCLE.Daily
					? buildDailyCronExpression(resolvedRecurringTime)
					: buildDailyCronExpression(resolvedRecurringTime),
			tz: draft.timezone,
			...(includeStartAt ? { start_at: draft.startAt } : {}),
			...(draft.endAt ? { end_at: draft.endAt } : {}),
		}
	}

	return {
		...scheduleBase,
		kind: "every",
		every_ms: intervalPartsToMs(
			draft.interval || {
				days: 0,
				hours: 0,
				minutes: 1,
			},
		),
		...(includeStartAt ? { start_at: draft.startAt } : {}),
		...(draft.endAt ? { end_at: draft.endAt } : {}),
	}
}

function buildClawCronPayload(draft: ClawCronTaskDraft, existingPayload?: Record<string, unknown>) {
	const payloadBase = omitManagedKeys(existingPayload || {}, MANAGED_PAYLOAD_KEYS)
	delete payloadBase.agent_name
	delete payloadBase.notify_main_agent

	const nextPayload: Record<string, unknown> = {
		...payloadBase,
		kind:
			typeof existingPayload?.kind === "string" && existingPayload.kind
				? existingPayload.kind
				: "agent_turn",
	}

	if (draft.modelId) {
		nextPayload.model_id = draft.modelId
	} else if (typeof existingPayload?.model_id === "string" && existingPayload.model_id) {
		nextPayload.model_id = existingPayload.model_id
	}

	if (draft.imageModelId) {
		nextPayload.image_model_id = draft.imageModelId
	} else if (
		typeof existingPayload?.image_model_id === "string" &&
		existingPayload.image_model_id
	) {
		nextPayload.image_model_id = existingPayload.image_model_id
	}

	return nextPayload
}

export function patchClawCronTaskMarkdown(params: {
	originalContent: string
	draft: ClawCronTaskDraft
	options?: BuildClawCronTaskMarkdownOptions
}) {
	const { originalContent, draft, options = {} } = params
	const parsedDocument = parseClawCronTaskDocument(originalContent)
	if (!parsedDocument) return buildClawCronTaskMarkdown(draft, options)

	const { frontmatter, bodyRaw } = parsedDocument
	const nextFrontmatter: ClawCronFrontmatter = {
		...frontmatter,
		enabled: draft.enabled,
		name: draft.taskName,
		timezone: draft.timezone,
		schedule: buildClawCronSchedule(
			draft,
			options,
			isRecord(frontmatter.schedule) ? frontmatter.schedule : undefined,
		),
		payload: buildClawCronPayload(
			draft,
			isRecord(frontmatter.payload) ? frontmatter.payload : undefined,
		),
	}
	if (!nextFrontmatter.created_at) nextFrontmatter.created_at = toClawCronIsoString(new Date())

	const nextBody = bodyRaw.trim() === draft.prompt.trim() ? bodyRaw : draft.prompt.trim()
	const frontmatterContent = yaml.dump(nextFrontmatter, {
		lineWidth: -1,
		noRefs: true,
		sortKeys: false,
	})
	const normalizedBody = nextBody.startsWith("\n") ? nextBody.slice(1) : nextBody

	return `---\n${frontmatterContent}---\n\n${normalizedBody}`
}

export function buildClawCronTaskMarkdown(
	{
		taskName,
		prompt,
		enabled,
		timezone,
		startAt,
		scheduleType,
		interval,
		recurringCycle,
		recurringTime,
		endAt,
		agentCode,
		modelId,
		imageModelId,
	}: ClawCronTaskDraft,
	options: BuildClawCronTaskMarkdownOptions = {},
) {
	const frontmatter = {
		created_at: toClawCronIsoString(new Date()),
		enabled,
		name: taskName,
		timezone,
		schedule: buildClawCronSchedule(
			{
				taskName,
				prompt,
				enabled,
				timezone,
				startAt,
				scheduleType,
				interval,
				recurringCycle,
				recurringTime,
				endAt,
				agentCode,
				modelId,
				imageModelId,
			},
			options,
		),
		payload: buildClawCronPayload({
			taskName,
			prompt,
			enabled,
			timezone,
			startAt,
			scheduleType,
			interval,
			recurringCycle,
			recurringTime,
			endAt,
			agentCode,
			modelId,
			imageModelId,
		}),
	}

	const frontmatterContent = yaml.dump(frontmatter, {
		lineWidth: -1,
		noRefs: true,
		sortKeys: false,
	})

	return `---\n${frontmatterContent}---\n\n${prompt.trim()}`
}

export function parseClawCronTaskMarkdown(params: {
	fileId: string
	relativePath: string
	content: string
	updatedAt?: string
}): ClawCronTaskRecord | null {
	const parsedDocument = parseClawCronTaskDocument(params.content)
	if (!parsedDocument) return null

	const { frontmatter, bodyRaw } = parsedDocument
	if (!frontmatter?.schedule?.kind) return null

	const fileName = params.relativePath.split("/").pop() || ""
	const jobId = fileName.replace(/\.md$/i, "")
	const scheduleKind = frontmatter.schedule.kind
	const createdAt = frontmatter.created_at || toClawCronIsoString(new Date())
	const resolvedTimezone =
		frontmatter.timezone || frontmatter.schedule.tz || getDefaultClawCronTimezone()
	const baseRecord = {
		fileId: params.fileId,
		jobId,
		relativePath: params.relativePath,
		content: params.content,
		createdAt,
		updatedAt: params.updatedAt,
		taskName: frontmatter.name || jobId,
		prompt: bodyRaw.trim(),
		enabled: Boolean(frontmatter.enabled),
		timezone: resolvedTimezone,
		agentCode: null,
		modelId: frontmatter.payload?.model_id || null,
		imageModelId: frontmatter.payload?.image_model_id || null,
	}

	if (scheduleKind === "at") {
		return {
			...baseRecord,
			scheduleType: CLAW_CRON_SCHEDULE_TYPE.OneTime,
			startAt: frontmatter.schedule.at || createdAt,
			interval: null,
			recurringCycle: null,
			recurringTime: null,
			endAt: null,
		}
	}

	if (scheduleKind === "every") {
		const intervalMs = Number(frontmatter.schedule.every_ms || 0)
		if (!intervalMs) return null

		return {
			...baseRecord,
			scheduleType: CLAW_CRON_SCHEDULE_TYPE.IntervalLoop,
			startAt: frontmatter.schedule.start_at || createdAt,
			interval: intervalMsToParts(intervalMs),
			recurringCycle: null,
			recurringTime: null,
			endAt: frontmatter.schedule.end_at || null,
		}
	}

	if (scheduleKind === "cron") {
		const parsedRecurringConfig = parseDailyCronExpression(frontmatter.schedule.expr)
		const resolvedStartAt = frontmatter.schedule.start_at || createdAt

		return {
			...baseRecord,
			scheduleType: CLAW_CRON_SCHEDULE_TYPE.Recurring,
			startAt: resolvedStartAt,
			interval: null,
			recurringCycle: parsedRecurringConfig?.cycle || getDefaultClawCronRecurringCycle(),
			recurringTime: parsedRecurringConfig?.time || dayjs(resolvedStartAt).format("HH:mm"),
			endAt: frontmatter.schedule.end_at || null,
		}
	}

	return null
}

async function getProjectAttachments(projectId: string) {
	const temporaryToken = (window as Window & { temporary_token?: string }).temporary_token || ""
	const response = await SuperMagicApi.getAttachmentsByProjectId({
		projectId,
		temporaryToken,
	})

	return AttachmentDataProcessor.processAttachmentData(response)
}

function parseClawCronTaskCandidateFileContent(params: {
	file: ClawCronTaskCandidateFile
	content: string
}) {
	const { file, content } = params
	return parseClawCronTaskMarkdown({
		fileId: String(file.file_id),
		relativePath: getClawCronTaskRelativePath(file),
		content,
		updatedAt: file.updated_at,
	})
}

async function getCurrentTaskContent(currentTask: ClawCronTaskRecord | null | undefined) {
	if (!currentTask?.fileId) return null

	const cachedContent = getCachedClawCronTaskContent(currentTask.fileId, currentTask.updatedAt)
	if (cachedContent) return cachedContent

	try {
		const content = await getFileContentById(String(currentTask.fileId), {
			responseType: "text",
		})
		const normalizedContent = String(content || currentTask.content || "")
		setCachedClawCronTaskContent(currentTask.fileId, normalizedContent, currentTask.updatedAt)
		return normalizedContent
	} catch (error) {
		console.error("Failed to load current claw cron task content:", error)
		return currentTask.content || null
	}
}

async function ensureFolderChain(
	projectId: string,
	fileTree: AttachmentItem[],
	fileList: AttachmentItem[],
) {
	let parentId: string | number = ""
	let cumulative = ""

	for (let index = 0; index < CRON_ROOT_SEGMENTS.length; index += 1) {
		const segment = CRON_ROOT_SEGMENTS[index]
		cumulative = index === 0 ? segment : `${cumulative}/${segment}`
		const pathSegments = CRON_ROOT_SEGMENTS.slice(0, index + 1)
		const existingId =
			findDirectoryIdByRelativePath(fileList, cumulative) ??
			findDirectoryIdBySegmentWalk(fileTree, pathSegments)

		if (existingId) {
			parentId = existingId
			continue
		}

		const folder = await SuperMagicApi.createFile({
			project_id: projectId,
			parent_id: parentId,
			file_name: segment,
			is_directory: true,
		})

		if (!folder?.file_id) throw new Error("createClawCronFolderFailed")
		parentId = folder.file_id
	}

	return String(parentId)
}

export async function loadClawCronTaskRecords(projectId: string) {
	const { list } = await getProjectAttachments(projectId)
	const cronFiles = getClawCronTaskCandidateFiles(list)
	const parsedTasks: Array<ClawCronTaskRecord | null> = []
	const filesToFetch: ClawCronTaskCandidateFile[] = []

	cronFiles.forEach((file) => {
		const fileId = String(file.file_id || "")
		const cachedContent = getCachedClawCronTaskContent(fileId, file.updated_at)
		if (!cachedContent) {
			filesToFetch.push(file)
			return
		}

		parsedTasks.push(
			parseClawCronTaskCandidateFileContent({
				file,
				content: cachedContent,
			}),
		)
	})

	if (filesToFetch.length) {
		const downloadUrls = await getTemporaryDownloadUrl({
			file_ids: filesToFetch.map((file) => String(file.file_id)),
		})
		const downloadUrlMap = new Map(
			downloadUrls.map((item) => [String(item.file_id), item.url] as const),
		)
		const fetchedTasks = await Promise.all(
			filesToFetch.map(async (file) => {
				const fileId = String(file.file_id || "")
				const downloadUrl = downloadUrlMap.get(fileId)
				if (!downloadUrl) return null

				try {
					const content = await downloadFileContent(downloadUrl, {
						responseType: "text",
					})
					const normalizedContent = String(content || "")
					setCachedClawCronTaskContent(fileId, normalizedContent, file.updated_at)
					return parseClawCronTaskCandidateFileContent({
						file,
						content: normalizedContent,
					})
				} catch (error) {
					console.error("Failed to load claw cron task content:", error)
					return null
				}
			}),
		)
		parsedTasks.push(...fetchedTasks)
	}

	return parsedTasks
		.filter((task): task is ClawCronTaskRecord => Boolean(task))
		.sort((left, right) => dayjs(right.createdAt).valueOf() - dayjs(left.createdAt).valueOf())
}

export async function saveClawCronTaskFile(params: {
	projectId: string
	draft: ClawCronTaskDraft
	currentTask?: ClawCronTaskRecord | null
}) {
	const { projectId, draft, currentTask } = params
	const attachments = await getProjectAttachments(projectId)
	const jobId = createClawCronJobId(draft.taskName)
	const fileName = `${jobId}.md`
	const relativePath = `${CLAW_CRON_ROOT_RELATIVE_PATH}/${fileName}`
	const normalizedCurrentRelativePath = normalizeClawCronTaskRelativePath(
		currentTask?.relativePath,
	)
	const isSameLogicalFile =
		Boolean(currentTask?.fileId) && normalizedCurrentRelativePath === relativePath
	const existingFile = findAttachmentByRelativePath(attachments.list, relativePath)
	const currentTaskContent = await getCurrentTaskContent(currentTask)
	let content: string
	if (currentTaskContent) {
		content = patchClawCronTaskMarkdown({
			originalContent: currentTaskContent,
			draft,
		})
	} else {
		content = buildClawCronTaskMarkdown(draft)
	}

	if (isSameLogicalFile && currentTask?.fileId) {
		await SuperMagicApi.saveFileContent([
			{
				file_id: currentTask.fileId,
				content,
			},
		])
		setCachedClawCronTaskContent(currentTask.fileId, content)

		return {
			fileId: currentTask.fileId,
			jobId,
			relativePath,
			content,
		}
	}

	if (existingFile?.file_id && existingFile.file_id !== currentTask?.fileId)
		throw new Error("clawCronTaskAlreadyExists")

	const parentId = await ensureFolderChain(projectId, attachments.tree, attachments.list)

	let nextFile = existingFile
	if (currentTask?.fileId && !isSameLogicalFile) {
		nextFile = await SuperMagicApi.createFile({
			project_id: projectId,
			parent_id: parentId,
			file_name: fileName,
			is_directory: false,
		})
	} else if (!existingFile?.file_id) {
		nextFile = await SuperMagicApi.createFile({
			project_id: projectId,
			parent_id: parentId,
			file_name: fileName,
			is_directory: false,
		})
	}

	if (!nextFile?.file_id) throw new Error("createClawCronTaskFileFailed")

	await SuperMagicApi.saveFileContent([
		{
			file_id: nextFile.file_id,
			content,
		},
	])
	setCachedClawCronTaskContent(String(nextFile.file_id), content)

	if (currentTask?.fileId && !isSameLogicalFile) {
		await SuperMagicApi.deleteFile(currentTask.fileId)
		deleteCachedClawCronTaskContent(currentTask.fileId)
	}

	return {
		fileId: String(nextFile.file_id),
		jobId,
		relativePath,
		content,
	}
}

export async function deleteClawCronTaskFile(fileId: string) {
	await SuperMagicApi.deleteFile(fileId)
	deleteCachedClawCronTaskContent(fileId)
}
