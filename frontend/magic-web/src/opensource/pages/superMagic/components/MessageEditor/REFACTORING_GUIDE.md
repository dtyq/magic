# MessageEditor 重构指南

## 一、现有功能的状态（State）和操作（Action）分析

### 1. **富文本编辑功能**

#### State

```typescript
{
	value: JSONContent | undefined // 编辑器内容
	tiptapEditor: Editor | null // TipTap 编辑器实例
	isComposing: boolean // 中文输入法状态
	isOAuthInProgress: boolean // OAuth 进行中
	placeholder: string // 占位符文本
}
```

#### Actions

- `setValue(content: JSONContent)`
- `updateContent(content: JSONContent)`
- `clearContent()`
- `focus(options?: FocusOptions)`
- `handleCompositionStart()`
- `handleCompositionEnd()`

---

### 2. **Mention 系统**

#### State

```typescript
{
  mentionItems: MentionListItem[]           // Mention 项列表
  editor: Editor | null                     // 编辑器实例引用
}
```

#### Actions

- `insertMentionItem(item: TiptapMentionAttributes)`
- `insertMentionItems(items: TiptapMentionAttributes[])`
- `removeMentionItem(item: TiptapMentionAttributes)`
- `removeMentionItems(items: TiptapMentionAttributes[])`
- `updateMentionAttributes(markerId: string, data: Partial<Data>)`
- `batchUpdateMentionAttributes(updates: Array<{markerId, data}>)`
- `restoreMentionItems(items: MentionListItem[])`
- `clearAllMentions()`

---

### 3. **文件上传管理**

#### State

```typescript
{
  files: UploadFile[]                       // 文件列表
  uploadProgress: Map<string, number>       // 上传进度 fileId -> progress
  uploadErrors: Map<string, string>         // 上传错误 fileId -> error
  maxUploadCount: number                    // 最大上传数量
  maxUploadSize: number                     // 最大文件大小
  isAllFilesUploaded: boolean              // 是否所有文件已上传
}

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  uploadedFileId?: string                  // 上传成功后的文件ID
}
```

#### Actions

- `addFiles(files: File[])`
- `removeFile(fileId: string)`
- `removeUploadedFile(fileId: string)`
- `clearFiles()`
- `validateFileSize(file: File): boolean`
- `validateFileCount(count: number): boolean`
- `updateFileProgress(fileId: string, progress: number)`
- `handleRetry(fileId: string)`
- `addFilesWithDir(files: File[], dirPath?: string)`

---

### 4. **草稿系统**

#### State

```typescript
{
  currentDraft: DraftData | null           // 当前草稿
  draftVersions: DraftVersion[]            // 草稿版本列表
  isDraftReady: boolean                    // 草稿加载就绪
  isSending: boolean                       // 发送中状态
  draftSaveQueue: DraftSaveTask[]         // 草稿保存队列（防抖）

  // 草稿关联信息
  topicId: string
  projectId: string
  workspaceId: string
}

interface DraftData {
  id: string
  value: JSONContent | undefined
  mentionItems: MentionListItem[]
  createdAt: number
  updatedAt: number
}

interface DraftVersion {
  id: string
  timestamp: number
  preview: string
  type: 'auto' | 'manual' | 'sent'
}
```

#### Actions

- `saveDraft(data: SaveDraftParams)`
- `loadDraft(draftId: string)`
- `loadLatestDraft()`
- `createSentDraft(data: DraftData)`
- `loadDraftVersions()`
- `useDraft(draftId: string)`
- `deleteDraft(draftId: string)`
- `clearCurrentDraft()`

---

### 5. **语音输入**

#### State

```typescript
{
	isRecording: boolean // 是否正在录音
	recordingDuration: number // 录音时长
	audioBlob: Blob | null // 音频数据
	transcriptText: string // 转录文本
	voiceInputError: string | null // 错误信息
}
```

#### Actions

