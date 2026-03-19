# Service 与 Store 交互方向设计决策

## 问题：Service 更新 Store vs Store 调用 Service？

---

## 方案对比

### 方案 A：Store 调用 Service（✅ 推荐）

```typescript
┌─────────┐
│   UI    │ 触发 Action
└────┬────┘
     │
     ▼
┌─────────┐
│  Store  │ 拥有状态，控制流程
└────┬────┘
     │ 调用
     ▼
┌─────────┐
│ Service │ 纯业务逻辑，无状态
└────┬────┘
     │
     ▼
┌─────────┐
│   API   │
└─────────┘

结果更新：Store 自己更新状态
```

### 方案 B：Service 更新 Store（❌ 不推荐）

```typescript
┌─────────┐
│   UI    │ 触发 Action
└────┬────┘
     │
     ▼
┌─────────┐
│ Service │ 控制流程 + 业务逻辑
└────┬────┘
     │ 更新
     ▼
┌─────────┐
│  Store  │ 被动接收状态更新
└─────────┘
```

---

## 详细分析

### ✅ 推荐方案：Store 调用 Service

#### 优势

**1. 职责清晰**

```typescript
// ✅ Service: 纯业务逻辑，不关心状态管理
class FileUploadService {
	// 只负责上传文件，返回结果
	async uploadFile(file: File): Promise<UploadResult> {
		const formData = new FormData()
		formData.append("file", file)
		const response = await api.post("/upload", formData)
		return response.data
	}

	// 只负责验证，不修改任何状态
	validateFileSize(file: File, maxSize: number): boolean {
		return file.size <= maxSize
	}
}

// ✅ Store: 拥有状态，控制何时如何更新
class FileUploadStore {
	files: UploadFile[] = []

	constructor(private uploadService: FileUploadService) {
		makeAutoObservable(this)
	}

	// Store 控制整个上传流程
	async uploadFile(file: File) {
		// 1. 更新状态：开始上传
		const uploadFile = {
			id: generateId(),
			file,
			status: "uploading" as const,
			progress: 0,
		}
		this.files.push(uploadFile)

		try {
			// 2. 调用 Service 处理业务逻辑
			const result = await this.uploadService.uploadFile(file)

			// 3. 更新状态：上传成功
			uploadFile.status = "success"
			uploadFile.uploadedFileId = result.fileId
		} catch (error) {
			// 4. 更新状态：上传失败
			uploadFile.status = "error"
			uploadFile.error = error.message
		}
	}
}
```

**2. Service 可复用**

```typescript
// ✅ Service 不依赖任何 Store，可以在不同场景复用
class FileUploadService {
	async uploadFile(file: File): Promise<UploadResult> {
		// 纯业务逻辑
	}
}

// 场景 1：在 MessageEditor 中使用
class FileUploadStore {
	constructor(private uploadService: FileUploadService) {}
}

// 场景 2：在其他地方直接使用 Service
const uploadService = new FileUploadService()
const result = await uploadService.uploadFile(file)

// 场景 3：在 Node.js 后端使用（如果是同构代码）
const uploadService = new FileUploadService()
```

**3. 测试更容易**

```typescript
// ✅ 测试 Service：不需要 Mock Store
describe("FileUploadService", () => {
	it("should upload file", async () => {
		const service = new FileUploadService()
		const file = new File(["content"], "test.txt")
		const result = await service.uploadFile(file)
		expect(result.fileId).toBeDefined()
	})
})

// ✅ 测试 Store：Mock Service 很简单
describe("FileUploadStore", () => {
	it("should update status after upload", async () => {
		const mockService = {
			uploadFile: jest.fn().mockResolvedValue({ fileId: "123" }),
		}
		const store = new FileUploadStore(mockService)

		await store.uploadFile(new File(["content"], "test.txt"))

		expect(store.files[0].status).toBe("success")
		expect(mockService.uploadFile).toHaveBeenCalled()
	})
})
```

**4. 符合单向数据流**

```typescript
// ✅ 数据流向清晰
UI Component
  → dispatch action to Store
    → Store calls Service (获取数据)
      → Service returns result
    ← Store updates state
  ← UI re-renders (响应式更新)

// 始终是 Store 控制数据流
```

**5. 依赖方向正确**

```typescript
// ✅ 依赖方向：Store → Service → API
// Store 依赖 Service（通过依赖注入）
// Service 不依赖 Store（纯函数/类）

class MessageEditorStore {
	constructor(
		private editorService: EditorService, // ← 依赖 Service
		private draftService: DraftService,
		private uploadService: FileUploadService,
	) {
		makeAutoObservable(this)
	}
}

// Service 完全独立
class EditorService {
	// 不依赖任何 Store
	validateContent(content: JSONContent): ValidationResult {
		// 纯函数
	}
}
```

