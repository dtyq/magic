import { makeAutoObservable, observable, runInAction } from "mobx"
import { SuperMagicApi } from "@/apis"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import { ProjectFilesStore } from "@/stores/projectFiles"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import { getFileContentsByIds } from "@/pages/superMagic/utils/api"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { TaskStatus, WorkspaceStatus } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"
import {
	PANELS_DIR,
	PERSONAS_DIR,
	attachmentVersionKey,
	collectStudyAttachments,
	getAttachmentPath,
	indexStudyDirs,
	listLibraryFiles,
	listReportTemplates,
	listStudyFiles,
	parseDiscussionFile,
	parseSynthesisFile,
	parseValidationResultsFile,
	parseInterviewFile,
	parsePanelFile,
	parsePersonaFile,
	parseStudyFile,
	personaFilePath,
	type StudyAttachments,
} from "../services/researchFiles"
import { isLegacyTemplateChatName, templateChatTopicIds } from "../services/templateChats"
import type {
	DiscussionFile,
	InterviewFile,
	PanelFile,
	ParsedResearchFile,
	PersonaFile,
	ResearchFileRef,
	StudyFile,
	StudyPersonaPick,
	SynthesisFile,
	ValidationResultsFile,
} from "../types"

/** One special project per user holds every study (topic) and the shared persona library. */
export const PERSONA_RESEARCH_PROJECT_KEY = "persona_research"

export type ResearchStoreStatus = "idle" | "loading" | "ready" | "error"

/**
 * Library personas read for the home before the library page is opened: the avatars on the
 * library button (3) and the voice card (up to 4 quotable personas, some may have no line).
 */
const LIBRARY_PREVIEW_COUNT = 6
/** A file read that hangs must not keep the study on its loading skeleton forever. */
const FILE_READ_TIMEOUT_MS = 30_000

type FileParser = (raw: unknown) => ParsedResearchFile<unknown>

interface ParsedCacheEntry {
	versionKey: string
	/** Parsed JSON, or the raw string when it is not JSON (the parser reports invalid_json). */
	raw: unknown
	/** Schema result of `raw`, reused while the file version is unchanged. */
	parsed?: { parser: FileParser; result: ParsedResearchFile<unknown> }
	/** Ref handed to the UI; reusing it keeps unchanged files from re-rendering their rows. */
	ref?: ResearchFileRef<unknown>
}

/**
 * Page-level store shared by the research home, studio and persona library routes.
 * It lives in the parent route element, so switching between the three pages keeps the
 * conversation state (including optimistic messages sent from the home composer).
 */
export class PersonaResearchStore {
	status: ResearchStoreStatus = "idle"
	error: unknown = null
	selectedProject: ProjectListItem | null = null
	selectedWorkspace: Workspace | null = null
	attachments: AttachmentItem[] = []
	attachmentList: AttachmentItem[] = []
	isCreatingStudy = false
	isConversationGenerating = false

	/**
	 * Parsed personas, refreshed whenever attachments change. Until the library page asks for
	 * the whole library (`requestLibrary`) this holds only the home preview and the personas the
	 * selected study uses, so opening a study does not download every persona first.
	 */
	personas: ResearchFileRef<PersonaFile>[] = []
	/** Panels; read only once the library is requested. */
	panels: ResearchFileRef<PanelFile>[] = []
	study: StudyFile | null = null
	studyPanel: PanelFile | null = null
	interviews: ResearchFileRef<InterviewFile>[] = []
	discussions: ResearchFileRef<DiscussionFile>[] = []
	/** Theme coding and dimensions behind the analysis board; null before the report phase. */
	synthesis: SynthesisFile | null = null
	/** Real-person answers compared with the AI verdicts; null until the user uploads answers. */
	validationResults: ValidationResultsFile | null = null
	/** True when study.json exists but could not be parsed (half-written or wrong schema). */
	studyFileInvalid = false
	/** Bumped after each content reload so list rows re-read titles from the parse cache. */
	contentVersion = 0
	/**
	 * Personas picked in the library for the next study started on the home. A snapshot (name,
	 * path, demographics) because the home loads only a few library files. Kept until a study
	 * is sent, so a failed send keeps them.
	 */
	studyPersonaPicks: StudyPersonaPick[] = []
	/** Template conversations started in this page session, until their marker file arrives. */
	startedTemplateChatIds: string[] = []
	/** True once every study.json has been read, so list rows can show real statuses. */
	studyFilesReady = false
	/** Topic whose study files finished their first read; differs while a study is loading. */
	loadedStudyTopicId: string | null = null
	/** Share view: no composer, uploads or edits; files are read with the share token. */
	isReadOnly = false
	/** Credentials for reading file contents; undefined uses the signed-in session. */
	fileAccess: FileAccessContext | undefined = undefined