- `startRecording()`
- `stopRecording()`
- `cancelRecording()`
- `handleVoiceTranscript(text: string)`

---

### 6. **AI 自动补全**

#### State

```typescript
{
	isAiCompletionEnabled: boolean // 是否启用
	completionSuggestion: string | null // 补全建议
	isLoadingCompletion: boolean // 加载中
	completionPosition: number // 补全位置
}
```

#### Actions

- `fetchAiCompletion(context: string)`
- `acceptCompletion()`
- `rejectCompletion()`
- `clearCompletion()`

---

### 7. **模型选择**

#### State

```typescript
{
  selectedLanguageModel: ModelItem | null  // 选中的语言模型
  selectedImageModel: ModelItem | null     // 选中的图像模型
  languageModelList: ModelItem[]           // 语言模型列表
  imageModelList: ModelItem[]              // 图像模型列表
  isLoadingModels: boolean                 // 加载中
  modelLoadError: string | null            // 加载错误
}

interface ModelItem {
  id: string
  group_id: string
  provider_model_id: string
  model_name: string
  model_icon: string
  model_status: ModelStatusEnum
  sort: number
}
```

#### Actions

- `loadModelList(topicMode: TopicMode)`
- `setSelectedLanguageModel(model: ModelItem)`
- `setSelectedImageModel(model: ModelItem)`
- `saveTopicModel(topicId: string, models: ModelSelection)`
- `loadTopicModel(topicId: string)`

---

### 8. **消息发送**

#### State

```typescript
{
  isSending: boolean                       // 是否发送中
  sendError: string | null                 // 发送错误
  canSendMessage: boolean                  // 是否可发送（计算属性）
  validationErrors: string[]               // 验证错误列表
}
```

#### Actions

- `validateMessage(): ValidationResult`
- `sendMessage(data: SendMessageData)`
- `handleSendSuccess()`
- `handleSendError(error: Error)`

---

### 9. **任务中断**

#### State

```typescript
{
	isTaskRunning: boolean // 任务运行中
	stopEventLoading: boolean // 停止事件加载中
	currentTaskId: string | null // 当前任务ID
}
```

#### Actions

- `interruptTask(taskId: string)`
- `handleInterruptSuccess()`
- `handleInterruptError(error: Error)`

---

### 10. **画布标记集成**

#### State

```typescript
{
  canvasMarkers: CanvasMarkerMentionData[] // 画布标记列表
  markerLoadingStates: Map<string, boolean> // 标记加载状态
}
```

#### Actions

- `addMarkerToChat(marker: CanvasMarkerMentionData)`
- `removeMarkerFromChat(markerId: string)`
- `updateMarkerData(markerId: string, data: Partial<CanvasMarkerMentionData>)`
- `batchUpdateMarkers(updates: MarkerUpdate[])`
- `clearAllMarkers()`
- `syncMarkerFromCanvas(markerId: string)`

---

### 11. **拖拽系统**

#### State

```typescript
{
	isDragOver: boolean // 是否拖拽悬停
	draggedData: any | null // 拖拽的数据
	dropZoneActive: boolean // 放置区域激活
}
```

#### Actions

- `handleDragEnter(e: DragEvent)`
- `handleDragLeave(e: DragEvent)`
- `handleDragOver(e: DragEvent)`
- `handleDrop(e: DragEvent)`
- `insertDroppedData(data: any)`

---

## 二、重构架构设计

### 架构分层原则

```
┌─────────────────────────────────────────┐
│              UI Layer                    │  ← 纯展示组件，无业务逻辑
├─────────────────────────────────────────┤
│            Store Layer                   │  ← 状态管理，响应式数据
├─────────────────────────────────────────┤
│           Service Layer                  │  ← 业务逻辑，API 调用
├─────────────────────────────────────────┤
│            Utils Layer                   │  ← 纯函数工具
└─────────────────────────────────────────┘
```

---

## 三、具体重构方案

### 1. **Service 层设计**

#### 1.1 EditorService