**6. 更容易做状态编排**

```typescript
// ✅ Store 可以编排多个 Service 的调用
class MessageEditorStore {
	async sendMessage() {
		// 1. 验证内容
		const validation = this.editorService.validateContent(this.value)
		if (!validation.isValid) {
			this.validationError = validation.error
			return
		}

		// 2. 上传文件
		const uploadResults = await Promise.all(
			this.files.map((f) => this.uploadService.uploadFile(f.file)),
		)

		// 3. 保存草稿
		await this.draftService.createSentDraft({
			value: this.value,
			mentionItems: this.mentionItems,
		})

		// 4. 发送消息
		await this.messageService.sendMessage({
			content: this.value,
			attachments: uploadResults,
		})

		// 5. 清理状态
		this.clearContent()
	}
}
```

---

### ❌ 不推荐方案：Service 更新 Store

#### 劣势

**1. 职责混乱**

```typescript
// ❌ Service 既有业务逻辑，又管理状态
class FileUploadService {
	constructor(private store: FileUploadStore) {} // ← 依赖 Store

	async uploadFile(file: File) {
		// 业务逻辑 + 状态更新混在一起
		this.store.setStatus("uploading") // ❌ Service 不应该知道 Store

		try {
			const response = await api.post("/upload", file)
			this.store.setStatus("success") // ❌ 职责不清
			this.store.setFileId(response.data.fileId)
		} catch (error) {
			this.store.setStatus("error") // ❌ 紧耦合
		}
	}
}
```

**2. Service 无法复用**

```typescript
// ❌ Service 绑定了特定的 Store，无法在其他地方使用
class FileUploadService {
  constructor(private store: FileUploadStore) {}

  async uploadFile(file: File) {
    this.store.updateState(...)  // 依赖特定 Store
  }
}

// 如果在其他地方需要上传文件，必须创建对应的 Store
// 即使只是简单地上传一个文件，也要带上整个 Store
```

**3. 测试困难**

```typescript
// ❌ 测试 Service 必须 Mock Store（复杂）
describe("FileUploadService", () => {
	it("should upload file", async () => {
		const mockStore = {
			setStatus: jest.fn(),
			setFileId: jest.fn(),
			files: [],
		}
		const service = new FileUploadService(mockStore)

		await service.uploadFile(file)

		// 必须验证 Store 的调用
		expect(mockStore.setStatus).toHaveBeenCalledWith("uploading")
		expect(mockStore.setStatus).toHaveBeenCalledWith("success")
	})
})

// ❌ Store 测试变得简单，但 Store 的价值降低了
describe("FileUploadStore", () => {
	it("should set status", () => {
		const store = new FileUploadStore()
		store.setStatus("uploading")
		expect(store.status).toBe("uploading") // 没有实际意义的测试
	})
})
```

**4. 违反依赖倒置原则**

```typescript
// ❌ 依赖方向错误：Service → Store
// 低层模块（Service）依赖高层模块（Store）

class FileUploadService {
	constructor(private store: FileUploadStore) {} // ❌ 依赖具体实现
}

// 如果要更换 Store 实现，Service 也要改
```

**5. 难以进行状态编排**

```typescript
// ❌ 多个 Service 互相调用很混乱
class MessageService {
	constructor(
		private messageStore: MessageStore,
		private uploadService: FileUploadService, // 它会更新 FileUploadStore
		private draftService: DraftService, // 它会更新 DraftStore
	) {}

	async sendMessage() {
		// Service A 调用 Service B，Service B 更新 Store B
		// 然后 Service A 又需要访问 Store B 的状态
		// 形成混乱的调用链
		await this.uploadService.uploadFiles()

		// 现在需要知道上传结果，但在哪个 Store？
		// ❌ 需要注入多个 Store 来访问状态
	}
}
```

---

## 最佳实践

### 1. **Service 设计原则**

```typescript
// ✅ Service 应该是纯业务逻辑，无状态
class EditorService {
	// ✅ 接收参数，返回结果
	validateContent(content: JSONContent): ValidationResult {
		if (!content) {
			return { isValid: false, error: "Content is empty" }
		}
		// ... 验证逻辑
		return { isValid: true }
	}

	// ✅ 不保存状态，每次调用都是独立的
	transformContent(content: JSONContent, options: TransformOptions): JSONContent {
		// 纯函数转换
		return transformed
	}
}

// ❌ Service 不应该有内部状态（除非是缓存等特殊场景）
class BadEditorService {
	private currentContent: JSONContent // ❌ 不要在 Service 中保存业务状态

	setContent(content: JSONContent) {
		// ❌ 不要让 Service 管理状态
		this.currentContent = content
	}
}
```

