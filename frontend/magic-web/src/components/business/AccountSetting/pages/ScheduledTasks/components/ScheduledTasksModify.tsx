import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Form } from "antd"
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react"
import { useDebounceFn, useMemoizedFn, useUpdateEffect } from "ahooks"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import dayjs from "@/infrastructure/vendors/dayjs"
import { MagicDatePicker } from "@/components/base"
import { FormSwitch } from "./FormSwitch"
import magicToast from "@/components/base/MagicToaster/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { parseContent } from "@/pages/superMagic/components/MessageList/components/Text/components/RichText/utils"
import {
	type ProjectListItem,
	type Topic,
	type Workspace,
	ProjectStatus,
	TaskStatus,
	WorkspaceStatus,
} from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import MessageEditor, { type MessageEditorRef } from "./MessageEditor"
import { ScheduledItem } from "./ScheduledItem"
import SelectItem, { type OptionItem } from "./SelectItem"
import { ScheduledTasksModifyProps, ScheduledTasksModifyRef } from "../types/ScheduledTasksModify"
import { ScheduledTask } from "@/types/scheduledTask"
import { useAttachments } from "../hooks/useAttachments"
import mcpTempStorage from "../store/MCPTempStorage"
import { FormValues } from "../types"
import { getNextRunTime, serializeScheduledTaskModel } from "../utils"
import ProjectTopicItem from "./ProjectTopicItem"
import { reaction } from "mobx"
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

const descTextClassName = "break-words text-xs leading-4 text-foreground/35"
const requiredMarkClassName = "ml-1 text-destructive"
const footerClassName =
	"flex items-center justify-between gap-2.5 border-t border-border px-5 py-3.5"
const promptFormItemClassName =
	"[&_.magic-form-item-label>label]:w-full [&_.magic-form-item-label>label]:after:hidden [&_.magic-form-item-label>label>div]:flex-1"

