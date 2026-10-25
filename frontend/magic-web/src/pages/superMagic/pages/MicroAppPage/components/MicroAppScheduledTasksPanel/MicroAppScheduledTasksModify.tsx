import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Form } from "antd"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import dayjs from "@/infrastructure/vendors/dayjs"
import { MagicDatePicker } from "@/components/base"
import { FormSwitch } from "@/components/business/AccountSetting/pages/ScheduledTasks/components/FormSwitch"
import magicToast from "@/components/base/MagicToaster/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { parseContent } from "@/pages/superMagic/components/MessageList/components/Text/components/RichText/utils"
import { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import {
	ProjectStatus,
	TaskStatus,
	TopicMode,
	WorkspaceStatus,
	type ProjectListItem,
	type Topic,
	type Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import MessageEditor, {
	type MessageEditorRef,
} from "@/components/business/AccountSetting/pages/ScheduledTasks/components/MessageEditor"
import { ScheduledItem } from "@/components/business/AccountSetting/pages/ScheduledTasks/components/ScheduledItem"
import ProjectTopicItem from "@/components/business/AccountSetting/pages/ScheduledTasks/components/ProjectTopicItem"
import { useAttachments } from "@/components/business/AccountSetting/pages/ScheduledTasks/hooks/useAttachments"
import mcpTempStorage from "@/components/business/AccountSetting/pages/ScheduledTasks/store/MCPTempStorage"
import type { FormValues } from "@/components/business/AccountSetting/pages/ScheduledTasks/types"
import { ScheduledTask } from "@/types/scheduledTask"
import { ProjectFilesStore } from "@/stores/projectFiles"
import {
	getNextRunTime,
	serializeScheduledTaskModel,
} from "@/components/business/AccountSetting/pages/ScheduledTasks/utils"
import type { MicroAppScheduledTasksModifyProps } from "./types"
import { applyMicroAppScheduledTaskContext } from "./utils"
import {
	isAgentSelectionAvailable,
	resolveAgentSelection,
	resolveDefaultAgentSelection,
} from "@/services/superMagic/DefaultAgentSelectionService"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"

const formClassName = cn(
	"[&_.magic-form-item]:mb-4",
	"[&_.magic-form-item:last-child]:mb-0",
	"[&_.magic-form-item-label]:pb-1",
	"[&_.magic-form-item-label>label]:text-sm",
	"[&_.magic-form-item-label>label]:font-normal",
	"[&_.magic-form-item-label>label]:leading-4",
	"[&_.magic-form-item-label>label]:text-foreground/80",
	"[&_.magic-form-item-required]:text-sm",
	"[&_.magic-form-item-required]:font-normal",
	"[&_.magic-form-item-required]:leading-4",
	"[&_.magic-form-item-required]:text-foreground/80",
	"[&_.magic-form-item-explain-error]:block",
	"[&_.magic-form-item-explain-error]:text-xs",
	"[&_.magic-form-item-explain-error]:leading-4",
	"[&_.magic-form-item-control-input]:min-h-0",
)

const requiredMarkClassName = "ml-1 text-destructive"
const footerClassName =
	"flex items-center justify-between gap-2.5 border-t border-border px-5 py-3.5"

function ReadonlyContextItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="mb-4">
			<div className="mb-1 text-sm leading-4 text-foreground/80">{label}</div>
			<div className="flex min-h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground/70">
				<span className="truncate">{value}</span>
			</div>
		</div>
	)
}

function createWorkspace(context: MicroAppScheduledTasksModifyProps["context"]): Workspace {
	return {
		id: context.workspaceId,
		name: context.workspaceName || context.workspaceId,
		is_archived: 0,
		current_topic_id: "",
		current_project_id: context.projectId,
		workspace_status: WorkspaceStatus.WAITING,
		project_count: 1,
		workspace_type: "chat",
	}
}

function createProject(context: MicroAppScheduledTasksModifyProps["context"]): ProjectListItem {
	return {
		id: context.projectId,
		project_name: context.projectName || context.projectId,
		project_status: ProjectStatus.WAITING,
		project_mode: TopicMode.General,
		workspace_id: context.workspaceId,
		work_dir: "",
		workspace_name: context.workspaceName || context.workspaceId,
		current_topic_id: context.topicId || "",
		current_topic_status: "",
		created_at: "",
		updated_at: "",
		tag: "",
	}
}