### 2. **Store 设计原则**

```typescript
// ✅ Store 拥有状态，通过调用 Service 获取数据
class EditorStore {
	value: JSONContent | undefined = undefined
	validationError: string | null = null

	constructor(private editorService: EditorService) {
		makeAutoObservable(this)
	}

	// ✅ Action 中调用 Service，然后更新状态
	setValue(content: JSONContent) {
		// 1. 调用 Service 验证
		const validation = this.editorService.validateContent(content)

		// 2. 根据结果更新状态
		if (validation.isValid) {
			this.value = content
			this.validationError = null
		} else {
			this.validationError = validation.error
		}
	}

	// ✅ Computed 基于当前状态
	get isValid() {
		return this.validationError === null
	}
}
```

### 3. **依赖注入**

```typescript
// ✅ 使用依赖注入，方便测试和替换
class MessageEditorStore {
	constructor(
		private editorService: EditorService,
		private draftService: DraftService,
		private uploadService: FileUploadService,
	) {
		makeAutoObservable(this)
	}
}

// 生产环境
const store = new MessageEditorStore(
	new EditorService(),
	new DraftService(),
	new FileUploadService(),
)

// 测试环境
const store = new MessageEditorStore(mockEditorService, mockDraftService, mockUploadService)
```

### 4. **Service 之间的组合**

```typescript
// ✅ 如果 Service 需要调用其他 Service，通过依赖注入
class MessageService {
	constructor(
		private editorService: EditorService,
		private uploadService: FileUploadService,
	) {}

	async prepareMessage(content: JSONContent, files: File[]) {
		// 1. 验证内容
		const validation = this.editorService.validateContent(content)
		if (!validation.isValid) {
			throw new Error(validation.error)
		}

		// 2. 上传文件
		const uploadResults = await Promise.all(files.map((f) => this.uploadService.uploadFile(f)))

		// 3. 返回准备好的数据（不更新任何状态）
		return {
			content: this.editorService.transformContent(content),
			attachments: uploadResults,
		}
	}
}

// Store 调用组合后的 Service
class MessageEditorStore {
	async sendMessage() {
		this.isSending = true
		try {
			const prepared = await this.messageService.prepareMessage(this.value, this.files)

			await this.api.sendMessage(prepared)

			// 更新状态
			this.clearContent()
			this.isSending = false
		} catch (error) {
			this.sendError = error.message
			this.isSending = false
		}
	}
}
```

### 5. **异步操作处理**

```typescript
// ✅ Store 控制异步流程
class DraftStore {
	isSaving = false
	saveError: string | null = null

	async saveDraft(data: DraftData) {
		this.isSaving = true
		this.saveError = null

		try {
			// Service 只负责保存，返回结果
			await this.draftService.saveDraft(data)

			// Store 更新状态
			this.lastSavedAt = Date.now()
			this.isSaving = false
		} catch (error) {
			// Store 处理错误
			this.saveError = error.message
			this.isSaving = false
		}
	}
}
```

---

## 特殊场景

### 场景 1：Service 需要触发多个状态更新？

**问题**：如果一个 Service 方法需要更新多个 Store 的状态怎么办？

**解决方案**：在上层 Store 中编排

```typescript
// ❌ 不要让 Service 直接更新多个 Store
class BadMessageService {
	constructor(
		private editorStore: EditorStore,
		private draftStore: DraftStore,
		private fileStore: FileUploadStore,
	) {}

	async sendMessage() {
		this.editorStore.setStatus("sending") // ❌
		this.draftStore.clear() // ❌
		this.fileStore.clearAll() // ❌
	}
}

// ✅ 在根 Store 中编排
class MessageEditorStore {
	editorStore: EditorStore
	draftStore: DraftStore
	fileStore: FileUploadStore

	async sendMessage() {
		// Store 控制所有状态更新
		this.editorStore.setStatus("sending")

		const result = await this.messageService.sendMessage({
			content: this.editorStore.value,
			files: this.fileStore.files,
		})

		this.draftStore.clear()
		this.fileStore.clearAll()
		this.editorStore.setStatus("idle")
	}
}
```

### 场景 2：Service 需要实时通知进度？

**问题**：文件上传需要实时更新进度，Service 应该如何通知？

**解决方案**：使用回调函数