**职责**：编辑器核心业务逻辑

```typescript
// services/EditorService.ts
class EditorService {
	// 内容验证
	validateContent(content: JSONContent): ValidationResult

	// 超级占位符处理
	validateSuperPlaceholders(content: JSONContent): PlaceholderValidation
	replaceSuperPlaceholders(content: JSONContent): JSONContent

	// 内容过滤
	filterUploadFileMentions(content: JSONContent): JSONContent

	// 内容转换
	contentToPlainText(content: JSONContent): string
	plainTextToContent(text: string): JSONContent
}
```

#### 1.2 DraftService

**职责**：草稿持久化和版本管理

```typescript
// services/DraftService.ts
class DraftService {
	// 草稿 CRUD
	saveDraft(params: SaveDraftParams): Promise<void>
	loadDraft(draftId: string): Promise<DraftData | null>
	loadLatestDraft(params: DraftKeyParams): Promise<DraftData | null>
	deleteDraft(draftId: string): Promise<void>

	// 版本管理
	loadDraftVersions(params: DraftKeyParams): Promise<DraftVersion[]>
	createSentDraft(data: DraftData): Promise<void>

	// 草稿过滤
	filterDraftContent(draft: DraftData): DraftData
}
```

#### 1.3 FileUploadService

**职责**：文件上传和管理

```typescript
// services/FileUploadService.ts
class FileUploadService {
	// 文件上传
	uploadFile(file: File, options: UploadOptions): Promise<UploadResult>
	uploadFiles(files: File[], options: UploadOptions): Promise<UploadResult[]>

	// 文件验证
	validateFileSize(file: File, maxSize: number): boolean
	validateFileType(file: File, allowedTypes: string[]): boolean
	validateFileCount(count: number, max: number): boolean

	// 进度管理
	trackProgress(fileId: string, onProgress: (progress: number) => void): void

	// 重试逻辑
	retryUpload(fileId: string): Promise<UploadResult>
}
```

#### 1.4 MentionService

**职责**：Mention 数据处理和验证

```typescript
// services/MentionService.ts
class MentionService {
	// Mention 验证
	validateMention(item: TiptapMentionAttributes): boolean
	validateMentionList(items: TiptapMentionAttributes[]): ValidationResult

	// Mention 转换
	mentionToNode(item: TiptapMentionAttributes): Node
	nodeToMention(node: Node): TiptapMentionAttributes | null

	// Mention 过滤
	filterInvalidMentions(items: MentionListItem[]): MentionListItem[]
	filterByType(items: MentionListItem[], type: MentionItemType): MentionListItem[]
}
```

#### 1.5 ModelService

**职责**：模型选择和配置管理

```typescript
// services/ModelService.ts
class ModelService {
	// 模型列表
	loadModelList(mode: TopicMode): Promise<ModelItem[]>
	loadImageModelList(): Promise<ModelItem[]>

	// 模型配置
	saveTopicModelConfig(topicId: string, config: ModelConfig): Promise<void>
	loadTopicModelConfig(topicId: string): Promise<ModelConfig | null>

	// 模型验证
	validateModel(model: ModelItem): boolean
	getFallbackModel(): ModelItem
}
```

#### 1.6 VoiceService

**职责**：语音录制和转录

```typescript
// services/VoiceService.ts
class VoiceService {
	// 录音控制
	startRecording(): Promise<void>
	stopRecording(): Promise<Blob>
	cancelRecording(): void

	// 语音转文字
	transcribeAudio(blob: Blob): Promise<string>

	// 权限管理
	checkMicrophonePermission(): Promise<boolean>
	requestMicrophonePermission(): Promise<boolean>
}
```

#### 1.7 AiCompletionService

**职责**：AI 自动补全

```typescript
// services/AiCompletionService.ts
class AiCompletionService {
	// 补全请求
	fetchCompletion(context: string, cursorPosition: number): Promise<string>

	// 补全管理
	cancelCompletion(): void
	clearCompletion(): void

	// 输入法兼容
	onCompositionStart(): void
	onCompositionEnd(): void
}
```