export const ScheduledTasksModify = forwardRef<ScheduledTasksModifyRef, ScheduledTasksModifyProps>(
	function ScheduledTasksModify({ initialValues, onSubmit, onClose, mode }, ref) {
		const { t } = useTranslation("interface")
		const { t: tSuper } = useTranslation("super")
		const isMobile = useIsMobile()
		const tiptapEditorRef = useRef<MessageEditorRef>(null)
		const timeRef = useRef<NodeJS.Timeout | null>(null)
		const isSubmittingRef = useRef(false)
		const [form] = Form.useForm<ScheduledTask.UpdateTask>()
		const [loading, setLoading] = useState(mode === "edit" || !!initialValues)
		const [submitting, setSubmitting] = useState(false)
		const [promptRequired, setPromptRequired] = useState(false)
		const [topicMode, setTopicMode] = useState<TopicMode>(
			() => resolveDefaultAgentSelection().modeIdentifier as TopicMode,
		)
		const [agentCode, setAgentCode] = useState<string>()
		const [agentValidationTick, setAgentValidationTick] = useState(0)
		const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
		const [selectedProject, setSelectedProject] = useState<ProjectListItem | null>(null)
		const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)

		const workspaceId = Form.useWatch("workspace_id", form)
		const projectId = Form.useWatch("project_id", form)
		const projectEnabled = Form.useWatch("project_enabled", form)
		const deadlineEnabled = Form.useWatch("deadline_enabled", form)
		const timeConfig = Form.useWatch("time_config", form)

		const { attachments, updateAttachments } = useAttachments({
			projectId: projectId || initialValues?.project_id,
			selectedProject,
			mode,
		})

		useImperativeHandle(
			ref,
			() => ({
				updateAttachments,
			}),
			[updateAttachments],
		)

		const minDate = useMemo(() => {
			if (!timeConfig) return
			return getNextRunTime(timeConfig)
		}, [timeConfig])

		const defaultValues: Partial<FormValues> = {
			message_type: "text",
			time_config: {
				type: ScheduledTask.ScheduleType.Once,
				day: dayjs().format("YYYY-MM-DD"),
				time: dayjs().add(1, "hour").set("minute", 0).format("HH:mm"),
			},
			enabled: 1,
			message_content: {
				content: {},
			},
			...initialValues,
			deadline_enabled: !!initialValues?.deadline,
			project_enabled: initialValues?.project_id !== "0",
			topic_enabled: initialValues?.topic_id !== "0",
			project_id: initialValues?.project_id === "0" ? undefined : initialValues?.project_id,
			topic_id: initialValues?.topic_id === "0" ? undefined : initialValues?.topic_id,
		}

		const promptErrorMessage = promptRequired
			? t("accountPanel.timedTasks.promptRequired")
			: undefined

		const isAgentUnavailable = useMemo(() => {
			// Recompute availability when the external mode service publishes a refresh.
			void agentValidationTick
			if (superMagicModeService.modeList.length === 0) return false

			return !isAgentSelectionAvailable(topicMode, agentCode)
		}, [topicMode, agentCode, agentValidationTick])

		const agentUnavailableMessage = isAgentUnavailable
			? t("accountPanel.timedTasks.agentUnavailable")
			: undefined

		const customRequiredMark = (label: ReactNode, { required }: { required: boolean }) => (
			<div className="flex items-center gap-1">
				{label}
				{required ? <span className={requiredMarkClassName}>*</span> : null}
			</div>
		)

		const submitTask = useMemoizedFn(async () => {
			if (isSubmittingRef.current) return

			isSubmittingRef.current = true
			setSubmitting(true)

			try {
				if (isAgentUnavailable) {
					magicToast.error(t("accountPanel.timedTasks.agentUnavailable"))
					return
				}

				const values = await form.validateFields()
				if (!tiptapEditorRef.current?.editor?.getText()) {
					setPromptRequired(true)
					magicToast.error(t("accountPanel.timedTasks.promptRequired"))
					return
				}

				setPromptRequired(false)
				const content = tiptapEditorRef.current?.editor?.getJSON() ?? {}
				const selection = resolveAgentSelection(topicMode, agentCode)
				const imageModel = serializeScheduledTaskModel(
					tiptapEditorRef.current?.selectedImageModel,
				)
				const videoModel = serializeScheduledTaskModel(
					tiptapEditorRef.current?.selectedVideoModel,
				)
				const messageContent = {
					content: typeof content === "string" ? content : JSON.stringify(content),
					extra: {
						super_agent: {
							mentions: tiptapEditorRef.current?.mentionItems,
							input_mode: "plan",
							chat_mode: "normal",
							topic_pattern: selection.topicPattern,
							...(selection.agentCode && { agent_code: selection.agentCode }),
							model: tiptapEditorRef.current?.selectedModel,
							...(imageModel && { image_model: imageModel }),
							...(videoModel && { video_model: videoModel }),
						},
					},
				}

				await onSubmit?.({
					task_name: values.task_name,
					workspace_id: values.workspace_id,
					project_id: values.project_id ?? "",
					topic_id: values.topic_id ?? "",
					time_config: values.time_config,
					enabled: values.enabled,
					message_type: "rich_text",
					deadline: values.deadline
						? dayjs(values.deadline).format("YYYY-MM-DD 23:59:59")
						: "",
					message_content: messageContent,
					plugins: {
						servers: mcpTempStorage.mcpList.map((item) => ({
							id: item.id,
						})),
					},
				})
			} catch (error) {
				const errorFields = (
					error as {
						errorFields?: Array<{ name: (string | number)[]; errors: string[] }>
					}
				).errorFields
				const firstErrorField = errorFields?.find((field) => field.errors.length > 0)
				if (firstErrorField?.name?.length) form.scrollToField(firstErrorField.name)
				if (firstErrorField?.errors?.[0]) magicToast.error(firstErrorField.errors[0])
			} finally {
				isSubmittingRef.current = false
				setSubmitting(false)
			}
		})

		const { run: onOk } = useDebounceFn(submitTask, {
			wait: 300,
			leading: true,
			trailing: false,
		})

		function onCancel() {
			form.resetFields()
			onClose?.()
		}

		useEffect(() => {
			if (mode === "edit" || initialValues) {
				timeRef.current = setTimeout(() => {
					setLoading(false)
				}, 500)
			} else {
				setLoading(false)
			}

			return () => {
				if (!timeRef.current) return
				clearTimeout(timeRef.current)
				timeRef.current = null
			}
		}, [initialValues, mode])

		useEffect(() => {
			if (mode === "edit" || initialValues) return

			return reaction(
				() => resolveDefaultAgentSelection().modeIdentifier,
				(modeIdentifier) => setTopicMode(modeIdentifier as TopicMode),
			)
		}, [initialValues, mode])

		useEffect(() => {
			return reaction(
				() => superMagicModeService.modeList.length,
				() => setAgentValidationTick((tick) => tick + 1),
			)
		}, [])

		useEffect(() => {
			if (loading || !tiptapEditorRef.current || !initialValues?.message_content) return
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
			const initialTopicPattern = initialValues.message_content.extra?.super_agent
				?.topic_pattern as TopicMode | undefined
			const initialAgentCode =
				initialValues.message_content.extra?.super_agent?.agent_code?.trim() || undefined
			const selection = resolveAgentSelection(initialTopicPattern, initialAgentCode)
			setAgentCode(selection.agentCode)
			setTopicMode(selection.modeIdentifier as TopicMode)
		}, [initialValues, loading])

		useUpdateEffect(() => {
			if (workspaceId === initialValues?.workspace_id) return
			const currentProjectId = form.getFieldValue("project_id")
			const currentTopicId = form.getFieldValue("topic_id")

			if (workspaceId && (currentProjectId || currentTopicId)) {
				form.setFieldsValue({
					project_id: undefined,
					topic_id: undefined,
				})
				setSelectedProject(null)
				setSelectedTopic(null)
			}
		}, [workspaceId])

		useUpdateEffect(() => {
			const currentTopicId = form.getFieldValue("topic_id")
			if (
				projectId === initialValues?.project_id &&
				currentTopicId === initialValues?.topic_id
			)
				return

			if (projectId && currentTopicId) {
				form.setFieldsValue({
					topic_id: undefined,
				})
				setSelectedTopic(null)
			}
		}, [projectId])

		const handleWorkspaceSelect = useMemoizedFn((item?: OptionItem) => {
			if (!item) {
				setSelectedWorkspace(null)
				return
			}

			setSelectedWorkspace({
				id: item.value,
				name: item.label,
				is_archived: 0,
				current_topic_id: "",
				current_project_id: null,
				workspace_status: WorkspaceStatus.WAITING,
				project_count: 0,
				workspace_type: "default",
			})
		})

		const handleProjectSelect = useMemoizedFn((item?: OptionItem) => {
			if (!item) {
				setSelectedProject(null)
				return
			}

			setSelectedProject({
				id: item.value,
				project_name: item.label,
				project_status: ProjectStatus.WAITING,
				project_mode: topicMode,
				workspace_id: workspaceId ?? "",
				work_dir: "",
				workspace_name: selectedWorkspace?.name ?? "",
				current_topic_id: "",
				current_topic_status: "",
				created_at: "",
				updated_at: "",
				tag: "",
			})
		})

		const handleTopicSelect = useMemoizedFn((item?: OptionItem) => {
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
				project_id: projectId ?? "",
				topic_mode: topicMode,
				updated_at: "",
				workspace_id: workspaceId ?? "",
				token_used: null,
			})
		})

		const handleTopicModeChange = useMemoizedFn((nextMode: TopicMode) => {
			setTopicMode(nextMode)
			setAgentCode(undefined)
		})

		return (
			<div className="relative overflow-hidden" data-testid="scheduled-tasks-modify">
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
									data-testid="scheduled-task-name"
									// Match the mobile task form typography with the other 14px controls.
									className={isMobile ? "text-sm" : undefined}
									placeholder={t("accountPanel.timedTasks.namePlaceholder")}
								/>
							</Form.Item>

							<Form.Item
								label={
									<div className="flex flex-1 items-center justify-between gap-5">
										<div className="shrink-0">
											<span>{t("accountPanel.timedTasks.prompt")}</span>
											<span className={requiredMarkClassName}>*</span>
										</div>
										<span className={descTextClassName}>
											{t("accountPanel.timedTasks.supportMention")}
										</span>
									</div>
								}
								className={promptFormItemClassName}
								validateStatus={
									promptRequired
										? "error"
										: isAgentUnavailable
											? "warning"
											: undefined
								}
								help={promptErrorMessage || agentUnavailableMessage}
							>
								<MessageEditor
									ref={tiptapEditorRef}
									className={cn(
										"rounded-md border border-border",
										// Target ProseMirror directly so typography styles cannot restore the 13px mobile variant.
										isMobile &&
											"text-sm leading-5 [&_.ProseMirror]:!text-sm [&_.ProseMirror]:!leading-5",
										promptRequired && "border-destructive",
									)}
									placeholder={tSuper("messageEditor.placeholderTask")}
									selectedTopic={selectedTopic}
									selectedProject={selectedProject}
									selectedWorkspace={selectedWorkspace}
									topicMode={topicMode}
									agentCode={agentCode}
									setTopicMode={handleTopicModeChange}
									showModeToggle
									enableAiCompletion
									allowChangeMode
									modeToggleMobilePosition="bottom"
									attachments={attachments}
									size={isMobile ? "mobile" : "default"}
									containerClassName="border-none"
								/>
							</Form.Item>

							<Form.Item
								label={t("accountPanel.timedTasks.workspace")}
								name="workspace_id"
								required
								rules={[
									{
										required: true,
										message: resolveToString(t("form.required"), {
											label: t("accountPanel.timedTasks.workspace"),
										}),
									},
								]}
							>
								<SelectItem type="workspace" onSelect={handleWorkspaceSelect} />
							</Form.Item>

							<ProjectTopicItem
								mode="project"
								workspaceId={workspaceId}
								onSelect={handleProjectSelect}
							/>

							{projectEnabled ? (
								<ProjectTopicItem
									mode="topic"
									workspaceId={workspaceId}
									projectId={projectId}
									autoSelectFirstOption={isMobile && mode === "create"}
									onSelect={handleTopicSelect}
								/>
							) : null}

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
								variant="outline"
								onClick={onCancel}
								data-testid="scheduled-task-cancel"
							>
								{t("accountPanel.timedTasks.cancel")}
							</Button>
							<Button
								onClick={onOk}
								disabled={isAgentUnavailable || submitting}
								data-testid="scheduled-task-submit"
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
	},
)