	/** Set by the persona library page; from then on every persona and panel is kept current. */
	libraryRequested = false
	/** The whole library has been read at least once since it was requested. */
	libraryLoaded = false

	private bootstrapGeneration = 0
	/** Bumped by dispose so a read still in flight never commits into a reset store. */
	private contentGeneration = 0
	/** The running content read; later reload requests wait for it and run once after it. */
	private reloadTask: Promise<void> | null = null
	private reloadDirty = false
	private readAbort: AbortController | null = null
	private readonly parsedCache = new Map<string, ParsedCacheEntry>()
	/** Topics whose name was already copied from study.json in this page session. */
	private readonly topicNameSyncs = new Set<string>()

	readonly topicStore = new TopicStore()
	readonly projectFilesStore = new ProjectFilesStore()
	readonly topicModelStore = createSuperMagicTopicModelStore()
	readonly mentionPanelStore = createMentionPanelStore(this.projectFilesStore)

	constructor() {
		makeAutoObservable<
			PersonaResearchStore,
			| "bootstrapGeneration"
			| "contentGeneration"
			| "reloadTask"
			| "reloadDirty"
			| "readAbort"
			| "parsedCache"
			| "topicNameSyncs"
		>(
			this,
			{
				// Attachment lists and parsed files are replaced as a whole, never mutated in
				// place. Deep observables would copy thousands of items on every file event and
				// make each read through a proxy (see AGENTS.md, 10k files baseline).
				attachments: observable.ref,
				attachmentList: observable.ref,
				personas: observable.ref,
				panels: observable.ref,
				study: observable.ref,
				studyPanel: observable.ref,
				interviews: observable.ref,
				discussions: observable.ref,
				synthesis: observable.ref,
				validationResults: observable.ref,
				bootstrapGeneration: false,
				contentGeneration: false,
				reloadTask: false,
				reloadDirty: false,
				readAbort: false,
				parsedCache: false,
				topicNameSyncs: false,
				topicStore: false,
				projectFilesStore: false,
				topicModelStore: false,
				mentionPanelStore: false,
			},
			{ autoBind: true },
		)
	}

	get selectedTopic() {
		return this.topicStore.selectedTopic
	}

	/** Study directory of the selected topic, e.g. "studies/ai-recorder-7f3a/". */
	get studyDir(): string | null {
		return this.studyDirOf(this.selectedTopic?.id)
	}

	/**
	 * The selected study's files have not been read yet. Status and progress derived from a
	 * missing study.json would read as "paused · 0/6", so pages show skeletons instead.
	 */
	get isStudyContentLoading(): boolean {
		const topicId = this.selectedTopic?.id
		return Boolean(topicId) && this.loadedStudyTopicId !== topicId
	}

	/** Report templates in the project, the default first. */
	get reportTemplates(): AttachmentItem[] {
		return listReportTemplates(this.attachmentList)
	}

	/** Project files by id, cached until the attachment list changes (never rebuilt per message). */
	get attachmentById(): ReadonlyMap<string, AttachmentItem> {
		return new Map(this.attachmentList.map((item) => [String(item.file_id), item]))
	}

	get studyAttachments(): StudyAttachments | null {
		const dir = this.studyDir
		return dir ? collectStudyAttachments(this.attachmentList, dir) : null
	}

	/**
	 * Report template conversations: never studies, listed only on the template library page.
	 * Marker files (template-chats/<topic_id>.json) plus ones started a moment ago.
	 */
	get templateChatTopicIds(): Set<string> {
		const ids = templateChatTopicIds(this.attachmentList)
		for (const id of this.startedTemplateChatIds) ids.add(id)
		return ids
	}

	markTemplateChat(topicId: string) {
		if (!this.startedTemplateChatIds.includes(topicId)) {
			this.startedTemplateChatIds = [...this.startedTemplateChatIds, topicId]
		}
	}