#### 1.8 CanvasMarkerService

**职责**：画布标记同步

```typescript
// services/CanvasMarkerService.ts
class CanvasMarkerService {
	// 标记同步
	syncMarkerToCanvas(marker: CanvasMarkerMentionData): void
	syncMarkerFromCanvas(markerId: string): Promise<CanvasMarkerMentionData>

	// 批量操作
	batchSyncMarkers(markers: CanvasMarkerMentionData[]): Promise<void>
	clearAllCanvasMarkers(): void

	// 标记验证
	validateMarker(marker: CanvasMarkerMentionData): boolean
}
```

---

### 2. **Store 层设计（MobX/Zustand）**

推荐使用 **MobX** 或 **Zustand**，以下以 MobX 为例：

#### 2.1 EditorStore

**职责**：编辑器状态管理

```typescript
// stores/EditorStore.ts
import { makeAutoObservable } from "mobx"

class EditorStore {
	// Observable State
	value: JSONContent | undefined = undefined
	tiptapEditor: Editor | null = null
	isComposing = false
	isFocused = false
	placeholder = ""

	constructor(private editorService: EditorService) {
		makeAutoObservable(this)
	}

	// Computed
	get isEmpty() {
		return !this.value || isEmptyJSONContent(this.value)
	}

	get canSend() {
		return !this.isEmpty && this.isValid
	}

	get isValid() {
		return this.editorService.validateContent(this.value).isValid
	}

	// Actions
	setValue(content: JSONContent | undefined) {
		this.value = content
	}

	updateContent(content: JSONContent) {
		this.value = content
		this.tiptapEditor?.commands.setContent(content)
	}

	clearContent() {
		this.value = undefined
		this.tiptapEditor?.commands.clearContent()
	}

	setEditor(editor: Editor | null) {
		this.tiptapEditor = editor
	}

	focus(options?: FocusOptions) {
		this.tiptapEditor?.commands.focus()
	}

	// Composition Event
	handleCompositionStart() {
		this.isComposing = true
	}

	handleCompositionEnd() {
		this.isComposing = false
	}
}
```

#### 2.2 MentionStore

**职责**：Mention 项状态管理

```typescript
// stores/MentionStore.ts
class MentionStore {
	mentionItems: MentionListItem[] = []

	constructor(
		private mentionService: MentionService,
		private editorStore: EditorStore,
	) {
		makeAutoObservable(this)
	}

	// Computed
	get validMentions() {
		return this.mentionService.filterInvalidMentions(this.mentionItems)
	}

	get mentionsByType() {
		return groupBy(this.mentionItems, (item) => item.attrs.type)
	}

	get hasLoadingMarkers() {
		return this.mentionItems.some(
			(item) => item.attrs.type === MentionItemType.DESIGN_MARKER && item.attrs.data.loading,
		)
	}

	// Actions
	insertMentionItem(item: TiptapMentionAttributes) {
		if (!this.mentionService.validateMention(item)) return

		const mentionItem: MentionListItem = {
			id: generateId(),
			attrs: item,
		}
		this.mentionItems.push(mentionItem)
	}

	insertMentionItems(items: TiptapMentionAttributes[]) {
		const validItems = items.filter((item) => this.mentionService.validateMention(item))
		validItems.forEach((item) => this.insertMentionItem(item))
	}

	removeMentionItem(item: TiptapMentionAttributes) {
		this.mentionItems = this.mentionItems.filter((m) => !isSameMention(m.attrs, item))
	}

	updateMentionAttributes(markerId: string, data: Partial<any>) {
		const item = this.mentionItems.find(
			(m) =>
				m.attrs.type === MentionItemType.DESIGN_MARKER &&
				m.attrs.data.marker_id === markerId,
		)
		if (item) {
			item.attrs.data = { ...item.attrs.data, ...data }
		}
	}

	batchUpdateMentionAttributes(updates: Array<{ markerId: string; data: any }>) {
		updates.forEach((update) => {
			this.updateMentionAttributes(update.markerId, update.data)
		})
	}

	restoreMentionItems(items: MentionListItem[]) {
		this.mentionItems = items
	}

	clearAll() {
		this.mentionItems = []
	}
}
```