export function MicroAppScheduledTasksModify({
	context,
	initialValues,
	onSubmit,
	onClose,
	mode,
}: MicroAppScheduledTasksModifyProps) {
	const { t } = useTranslation("interface")
	const { t: tSuper } = useTranslation("super")
	const isMobile = useIsMobile()
	const tiptapEditorRef = useRef<MessageEditorRef>(null)
	const timeRef = useRef<NodeJS.Timeout | null>(null)
	const [form] = Form.useForm<ScheduledTask.UpdateTask>()
	const [loading, setLoading] = useState(Boolean(initialValues))
	const [promptRequired, setPromptRequired] = useState(false)
	// Runtime tasks may use any employee; development tasks retain their fixed micro-app employee.
	const allowSelectAgent = Boolean(context.microAppId)
	const [agentSelection, setAgentSelection] = useState(() => {
		const saved = initialValues?.message_content?.extra?.super_agent
		return saved?.topic_pattern
			? resolveAgentSelection(saved.topic_pattern, saved.agent_code)
			: resolveDefaultAgentSelection()
	})
	const modelTopicMode = allowSelectAgent
		? (agentSelection.modeIdentifier as TopicMode)
		: TopicMode.Default
	const runtimeTopicMode = allowSelectAgent ? agentSelection.topicPattern : TopicMode.MicroApp
	const handleAgentChange = useMemoizedFn((nextMode: TopicMode) => {
		setAgentSelection(resolveAgentSelection(nextMode))
	})
	const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
	const [modalStores] = useState(() => {
		const projectFilesStore = new ProjectFilesStore()
		return {
			projectFilesStore,
			mentionPanelStore: createMentionPanelStore(projectFilesStore),
		}
	})
	const selectedWorkspace = useMemo(() => createWorkspace(context), [context])
	const selectedProject = useMemo(() => createProject(context), [context])

	const deadlineEnabled = Form.useWatch("deadline_enabled", form)
	const timeConfig = Form.useWatch("time_config", form)

	const { attachments } = useAttachments({
		projectId: context.projectId,
		selectedProject,
		mode,
		projectFilesStore: modalStores.projectFilesStore,
		mentionPanelStore: modalStores.mentionPanelStore,
	})

	const minDate = useMemo(
		() => (timeConfig ? getNextRunTime(timeConfig) : undefined),
		[timeConfig],
	)

	const defaultValues: Partial<FormValues> = {
		message_type: "text",
		time_config: {
			type: ScheduledTask.ScheduleType.Once,
			day: dayjs().format("YYYY-MM-DD"),
			time: dayjs().add(1, "hour").set("minute", 0).format("HH:mm"),
		},
		enabled: 1,
		message_content: { content: {} },
		...initialValues,
		workspace_id: context.workspaceId,
		project_id: context.projectId,
		deadline_enabled: Boolean(initialValues?.deadline),
		topic_enabled: initialValues?.topic_id !== "0",
		topic_id: initialValues?.topic_id === "0" ? undefined : initialValues?.topic_id,
	}

	const customRequiredMark = (label: ReactNode, { required }: { required: boolean }) => (
		<div className="flex items-center gap-1">
			{label}
			{required ? <span className={requiredMarkClassName}>*</span> : null}
		</div>
	)

	const onOk = useMemoizedFn(async () => {
		try {
			if (
				allowSelectAgent &&
				superMagicModeService.modeList.length > 0 &&
				!isAgentSelectionAvailable(agentSelection.modeIdentifier, agentSelection.agentCode)
			) {
				magicToast.error(t("accountPanel.timedTasks.agentUnavailable"))
				return
			}
			const values = await form.validateFields()
			if (!context.workspaceId || !context.projectId) {
				magicToast.error(t("accountPanel.timedTasks.workspace"))
				return
			}
			if (!tiptapEditorRef.current?.editor?.getText()) {
				setPromptRequired(true)
				magicToast.error(t("accountPanel.timedTasks.promptRequired"))
				return
			}

			setPromptRequired(false)
			const content = tiptapEditorRef.current?.editor?.getJSON() ?? {}
			const imageModel = serializeScheduledTaskModel(
				tiptapEditorRef.current?.selectedImageModel,
			)
			const videoModel = serializeScheduledTaskModel(
				tiptapEditorRef.current?.selectedVideoModel,
			)
			onSubmit?.(
				applyMicroAppScheduledTaskContext(
					{
						task_name: values.task_name,
						workspace_id: values.workspace_id,
						project_id: values.project_id,
						topic_id: values.topic_id ?? "",
						time_config: values.time_config,
						enabled: values.enabled,
						message_type: "rich_text",
						deadline: values.deadline
							? dayjs(values.deadline).format("YYYY-MM-DD 23:59:59")
							: "",
						message_content: {
							content:
								typeof content === "string" ? content : JSON.stringify(content),
							extra: {
								super_agent: {
									mentions: tiptapEditorRef.current?.mentionItems,
									input_mode: "plan",
									chat_mode: "normal",
									topic_pattern: runtimeTopicMode,
									...(allowSelectAgent &&
										agentSelection.agentCode && {
											agent_code: agentSelection.agentCode,
										}),
									model: tiptapEditorRef.current?.selectedModel,
									...(imageModel && { image_model: imageModel }),
									...(videoModel && { video_model: videoModel }),
								},
							},
						},
						plugins:
							mcpTempStorage.mcpList.length > 0
								? {
										servers: mcpTempStorage.mcpList.map((item) => ({
											id: item.id,
										})),
									}
								: undefined,
					},
					context,
				),
			)
		} catch (error) {
			const errorFields = (
				error as { errorFields?: Array<{ name: (string | number)[]; errors: string[] }> }
			).errorFields
			const firstErrorField = errorFields?.find((field) => field.errors.length > 0)
			if (firstErrorField?.name?.length) form.scrollToField(firstErrorField.name)
			if (firstErrorField?.errors?.[0]) magicToast.error(firstErrorField.errors[0])
		}
	})

	const onCancel = () => {
		form.resetFields()
		onClose?.()
	}

	useEffect(() => {
		if (initialValues) {
			timeRef.current = setTimeout(() => setLoading(false), 500)
		} else setLoading(false)
		return () => {
			if (timeRef.current) clearTimeout(timeRef.current)
			timeRef.current = null
		}
	}, [initialValues])

	useEffect(() => {
		if (loading || !initialValues?.message_content || !tiptapEditorRef.current) return
		const content = parseContent(initialValues.message_content.content)
		if (content) tiptapEditorRef.current.setContent?.(content)
		tiptapEditorRef.current.setSelectedModel?.(
			initialValues.message_content.extra?.super_agent?.model || null,
		)
		tiptapEditorRef.current.setSelectedImageModel?.(
			initialValues.message_content.extra?.super_agent?.image_model || null,
		)
		tiptapEditorRef.current.setSelectedVideoModel?.(
			initialValues.message_content.extra?.super_agent?.video_model || null,
		)
	}, [initialValues, loading])

	useUpdateEffect(() => {
		form.setFieldsValue({
			workspace_id: context.workspaceId,
			project_id: context.projectId,
			topic_id: context.topicId || undefined,
		})
		setSelectedTopic(null)
	}, [context.workspaceId, context.projectId, context.topicId])

	const handleTopicSelect = useMemoizedFn((item?: { value: string; label: string }) => {
		if (!item) {
			setSelectedTopic(null)
			return
		}
		setSelectedTopic({
			id: item.value,
			topic_name: item.label,
			user_id: "",
			chat_topic_id: "",
			chat_conversation_id: "",
			task_status: TaskStatus.WAITING,
			task_mode: "",
			project_id: context.projectId,
			topic_mode: modelTopicMode,
			updated_at: "",
			workspace_id: context.workspaceId,
			token_used: null,
		})
	})

	return (
		<div className="relative overflow-hidden" data-testid="micro-app-scheduled-tasks-modify">
			<Form
				form={form}
				layout="vertical"
				className={formClassName}
				initialValues={defaultValues}
				colon={false}
				requiredMark={customRequiredMark}
			>
				<ScrollArea viewportClassName="max-h-[calc(100dvh-12rem)]">
					<div className="p-5">
						<Form.Item
							label={t("accountPanel.timedTasks.name")}
							name="task_name"
							rules={[
								{
									required: true,
									message: resolveToString(t("form.required"), {
										label: t("accountPanel.timedTasks.name"),
									}),
								},
							]}
						>
							<Input
								data-testid="micro-app-scheduled-task-name"
								placeholder={t("accountPanel.timedTasks.namePlaceholder")}
							/>
						</Form.Item>

						<Form.Item
							label={t("accountPanel.timedTasks.prompt")}
							help={
								promptRequired
									? t("accountPanel.timedTasks.promptRequired")
									: undefined
							}
							validateStatus={promptRequired ? "error" : undefined}
						>
							<MessageEditor
								ref={tiptapEditorRef}
								className={cn(
									"rounded-md border border-border",
									promptRequired && "border-destructive",
								)}
								placeholder={tSuper("messageEditor.placeholderTask")}
								selectedTopic={selectedTopic}
								selectedProject={selectedProject}
								selectedWorkspace={selectedWorkspace}
								topicMode={modelTopicMode}
								agentCode={allowSelectAgent ? agentSelection.agentCode : undefined}
								setTopicMode={allowSelectAgent ? handleAgentChange : undefined}
								showModeToggle={allowSelectAgent || undefined}
								allowChangeMode={allowSelectAgent}
								projectFilesStore={modalStores.projectFilesStore}
								mentionPanelStore={modalStores.mentionPanelStore}
								enableAiCompletion
								attachments={attachments}
								size={isMobile ? "mobile" : "default"}
								containerClassName="border-none"
							/>
						</Form.Item>

						{!allowSelectAgent && (
							<>
								<ReadonlyContextItem
									label={tSuper("scheduleTask.projectScope")}
									value={context.projectName || context.projectId}
								/>
								<ReadonlyContextItem
									label={tSuper("scheduleTask.agentScope")}
									value={tSuper("scheduleTask.microAppAgent")}
								/>
							</>
						)}

						<ProjectTopicItem
							mode="topic"
							workspaceId={context.workspaceId}
							projectId={context.projectId}
							onSelect={handleTopicSelect}
						/>

						<Form.Item
							label={t("accountPanel.timedTasks.plan")}
							name="time_config"
							rules={[
								{
									required: true,
									message: t("accountPanel.timedTasks.planRequired"),
								},
							]}
						>
							<ScheduledItem />
						</Form.Item>

						{timeConfig?.type !== ScheduledTask.ScheduleType.Once ? (
							<div className="flex items-center gap-2">
								<Form.Item name="deadline_enabled" noStyle>
									<FormSwitch />
								</Form.Item>
								<span className="text-sm leading-4 text-foreground/80">
									{t("chat.timedTask.deadline")}
								</span>
								{deadlineEnabled ? (
									<Form.Item
										name="deadline"
										noStyle
										getValueProps={(value) => ({
											value: value && dayjs(value),
										})}
									>
										<MagicDatePicker
											format="YYYY/MM/DD"
											minDate={dayjs(minDate, "YYYY/MM/DD HH:mm")}
										/>
									</Form.Item>
								) : null}
							</div>
						) : null}
					</div>
				</ScrollArea>
				<div className={footerClassName}>
					<div className="flex items-center gap-2">
						<span>{t("accountPanel.timedTasks.enabled")}</span>
						<Form.Item
							valuePropName="checked"
							name="enabled"
							noStyle
							normalize={(value) => (value ? 1 : 0)}
						>
							<FormSwitch />
						</Form.Item>
					</div>
					<div className="flex gap-2.5">
						<Button
							type="button"
							variant="outline"
							onClick={onCancel}
							data-testid="micro-app-scheduled-task-cancel"
						>
							{t("accountPanel.timedTasks.cancel")}
						</Button>
						{/* onOk validates explicitly; native submit would invalidate that pending validation. */}
						<Button
							type="button"
							onClick={onOk}
							data-testid="micro-app-scheduled-task-submit"
						>
							{mode === "create"
								? t("accountPanel.timedTasks.create")
								: t("accountPanel.timedTasks.save")}
						</Button>
					</div>
				</div>
			</Form>
			{loading ? <div className="absolute inset-0 bg-background/50" aria-hidden /> : null}
		</div>
	)
}