	/**
	 * Topics shown as studies. Blank topics (never sent, no study files) are hidden; the special
	 * project creates one by default and the home composer reuses it instead of creating more.
	 * Report template conversations are not studies and are left out too, including ones started
	 * before markers existed (no study directory, named after a report template).
	 */
	get studies(): Topic[] {
		const templateChats = this.templateChatTopicIds
		const isTemplateChat = (topic: Topic) =>
			templateChats.has(String(topic.id)) ||
			(!this.studyDirOf(topic.id) && isLegacyTemplateChatName(topic.topic_name))
		return this.topicStore.topics
			.filter((topic) => !this.isBlankTopic(topic) && !isTemplateChat(topic))
			.slice()
			.sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))
	}

	/**
	 * The topic name is the study title on every page (home list, studio, share, other topic
	 * lists) and the only one users rename. study.json's title covers a topic not named yet.
	 */
	studyTitleOf(topic: Topic): string {
		if (topic.topic_name) return topic.topic_name
		return this.studyFileOf(topic)?.title || ""
	}

	/** Title of the study stored in `dir` ("studies/<slug>"), for file lists; undefined if unknown. */
	studyTitleOfDir(dir: string): string | undefined {
		const prefix = dir.replace(/\/+$/, "")
		const topic = this.topicStore.topics.find((item) => {
			const studyDir = this.studyDirOf(item.id)
			return studyDir !== null && studyDir.replace(/\/+$/, "") === prefix
		})
		return topic ? this.studyTitleOf(topic) || undefined : undefined
	}

	/** Renames a study through its topic name. */
	async renameStudy(topicId: string, name: string): Promise<void> {
		const topicName = name.trim()
		const projectId = this.selectedProject?.id
		if (!topicName || !projectId || this.isReadOnly) return
		const topic = this.topicStore.topics.find((item) => item.id === topicId)
		if (topic?.topic_name === topicName) return
		await SuperMagicApi.editTopic({ id: topicId, topic_name: topicName, project_id: projectId })
		runInAction(() => {
			this.topicStore.updateTopicName(topicId, topicName)
		})
	}

	/** Parsed study.json of any topic, for list rows; null until it has been read. */
	studyFileOf(topic: Topic): StudyFile | null {
		const dir = this.studyDirOf(topic.id)
		return dir ? this.peekStudy(`${dir}study.json`) : null
	}

	/** Why the study picked this persona (study panel.json selection), if recorded. */
	selectionReasonOf(personaId: string): string | undefined {
		return this.studyPanel?.selection?.find((item) => item.persona_id === personaId)?.reason
	}

	/** Persona files behind the current study's panel, for the files tab. */
	get studyPersonaFiles(): AttachmentItem[] {
		const ids = new Set(this.studyPersonas.map((persona) => persona.id))
		const fileIds = new Set(
			this.personas.filter((ref) => ids.has(ref.data.id)).map((ref) => ref.fileId),
		)
		return this.attachmentList.filter((item) => fileIds.has(String(item.file_id)))
	}

	/** Persona files in the library, whether or not their content has been read. */
	get personaFiles(): AttachmentItem[] {
		return listLibraryFiles(this.attachmentList, PERSONAS_DIR)
	}

	/** Library counts come from the file list, so they are right before the library is read. */
	get personaFileCount(): number {
		return this.personaFiles.length
	}

	get panelFileCount(): number {
		return listLibraryFiles(this.attachmentList, PANELS_DIR).length
	}

	/** Persona refs by id; transcripts and quotes resolve names here once per quote. */
	private get personaRefIndex(): Map<string, ResearchFileRef<PersonaFile>> {
		return new Map(this.personas.map((ref) => [ref.data.id, ref]))
	}

	/** Study directory per topic, rebuilt once per attachment or study.json change. */
	private get studyDirByTopicId(): Map<string, string> {
		void this.contentVersion
		return indexStudyDirs(this.attachmentList, this.studyTopicIdOf)
	}

	personaById(personaId: string): PersonaFile | null {
		return this.personaRefIndex.get(personaId)?.data ?? null
	}

	/** Personas used by the current study, in panel order; falls back to interviewed personas. */
	get studyPersonas(): PersonaFile[] {
		const ids =
			this.studyPanel?.persona_ids ?? this.interviews.map((ref) => ref.data.persona_id)
		return ids
			.map((id) => this.personaById(id))
			.filter((persona): persona is PersonaFile => persona !== null)
	}

	async bootstrap(): Promise<void> {
		const generation = ++this.bootstrapGeneration
		this.status = "loading"
		this.error = null
		try {
			const [{ project }] = await Promise.all([
				SuperMagicApi.getSpecialProject({
					key: PERSONA_RESEARCH_PROJECT_KEY,
					project_mode: TopicMode.PersonaResearch,
					topic_mode: TopicMode.PersonaResearch,
				}),
				// Research topics are an internal mode without a mode-list entry; the model picker
				// uses the default mode catalog, the same way micro-app topics do.
				superMagicModeService.fetchDefaultModeModelList(),
			])
			if (generation !== this.bootstrapGeneration) return
			if (!project?.id) throw new Error("persona-research-missing-project")

			this.mentionPanelStore.initLoadAttachments(project.id)
			try {
				const [detail, topicsResponse, attachmentsResponse] = await Promise.all([
					SuperMagicApi.getProjectDetail({ id: project.id }),
					SuperMagicApi.getTopicsByProjectId({ id: project.id, page: 1, page_size: 999 }),
					SuperMagicApi.getAttachmentsByProjectId({
						projectId: project.id,
						temporaryToken: "",
					}),
				])
				if (generation !== this.bootstrapGeneration) return
				const processed = AttachmentDataProcessor.processAttachmentData(attachmentsResponse)
				const topics = Array.isArray(topicsResponse?.list) ? topicsResponse.list : []
				runInAction(() => {
					const resolvedProject = detail?.id ? detail : project
					this.selectedProject = resolvedProject
					this.selectedWorkspace = this.createWorkspaceFromProject(resolvedProject)
					this.projectFilesStore.setSelectedProject(resolvedProject)
					this.topicStore.setTopics(topics.map(withResearchTopicFields))
					this.applyAttachments(processed.tree, processed.list)
					this.status = "ready"
				})
			} finally {
				this.mentionPanelStore.finishLoadAttachmentsPromise(project.id)
			}
			await this.reloadParsedContent()
		} catch (error) {
			if (generation !== this.bootstrapGeneration) return
			runInAction(() => {
				this.status = "error"
				this.error = error
			})
		}
	}

	/**
	 * Read-only study opened from a share link: one topic, the project files the share exposes,
	 * and the share token for reading contents. Parsing and topic matching are the same as in app.
	 */
	initShare({
		topic,
		project,
		tree,
		list,
		access,
	}: {
		topic: Topic
		project: ProjectListItem
		tree: AttachmentItem[]
		list: AttachmentItem[]
		access: FileAccessContext
	}) {
		this.isReadOnly = true
		this.fileAccess = access
		this.selectedProject = project
		const sharedTopic = withResearchTopicFields(topic)
		this.topicStore.setTopics([sharedTopic])
		this.topicStore.setSelectedTopic(sharedTopic)
		const processed = AttachmentDataProcessor.processAttachmentData({ tree, list })
		this.applyAttachments(processed.tree, processed.list)
		this.status = "ready"
		void this.reloadParsedContent()
	}

	/** Selects the study for a route param; unknown ids leave the selection empty. */
	selectStudy(topicId: string | undefined) {
		const topic = topicId
			? (this.topicStore.topics.find((item) => item.id === topicId) ?? null)
			: null
		if (this.topicStore.selectedTopic?.id === topic?.id) return
		this.topicStore.setSelectedTopic(topic)
		void this.reloadParsedContent()
	}

	/**
	 * Returns a topic for a new study: reuses the blank default topic when present,
	 * otherwise creates one. The caller sends the first message into it.
	 */
	async prepareStudyTopic(): Promise<Topic | null> {
		const projectId = this.selectedProject?.id
		if (!projectId || this.isCreatingStudy) return null
		const blank = this.topicStore.topics.find((topic) => this.isBlankTopic(topic))
		if (blank) return blank

		this.isCreatingStudy = true
		try {
			const created = await SuperMagicApi.createTopic({
				project_id: projectId,
				topic_name: "",
				project_mode: TopicMode.PersonaResearch,
			})
			if (!created?.id) return null
			const topic = withResearchTopicFields(created as Topic)
			runInAction(() => {
				this.topicStore.setTopics([topic, ...this.topicStore.topics])
			})
			return topic
		} finally {
			runInAction(() => {
				this.isCreatingStudy = false
			})
		}
	}

	/** Deletes the topic and its study directory; persona library files are kept. */
	async deleteStudy(topicId: string): Promise<void> {
		const dir = this.studyDirOf(topicId)
		const fileIds = dir ? this.collectDirectoryFileIds(dir) : []
		await SuperMagicApi.deleteTopic({ id: topicId })
		if (fileIds.length > 0 && this.selectedProject?.id) {
			await SuperMagicApi.deleteFiles({
				file_ids: fileIds,
				project_id: this.selectedProject.id,
			})
		}
		runInAction(() => {
			this.topicStore.removeTopic(topicId)
			if (fileIds.length > 0) {
				const removed = new Set(fileIds)
				this.applyAttachments(
					this.attachments,
					this.attachmentList.filter((item) => !removed.has(String(item.file_id))),
				)
			}
		})
	}

	/** Called by realtime file events and polling with the latest raw project attachments. */
	setAttachments(tree: AttachmentItem[], list: AttachmentItem[]) {
		const processed = AttachmentDataProcessor.processAttachmentData({ tree, list })
		this.applyAttachments(processed.tree, processed.list)
		void this.reloadParsedContent()
	}

	/** Drops deleted files from the lists at once instead of waiting for the next file event. */
	removeAttachmentsLocally(fileIds: string[]) {
		const removed = new Set(fileIds)
		this.applyAttachments(
			this.attachments,
			this.attachmentList.filter((item) => !removed.has(String(item.file_id))),
		)
		void this.reloadParsedContent()
	}

	personaRefById(personaId: string): ResearchFileRef<PersonaFile> | null {
		return this.personaRefIndex.get(personaId) ?? null
	}

	/** Called by the persona library page: read every persona and panel from now on. */
	requestLibrary() {
		if (this.libraryRequested) return
		this.libraryRequested = true
		void this.reloadParsedContent()
	}

	/** Re-reads attachments from the server; used after page visibility returns. */
	async refreshAttachments(): Promise<void> {
		const projectId = this.selectedProject?.id
		if (!projectId) return
		const response = await SuperMagicApi.getAttachmentsByProjectId({
			projectId,
			temporaryToken: "",
		})
		if (this.selectedProject?.id !== projectId) return
		this.setAttachments(response?.tree ?? [], response?.list ?? [])
	}

	async refreshTopics(): Promise<void> {
		const projectId = this.selectedProject?.id
		if (!projectId) return
		const response = await SuperMagicApi.getTopicsByProjectId({
			id: projectId,
			page: 1,
			page_size: 999,
		})
		if (this.selectedProject?.id !== projectId) return
		const topics = Array.isArray(response?.list) ? response.list : []
		runInAction(() => {
			const selectedId = this.topicStore.selectedTopic?.id
			this.topicStore.setTopics(topics.map(withResearchTopicFields))
			if (selectedId) {
				this.topicStore.setSelectedTopic(
					this.topicStore.topics.find((topic) => topic.id === selectedId) ?? null,
				)
			}
		})
	}

	setSelectedTopic(topic: Topic | null) {
		this.topicStore.setSelectedTopic(topic ? withResearchTopicFields(topic) : null)
		void this.reloadParsedContent()
	}

	setSelectedProject(project: ProjectListItem | null) {
		this.selectedProject = project
		this.projectFilesStore.setSelectedProject(project)
	}

	setSelectedWorkspace(workspace: Workspace | null) {
		this.selectedWorkspace = workspace
	}

	/** Adds personas to the picks for the next study; ones already picked stay where they are. */
	addStudyPersonaPicks(picks: StudyPersonaPick[]) {
		const known = new Set(this.studyPersonaPicks.map((pick) => pick.id))
		this.studyPersonaPicks = [
			...this.studyPersonaPicks,
			...picks.filter((pick) => !known.has(pick.id)),
		]
	}

	removeStudyPersonaPick(personaId: string) {
		this.studyPersonaPicks = this.studyPersonaPicks.filter((pick) => pick.id !== personaId)
	}

	clearStudyPersonaPicks() {
		this.studyPersonaPicks = []
	}

	setConversationGenerating(isGenerating: boolean) {
		this.isConversationGenerating = isGenerating
	}

	updateTopicStatus(topicId: string, status: TaskStatus) {
		this.topicStore.updateTopicStatus(topicId, status)
	}

	dispose() {
		this.bootstrapGeneration += 1
		this.contentGeneration += 1
		this.readAbort?.abort()
		this.readAbort = null
		this.reloadDirty = false
		this.parsedCache.clear()
		this.topicNameSyncs.clear()
		this.studyFilesReady = false
		this.loadedStudyTopicId = null
		this.libraryRequested = false
		this.libraryLoaded = false
		this.topicStore.reset()
		this.projectFilesStore.setSelectedProject(null)
		this.projectFilesStore.setWorkspaceFileTree([])
		this.topicModelStore.reset()
	}

	/**
	 * Reads what the open page needs, reusing parsed files whose attachment version is
	 * unchanged. A request that arrives during a read is merged into one more read after it, so
	 * a burst of file events cannot starve the read a loading page is waiting for.
	 *
	 * | Stage | Files                                                                         |
	 * | 1     | every study.json (topic → directory, list rows), the home persona preview;   |
	 * |       | the whole persona and panel library once the library page asked for it      |
	 * | 2     | the selected study's files                                                    |
	 * | 3     | the personas that study uses, e.g. personas/p_chen_1a2b.json                  |
	 *
	 * Already-rendered data is kept until the new read is committed.
	 */
	reloadParsedContent(): Promise<void> {
		this.reloadDirty = true
		if (!this.reloadTask) {
			this.reloadTask = this.drainReloads().finally(() => {
				this.reloadTask = null
				// A request that came in after the last loop check still needs its read.
				if (this.reloadDirty) void this.reloadParsedContent()
			})
		}
		return this.reloadTask
	}

	private async drainReloads() {
		const generation = this.contentGeneration
		while (this.reloadDirty && generation === this.contentGeneration) {
			this.reloadDirty = false
			await this.readContent(generation)
		}
	}

	private async readContent(generation: number) {
		const controller = new AbortController()
		this.readAbort = controller
		// Aborting only fails the downloads still pending; the read then commits what it has, so
		// a hung request ends the loading state instead of keeping the skeleton up forever.
		const timer = setTimeout(() => controller.abort(), FILE_READ_TIMEOUT_MS)
		const isCurrent = () => generation === this.contentGeneration
		try {
			const libraryRequested = this.libraryRequested
			const personaFiles = this.personaFiles
			const panelItems = libraryRequested
				? listLibraryFiles(this.attachmentList, PANELS_DIR)
				: []
			await this.ensureParsed(
				[
					...listStudyFiles(this.attachmentList),
					...(libraryRequested
						? personaFiles
						: personaFiles.slice(0, LIBRARY_PREVIEW_COUNT)),
					...panelItems,
				],
				controller.signal,
			)
			if (!isCurrent()) return
			// parsedCache is not observable: bump the version so the topic → directory index
			// re-reads the topic_id values that were just parsed.
			runInAction(() => {
				this.contentVersion += 1
			})
			this.syncTopicNamesFromStudies()

			const topicId = this.selectedTopic?.id ?? null
			const study = this.studyAttachments
			await this.ensureParsed(studyFileItems(study), controller.signal)
			if (!isCurrent()) return

			const personaItems = libraryRequested
				? personaFiles
				: this.studyPersonaItems(study, personaFiles)
			await this.ensureParsed(personaItems, controller.signal)
			if (!isCurrent()) return

			runInAction(() => {
				this.personas = this.collectRefs(personaItems, parsePersonaFile, this.personas)
				if (libraryRequested) {
					this.panels = this.collectRefs(panelItems, parsePanelFile, this.panels)
					this.libraryLoaded = true
				}
				this.studyFilesReady = true
				this.contentVersion += 1
				// The user opened another study during the read; the queued read loads that one.
				// Committing now would show this study's files under the other study's title.
				if ((this.selectedTopic?.id ?? null) !== topicId) return
				this.commitStudy(study)
				this.loadedStudyTopicId = topicId
			})
		} finally {
			clearTimeout(timer)
			if (this.readAbort === controller) this.readAbort = null
		}
	}

	/** Copies the selected study's parsed files into the observable fields. */
	private commitStudy(study: StudyAttachments | null) {
		const studyResult = study?.study ? this.getParsed(study.study, parseStudyFile) : null
		this.study = studyResult?.ok ? studyResult.data : null
		this.studyFileInvalid = Boolean(studyResult && !studyResult.ok)
		const panelResult = study?.panel ? this.getParsed(study.panel, parsePanelFile) : null
		this.studyPanel = panelResult?.ok ? panelResult.data : null
		this.interviews = this.collectRefs(
			study?.interviews ?? [],
			parseInterviewFile,
			this.interviews,
		)
		this.discussions = this.collectRefs(
			study?.discussions ?? [],
			parseDiscussionFile,
			this.discussions,
		)
		const synthesisResult = study?.synthesis
			? this.getParsed(study.synthesis, parseSynthesisFile)
			: null
		this.synthesis = synthesisResult?.ok ? synthesisResult.data : null
		const validationResult = study?.validationResults
			? this.getParsed(study.validationResults, parseValidationResultsFile)
			: null
		this.validationResults = validationResult?.ok ? validationResult.data : null
	}

	/**
	 * The home preview personas plus the ones the study uses (panel, interviews, discussion
	 * participants), found by their contract path. A persona deleted from the library simply
	 * stays unresolved, as it did when the whole library was read.
	 * Example: panel ["p_chen_1a2b"] → the preview files + personas/p_chen_1a2b.json.
	 */
	private studyPersonaItems(
		study: StudyAttachments | null,
		personaFiles: AttachmentItem[],
	): AttachmentItem[] {
		const wanted = new Set(personaFiles.slice(0, LIBRARY_PREVIEW_COUNT).map(getAttachmentPath))
		const add = (personaId: string) => wanted.add(personaFilePath(personaId))
		const panel = study?.panel ? this.getParsed(study.panel, parsePanelFile) : null
		if (panel?.ok) panel.data.persona_ids.forEach(add)
		for (const item of study?.interviews ?? []) {
			const parsed = this.getParsed(item, parseInterviewFile)
			if (parsed?.ok) add(parsed.data.persona_id)
		}
		for (const item of study?.discussions ?? []) {
			const parsed = this.getParsed(item, parseDiscussionFile)
			if (parsed?.ok) parsed.data.participants.forEach(add)
		}
		return personaFiles.filter((item) => wanted.has(getAttachmentPath(item)))
	}

	/**
	 * Copies the agent's first study title into topics that have no name, so new studies get a
	 * readable name everywhere. Runs once per topic; a user rename always wins because only empty
	 * names are filled. Example: topic "" + study.json title "AI 录音硬件" → topic "AI 录音硬件".
	 */
	private syncTopicNamesFromStudies() {
		if (this.isReadOnly || isReadOnlyProject(this.selectedProject?.user_role)) return
		for (const topic of this.topicStore.topics) {
			if (topic.topic_name || this.topicNameSyncs.has(topic.id)) continue
			const title = this.studyFileOf(topic)?.title?.trim()
			if (!title) continue
			this.topicNameSyncs.add(topic.id)
			void this.renameStudy(topic.id, title).catch((error: unknown) => {
				console.error("Failed to name research topic from study.json:", error)
			})
		}
	}

	private async ensureParsed(items: AttachmentItem[], signal?: AbortSignal) {
		const stale = items.filter(
			(item) =>
				this.parsedCache.get(getAttachmentPath(item))?.versionKey !==
				attachmentVersionKey(item),
		)
		if (stale.length === 0) return
		const ids = stale.map((item) => String(item.file_id))
		// forceRefresh: the agent overwrites these files in place; never serve a stale copy.
		// Only files whose version changed get here, so unchanged files are never re-downloaded.
		const { successes } = await getFileContentsByIds(ids, {
			responseType: "text",
			forceRefresh: true,
			access: this.fileAccess,
			signal,
		})
		for (const item of stale) {
			const content = successes.get(String(item.file_id))
			// A failed download keeps the previous version, which retries on the next read.
			if (typeof content !== "string") continue
			let raw: unknown = content
			try {
				raw = JSON.parse(content)
			} catch {
				// Keep the raw string; the parser reports invalid_json.
			}
			this.parsedCache.set(getAttachmentPath(item), {
				versionKey: attachmentVersionKey(item),
				raw,
			})
		}
	}

	private getParsed<T>(
		item: AttachmentItem,
		parser: (raw: unknown) => ParsedResearchFile<T>,
	): ParsedResearchFile<T> | null {
		const cached = this.parsedCache.get(getAttachmentPath(item))
		return cached ? parseEntry(cached, parser) : null
	}

	/** Study directory of a topic, matched through the topic_id recorded in each study.json. */
	private studyDirOf(topicId: string | undefined): string | null {
		return topicId ? (this.studyDirByTopicId.get(String(topicId)) ?? null) : null
	}

	private studyTopicIdOf(item: AttachmentItem): string | undefined {
		const raw = this.parsedCache.get(getAttachmentPath(item))?.raw
		const topicId =
			raw && typeof raw === "object" ? (raw as { topic_id?: unknown }).topic_id : null
		return typeof topicId === "string" || typeof topicId === "number"
			? String(topicId)
			: undefined
	}

	/** Reads an already-fetched study.json for list rows; never triggers a request. */
	private peekStudy(path: string): StudyFile | null {
		void this.contentVersion
		const cached = this.parsedCache.get(path)
		if (!cached) return null
		const parsed = parseEntry(cached, parseStudyFile)
		return parsed.ok ? parsed.data : null
	}

	/**
	 * Refs of the parsed files, reusing the ref of every unchanged file. When nothing changed
	 * the previous array is returned, so a file event elsewhere does not re-render these lists.
	 */
	private collectRefs<T>(
		items: AttachmentItem[],
		parser: (raw: unknown) => ParsedResearchFile<T>,
		previous: ResearchFileRef<T>[],
	): ResearchFileRef<T>[] {
		const refs = items.flatMap((item) => {
			const path = getAttachmentPath(item)
			const cached = this.parsedCache.get(path)
			if (!cached) return []
			const parsed = parseEntry(cached, parser)
			if (!parsed.ok) return []
			const fileId = String(item.file_id)
			const ref = cached.ref as ResearchFileRef<T> | undefined
			if (ref && ref.data === parsed.data && ref.fileId === fileId && ref.path === path) {
				return [ref]
			}
			const next: ResearchFileRef<T> = { fileId, path, data: parsed.data }
			cached.ref = next
			return [next]
		})
		const unchanged =
			refs.length === previous.length && refs.every((ref, index) => ref === previous[index])
		return unchanged ? previous : refs
	}

	private collectDirectoryFileIds(dir: string): string[] {
		const dirPath = dir.replace(/\/$/, "")
		return this.attachmentList
			.filter((item) => {
				const path = getAttachmentPath(item)
				return path === dirPath || path.startsWith(dir)
			})
			.map((item) => String(item.file_id ?? ""))
			.filter(Boolean)
	}

	private isBlankTopic(topic: Topic): boolean {
		const neverRan = !topic.task_status || topic.task_status === TaskStatus.WAITING
		return neverRan && !topic.topic_name && !this.studyDirOf(topic.id)
	}

	private applyAttachments(tree: AttachmentItem[], list: AttachmentItem[]) {
		this.attachments = tree
		this.attachmentList = list
		this.projectFilesStore.setWorkspaceFileTree(tree)
		this.projectFilesStore.workspaceFilesList = list
	}

	private createWorkspaceFromProject(project: ProjectListItem): Workspace {
		return {
			id: project.workspace_id,
			name: project.workspace_name,
			is_archived: 0,
			current_topic_id: project.current_topic_id,
			current_project_id: project.id,
			workspace_status: WorkspaceStatus.FINISHED,
			project_count: 1,
			// The special project lives in a hidden user workspace; "default" keeps shared send
			// and file flows on their normal (non-chat, non-micro-app) path.
			workspace_type: "default",
		}
	}
}

/** Research topics always run the persona-research agent, whatever the server echoes back. */
export function withResearchTopicFields(topic: Topic): Topic {
	return { ...topic, topic_mode: TopicMode.PersonaResearch }
}

/** Contract files of the selected study that the store parses (documents load in their panes). */
function studyFileItems(study: StudyAttachments | null): AttachmentItem[] {
	if (!study) return []
	return [
		study.study,
		study.panel,
		study.synthesis,
		study.validationResults,
		...study.interviews,
		...study.discussions,
	].filter((item): item is AttachmentItem => item !== null)
}

/** Schema result of a cached file, computed once per file version and parser. */
function parseEntry<T>(
	entry: ParsedCacheEntry,
	parser: (raw: unknown) => ParsedResearchFile<T>,
): ParsedResearchFile<T> {
	let parsed = entry.parsed
	if (!parsed || parsed.parser !== parser) {
		parsed = { parser: parser as FileParser, result: parser(entry.raw) }
		entry.parsed = parsed
	}
	return parsed.result as ParsedResearchFile<T>
}