#### 2.3 FileUploadStore

**职责**：文件上传状态管理

```typescript
// stores/FileUploadStore.ts
class FileUploadStore {
	files: UploadFile[] = []

	constructor(
		private uploadService: FileUploadService,
		private mentionStore: MentionStore,
	) {
		makeAutoObservable(this)
	}

	// Computed
	get isAllFilesUploaded() {
		return this.files.every((f) => f.status === "success")
	}

	get uploadingFiles() {
		return this.files.filter((f) => f.status === "uploading")
	}

	get failedFiles() {
		return this.files.filter((f) => f.status === "error")
	}

	get totalProgress() {
		if (this.files.length === 0) return 100
		const sum = this.files.reduce((acc, f) => acc + f.progress, 0)
		return sum / this.files.length
	}

	// Actions
	async addFiles(files: File[], dirPath?: string) {
		// 验证
		if (!this.uploadService.validateFileCount(files.length, 100)) {
			throw new Error("Too many files")
		}

		const uploadFiles: UploadFile[] = files.map((file) => ({
			id: generateId(),
			file,
			status: "pending",
			progress: 0,
		}))

		this.files.push(...uploadFiles)

		// 触发上传
		uploadFiles.forEach((uf) => this.uploadFile(uf))
	}

	private async uploadFile(uploadFile: UploadFile) {
		uploadFile.status = "uploading"

		try {
			const result = await this.uploadService.uploadFile(uploadFile.file, {
				onProgress: (progress) => {
					uploadFile.progress = progress
				},
			})

			uploadFile.status = "success"
			uploadFile.uploadedFileId = result.fileId

			// 添加到 mention
			this.mentionStore.insertMentionItem({
				type: MentionItemType.PROJECT_FILE,
				data: result.fileData,
			})
		} catch (error) {
			uploadFile.status = "error"
			uploadFile.error = error.message
		}
	}

	removeFile(fileId: string) {
		this.files = this.files.filter((f) => f.id !== fileId)
	}

	async retryUpload(fileId: string) {
		const file = this.files.find((f) => f.id === fileId)
		if (!file) return

		file.status = "pending"
		file.error = undefined
		await this.uploadFile(file)
	}

	clearFiles() {
		this.files = []
	}
}
```

#### 2.4 DraftStore

**职责**：草稿状态管理

```typescript
// stores/DraftStore.ts
class DraftStore {
	currentDraft: DraftData | null = null
	draftVersions: DraftVersion[] = []
	isDraftReady = false
	isSaving = false

	constructor(
		private draftService: DraftService,
		private editorStore: EditorStore,
		private mentionStore: MentionStore,
	) {
		makeAutoObservable(this)
		this.setupAutoSave()
	}

	// Computed
	get hasDraft() {
		return this.currentDraft !== null
	}

	// Actions
	async saveDraft(params: SaveDraftParams) {
		if (this.isSaving) return

		this.isSaving = true
		try {
			await this.draftService.saveDraft({
				...params,
				value: this.editorStore.value,
				mentionItems: this.mentionStore.validMentions,
			})
		} finally {
			this.isSaving = false
		}
	}

	async loadLatestDraft(params: DraftKeyParams) {
		this.isDraftReady = false

		const draft = await this.draftService.loadLatestDraft(params)

		if (draft) {
			this.currentDraft = draft
			this.editorStore.updateContent(draft.value)
			this.mentionStore.restoreMentionItems(draft.mentionItems)
		}

		this.isDraftReady = true
	}

	async loadDraftVersions(params: DraftKeyParams) {
		this.draftVersions = await this.draftService.loadDraftVersions(params)
	}

	async useDraft(draftId: string) {
		const draft = await this.draftService.loadDraft(draftId)
		if (!draft) return

		this.currentDraft = draft
		this.editorStore.updateContent(draft.value)
		this.mentionStore.restoreMentionItems(draft.mentionItems)
	}

	async createSentDraft(params: DraftKeyParams) {
		await this.draftService.createSentDraft({
			...params,
			value: this.editorStore.value,
			mentionItems: this.mentionStore.mentionItems,
		})
		this.clearCurrentDraft()
	}

	clearCurrentDraft() {
		this.currentDraft = null
	}

	// 自动保存（防抖）
	private setupAutoSave() {
		reaction(
			() => ({
				value: this.editorStore.value,
				mentions: this.mentionStore.mentionItems.length,
			}),
			debounce(() => {
				if (this.isDraftReady && !this.editorStore.isComposing) {
					this.saveDraft(/* params */)
				}
			}, 1000),
		)
	}
}
```