```typescript
// ✅ Service 通过回调通知进度（不直接更新 Store）
class FileUploadService {
	async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest()

			xhr.upload.addEventListener("progress", (e) => {
				if (e.lengthComputable) {
					const progress = (e.loaded / e.total) * 100
					onProgress?.(progress) // ← 通过回调通知
				}
			})

			xhr.addEventListener("load", () => {
				resolve(JSON.parse(xhr.responseText))
			})

			xhr.open("POST", "/upload")
			xhr.send(file)
		})
	}
}

// ✅ Store 传入回调，在回调中更新状态
class FileUploadStore {
	async uploadFile(uploadFile: UploadFile) {
		uploadFile.status = "uploading"

		try {
			const result = await this.uploadService.uploadFile(uploadFile.file, (progress) => {
				uploadFile.progress = progress // ← Store 更新状态
			})

			uploadFile.status = "success"
			uploadFile.fileId = result.fileId
		} catch (error) {
			uploadFile.status = "error"
		}
	}
}
```

### 场景 3：Service 需要访问当前状态？

**问题**：Service 方法需要基于当前状态做决策？

**解决方案**：将状态作为参数传入

```typescript
// ❌ 不要让 Service 依赖 Store 获取状态
class BadDraftService {
	constructor(private editorStore: EditorStore) {}

	async saveDraft() {
		const content = this.editorStore.value // ❌ 依赖 Store
		// ...
	}
}

// ✅ Store 传递状态给 Service
class DraftService {
	async saveDraft(data: DraftData): Promise<void> {
		// Service 接收所有需要的数据作为参数
		await api.post("/drafts", data)
	}
}

class EditorStore {
	async saveDraft() {
		// Store 传递当前状态给 Service
		await this.draftService.saveDraft({
			value: this.value,
			mentionItems: this.mentionStore.mentionItems,
			topicId: this.currentTopicId,
		})
	}
}
```

---

## 架构示意图

### 推荐架构（Store 调用 Service）

```
┌─────────────────────────────────────────────────┐
│                   UI Layer                       │
│  (React Components with observer)                │
└─────────────────┬───────────────────────────────┘
                  │
                  │ dispatch actions
                  │ read state
                  ▼
┌─────────────────────────────────────────────────┐
│                 Store Layer                      │
│  ┌─────────────────────────────────────────┐   │
│  │    MessageEditorStore (Root Store)       │   │
│  │  - 拥有状态                              │   │
│  │  - 控制流程                              │   │
│  │  - 编排多个子 Store                      │   │
│  └────┬─────────────┬──────────────┬────────┘   │
│       │             │              │            │
│  ┌────▼────┐  ┌────▼────┐   ┌────▼─────┐      │
│  │ Editor  │  │ Mention │   │ FileUp   │      │
│  │ Store   │  │ Store   │   │ Store    │      │
│  └────┬────┘  └────┬────┘   └────┬─────┘      │
└───────┼───────────┼─────────────┼──────────────┘
        │           │             │
        │ 调用      │ 调用        │ 调用
        ▼           ▼             ▼
┌─────────────────────────────────────────────────┐
│                Service Layer                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Editor   │  │ Mention  │  │ FileUp   │     │
│  │ Service  │  │ Service  │  │ Service  │     │
│  │          │  │          │  │          │     │
│  │ 纯逻辑   │  │ 纯逻辑   │  │ 纯逻辑   │     │
│  │ 无状态   │  │ 无状态   │  │ 无状态   │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
└───────┼─────────────┼──────────────┼───────────┘
        │             │              │
        └─────────────┴──────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │    API / Utils    │
            └──────────────────┘
```

---

## 结论

**✅ 强烈推荐：Store 调用 Service**

### 核心理由

1. **职责分离**：Store 管状态，Service 做业务
2. **依赖方向正确**：高层依赖低层（Store → Service）
3. **可测试性**：Service 纯函数易测，Store 易 Mock
4. **可复用性**：Service 可在任何地方复用
5. **可维护性**：代码结构清晰，易于理解

### 设计原则

```typescript
// Service: 无状态，纯业务逻辑
class Service {
	method(input): output {
		// 不依赖外部状态
		// 不修改外部状态
		// 可重复调用
	}
}

// Store: 有状态，调用 Service，控制流程
class Store {
	@observable state

	@action
	async doSomething() {
		// 1. 准备参数
		// 2. 调用 Service
		const result = await this.service.method(params)
		// 3. 更新状态
		this.state = result
	}
}
```

### 一句话总结

**Store 是大脑（决策者），Service 是工具（执行者）**
大脑决定做什么、何时做，工具只管怎么做。