#### 2.5 ModelStore

**职责**：模型选择状态管理

```typescript
// stores/ModelStore.ts
class ModelStore {
	selectedLanguageModel: ModelItem | null = null
	selectedImageModel: ModelItem | null = null
	languageModelList: ModelItem[] = []
	imageModelList: ModelItem[] = []
	isLoading = false

	constructor(private modelService: ModelService) {
		makeAutoObservable(this)
	}

	// Computed
	get hasValidModel() {
		return this.selectedLanguageModel !== null
	}

	get effectiveModel() {
		return this.selectedLanguageModel ?? this.modelService.getFallbackModel()
	}

	// Actions
	async loadModelList(mode: TopicMode) {
		this.isLoading = true
		try {
			this.languageModelList = await this.modelService.loadModelList(mode)
			this.imageModelList = await this.modelService.loadImageModelList()
		} finally {
			this.isLoading = false
		}
	}

	setSelectedLanguageModel(model: ModelItem | null) {
		this.selectedLanguageModel = model
	}

	setSelectedImageModel(model: ModelItem | null) {
		this.selectedImageModel = model
	}

	async saveTopicModel(topicId: string) {
		await this.modelService.saveTopicModelConfig(topicId, {
			languageModel: this.selectedLanguageModel,
			imageModel: this.selectedImageModel,
		})
	}

	async loadTopicModel(topicId: string) {
		const config = await this.modelService.loadTopicModelConfig(topicId)
		if (config) {
			this.selectedLanguageModel = config.languageModel
			this.selectedImageModel = config.imageModel
		}
	}
}
```

#### 2.6 MessageEditorStore（根 Store）

**职责**：整合所有子 Store，提供统一接口

```typescript
// stores/MessageEditorStore.ts
class MessageEditorStore {
	editorStore: EditorStore
	mentionStore: MentionStore
	fileUploadStore: FileUploadStore
	draftStore: DraftStore
	modelStore: ModelStore
	voiceStore: VoiceStore

	// 全局状态
	isSending = false
	isTaskRunning = false
	stopEventLoading = false

	constructor(services: Services) {
		this.editorStore = new EditorStore(services.editorService)
		this.mentionStore = new MentionStore(services.mentionService, this.editorStore)
		this.fileUploadStore = new FileUploadStore(services.uploadService, this.mentionStore)
		this.draftStore = new DraftStore(services.draftService, this.editorStore, this.mentionStore)
		this.modelStore = new ModelStore(services.modelService)
		this.voiceStore = new VoiceStore(services.voiceService)

		makeAutoObservable(this)
	}

	// Computed
	get canSendMessage() {
		return (
			this.editorStore.canSend &&
			this.fileUploadStore.isAllFilesUploaded &&
			!this.mentionStore.hasLoadingMarkers &&
			!this.isSending
		)
	}

	// Actions
	async sendMessage() {
		if (!this.canSendMessage) return

		this.isSending = true
		try {
			const content = this.editorStore.value
			const mentions = this.mentionStore.validMentions
			const model = this.modelStore.effectiveModel

			await this.onSend?.({
				value: content,
				mentionItems: mentions,
				selectedModel: model,
				selectedImageModel: this.modelStore.selectedImageModel,
			})

			// 发送成功后清理
			await this.draftStore.createSentDraft(/* params */)
			this.clearContent()
		} finally {
			this.isSending = false
		}
	}

	clearContent() {
		this.editorStore.clearContent()
		this.mentionStore.clearAll()
		this.fileUploadStore.clearFiles()
	}

	// 话题切换
	async switchTopic(topicId: string, projectId: string, workspaceId: string) {
		await this.draftStore.loadLatestDraft({ topicId, projectId, workspaceId })
		await this.modelStore.loadTopicModel(topicId)
	}
}
```

---

### 3. **UI 层设计**

#### 3.1 组件拆分原则

```
MessageEditor (容器组件)
├── MessageEditorToolbar (顶部工具栏)
│   ├── DraftBox
│   └── ModeSwitch
├── MentionList (Mention 列表)
├── EditorContent (编辑器内容)
├── MessageEditorFooter (底部工具栏)
│   ├── ModelSelector
│   ├── MentionPanelTrigger
│   ├── FileUploadButton
│   ├── VoiceInputButton
│   └── SendButton
└── DragOverlay (拖拽遮罩)
```

#### 3.2 MessageEditor (容器组件)

```typescript
// MessageEditor.tsx
import { observer } from 'mobx-react-lite'

export const MessageEditor = observer(
  forwardRef<MessageEditorRef, MessageEditorProps>((props, ref) => {
    // 创建或获取 store
    const store = useMessageEditorStore()

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      editor: store.editorStore.tiptapEditor,
      canSendMessage: store.canSendMessage,
      clearContent: () => store.clearContent(),
      focus: () => store.editorStore.focus(),
      // ... 其他方法
    }))

    // 监听话题切换
    useEffect(() => {
      if (props.selectedTopic) {
        store.switchTopic(
          props.selectedTopic.id,
          props.selectedProject.id,
          props.selectedWorkspace.id
        )
      }
    }, [props.selectedTopic?.id])

    return (
      <MessageEditorProvider store={store}>
        <div className={styles.container}>
          <MessageEditorToolbar />
          <MentionList items={store.mentionStore.mentionItems} />
          <EditorContent editor={store.editorStore.tiptapEditor} />
          <MessageEditorFooter />
        </div>
      </MessageEditorProvider>
    )
  })
)
```

#### 3.3 纯展示组件

```typescript
// components/SendButton.tsx
import { observer } from 'mobx-react-lite'

export const SendButton = observer(() => {
  const store = useMessageEditorStore()

  const handleClick = () => {
    if (store.isTaskRunning) {
      store.interruptTask()
    } else {
      store.sendMessage()
    }
  }

  return (
    <MagicButton
      disabled={!store.canSendMessage && !store.isTaskRunning}
      loading={store.isSending || store.stopEventLoading}
      onClick={handleClick}
      icon={store.isTaskRunning ? <StopIcon /> : <SendIcon />}
    />
  )
})
```

```typescript
// components/ModelSelector.tsx
import { observer } from 'mobx-react-lite'

export const ModelSelector = observer(() => {
  const store = useMessageEditorStore()
  const { modelStore } = store

  return (
    <Select
      value={modelStore.selectedLanguageModel?.id}
      options={modelStore.languageModelList}
      onChange={(modelId) => {
        const model = modelStore.languageModelList.find(m => m.id === modelId)
        modelStore.setSelectedLanguageModel(model)
      }}
      loading={modelStore.isLoading}
    />
  )
})
```

---

## 四、重构步骤建议

### Phase 1: 服务层抽取（2-3 天）

1. 创建 Service 接口和实现
2. 将现有的业务逻辑迁移到 Service
3. 编写单元测试

### Phase 2: Store 层构建（3-4 天）

1. 设计 Store 结构
2. 实现各个 Store 类
3. 设置 Store 之间的依赖关系
4. 编写 Store 单元测试

### Phase 3: UI 组件重构（4-5 天）

1. 拆分现有组件为小组件
2. 使用 observer 包装需要响应式的组件
3. 替换 useState/useReducer 为 Store
4. 清理冗余代码

### Phase 4: 集成测试（2-3 天）

1. 端到端测试
2. 性能测试
3. 边界情况测试

### Phase 5: 优化和文档（1-2 天）

1. 性能优化
2. 代码注释
3. 更新文档

---

## 五、重构收益

### 1. **可维护性提升**

- 职责清晰，每个模块只关注自己的领域
- 代码结构扁平，易于查找和修改
- 依赖关系明确，避免循环依赖

### 2. **可测试性提升**

- Service 层纯函数，易于单元测试
- Store 层独立，可单独测试
- UI 层纯展示，快照测试

### 3. **可复用性提升**

- Service 可在其他场景复用
- Store 可在不同 UI 框架中使用
- 组件可单独使用

### 4. **性能优化**

- MobX 精确追踪依赖，减少不必要的渲染
- 计算属性缓存
- 异步操作更好控制

### 5. **团队协作**

- 前后端分离更清晰
- 多人并行开发不冲突
- 代码审查更容易

---

## 六、迁移风险和注意事项

### 1. **兼容性风险**

- 保留原有接口，逐步迁移
- 使用 Feature Flag 控制新旧代码
- 充分的回归测试

### 2. **性能风险**

- 监控渲染次数
- 使用 MobX DevTools 调试
- 关注内存泄漏

### 3. **团队学习成本**

- 提供培训文档
- Code Review 把关
- 逐步推广最佳实践

---

## 七、技术栈选择建议

### 状态管理：MobX vs Zustand

#### 推荐：**MobX**

**优势**：

- 响应式编程，自动追踪依赖
- 写法简洁，接近面向对象
- 性能优秀，精确更新
- 适合复杂状态管理

**劣势**：

- 学习曲线稍陡
- 需要理解响应式概念
- 包体积稍大

#### 备选：**Zustand**

**优势**：

- 极简 API
- 包体积小
- 无样板代码
- 容易上手

**劣势**：

- 需要手动优化性能
- 计算属性需要额外处理
- 不适合超大型应用

### 建议：

- **复杂场景**：选 MobX（如当前 MessageEditor）
- **简单场景**：选 Zustand
- **混合使用**：核心用 MobX，局部用 Zustand

---

## 八、示例代码

### 完整的 Store 使用示例

```typescript
// 1. 创建 Store Context
const MessageEditorStoreContext = createContext<MessageEditorStore | null>(null)

export const MessageEditorProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const store = useMemo(() => new MessageEditorStore(services), [])
  return (
    <MessageEditorStoreContext.Provider value={store}>
      {children}
    </MessageEditorStoreContext.Provider>
  )
}

export const useMessageEditorStore = () => {
  const store = useContext(MessageEditorStoreContext)
  if (!store) throw new Error('Store not found')
  return store
}

// 2. 在组件中使用
const MyComponent = observer(() => {
  const store = useMessageEditorStore()

  return (
    <div>
      <p>Can send: {store.canSendMessage ? 'Yes' : 'No'}</p>
      <button onClick={() => store.sendMessage()}>Send</button>
    </div>
  )
})
```

---

## 九、总结

通过 Service-Store-UI 三层架构重构：

✅ **Service 层**：纯业务逻辑，易于测试和复用  
✅ **Store 层**：状态管理，响应式更新  
✅ **UI 层**：纯展示组件，关注用户交互

这样的架构能让 MessageEditor 更加健壮、可维护和可扩展。
