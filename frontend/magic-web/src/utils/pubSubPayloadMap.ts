import { PubSubEvents } from "./pubsub"
import type {
	SuperMagicChangePreviewFileVersionArgs,
	SuperMagicEnterEditModeArgs,
	SuperMagicInsertDragDataToEditorArgs,
	SuperMagicLocateFileInTreeArgs,
	SuperMagicUpdateActiveFileIdArgs,
	SuperMagicUpdateAttachmentsArgs,
	SuperMagicUpdateAttachmentsLoadingArgs,
} from "@/pages/superMagic/events/files"
import type {
	SuperMagicGuideTourElementReadyArgs,
	SuperMagicGuideTourHTMLElementReadyArgs,
} from "@/pages/superMagic/events/guideTour"
import type {
	SuperMagicClearCanvasMarkersPayload,
	SuperMagicMarkerDataUpdatedPayload,
	SuperMagicMarkerRemovedPayload,
	SuperMagicMarkersSyncedToManagerPayload,
	SuperMagicFocusCanvasElementPayload,
	SuperMagicQueueConsumedArgs,
} from "@/pages/superMagic/events/markers"
import type {
	SuperMagicAddContentToChatPayload,
	SuperMagicAddFileToChatPayload,
	SuperMagicInsertMarkerToChatPayload,
	SuperMagicMessageRegisterProgrammaticScrollArgs,
	SuperMagicMessageScrollToBottomArgs,
	SuperMagicNewMessageArgs,
	SuperMagicReceiveRecordSummaryAudioFileArgs,
	SuperMagicReEditMessageArgs,
	SuperMagicSendInterruptMessageArgs,
	SuperMagicSendMessageByContentArgs,
	SuperMagicSetContentWhenSlideAddedArgs,
	SuperMagicSetDemoTextToInputArgs,
	SuperMagicSetInputMessageArgs,
	SuperMagicStreamMessageArgs,
	SuperMagicSyncMarkersToChatPayload,
} from "@/pages/superMagic/events/message"
import type { SuperMagicOpenFileTabPayload } from "@/pages/superMagic/events/openFileTab"
import type { SuperMagicOpenPlaybackTabPayload } from "@/pages/superMagic/events/openPlaybackTab"
import type {
	SuperMagicAddTopicArgs,
	SuperMagicReceiveSharedProjectModePayload,
	SuperMagicRefreshShareListArgs,
	SuperMagicTopicModeChangedPayload,
	SuperMagicUpdateAutoDetailArgs,
	SuperMagicUpdateProjectNameArgs,
} from "@/pages/superMagic/events/project"
import type {
	SuperMagicExitFullscreenArgs,
	SuperMagicFolderClickArgs,
	SuperMagicMaximizeFileArgs,
	SuperMagicSwitchDetailModeArgs,
	SuperMagicUpdateAgentsArgs,
} from "@/pages/superMagic/events/ui"
import type {
	SuperMagicPlaybackEndPayload,
	SuperMagicPlaybackStartArgs,
} from "@/pages/superMagic/events/playback"
import type { SeqResponse } from "@/types/request"
import type { SuperMagicFileChangeMessage } from "@/types/chat/intermediate_message"

/**
 * 全局事件名 → 参数类型映射。
 *
 * 规则：
 * 1. 顺序必须与 PubSubEvents 中的事件注册顺序保持一致，方便维护和对照
 * 2. 只登记已经确认真实 contract 的事件
 * 3. 未登记到 map 的 PubSubEvents 常量视为遗留/保留事件，不能直接用于 publish/subscribe
 * 4. 映射值既可以是单 payload，也可以是参数元组
 */
export interface PubSubTypedPayloadMap {
	/** 展示快捷键列表：无参数，只约束为零参事件。 */
	[PubSubEvents.Show_Shortcut_Keys]: []
	/** 打开 MCP 配置弹窗：无参数。 */
	[PubSubEvents.Open_MCP_Config]: []
	/** 触发语音输入开关：无参数。 */
	[PubSubEvents.Toggle_Voice_Input]: []
	/** 更新项目名称：传入项目 ID 与项目名称。 */
	[PubSubEvents.Update_Project_Name]: SuperMagicUpdateProjectNameArgs
	/** 刷新话题消息：无参数。 */
	[PubSubEvents.Refresh_Topic_Messages]: []
	/** 终止并撤销消息：无参数。 */
	[PubSubEvents.Interrupt_And_Undo_Message]: []
	/** 关闭所有下拉菜单：无参数。 */
	[PubSubEvents.Close_All_Dropdowns]: []
	/** 隐藏已撤销消息：无参数。 */
	[PubSubEvents.Hide_Revoked_Messages]: []
	/** 显示已撤销消息：无参数。 */
	[PubSubEvents.Show_Revoked_Messages]: []
	/** 更改预览文件：当前无参数。 */
	[PubSubEvents.Change_Preview_File]: []
	/** 更改预览文件版本：传入文件 ID 与目标版本。 */
	[PubSubEvents.Change_Preview_File_Version]: SuperMagicChangePreviewFileVersionArgs
	/** 工作区/项目引导元素就绪：传入元素 ID。 */
	[PubSubEvents.GuideTourElementReady]: SuperMagicGuideTourElementReadyArgs
	/** HTML 引导元素就绪：传入元素 ID。 */
	[PubSubEvents.GuideTourHTMLElementReady]: SuperMagicGuideTourHTMLElementReadyArgs
	/** 定时任务更新完成：无参数。 */
	[PubSubEvents.SCHEDULED_TASK_UPDATED]: []
	/** 消息列表滚动到底部：传入可选滚动配置。 */
	[PubSubEvents.Message_Scroll_To_Bottom]: SuperMagicMessageScrollToBottomArgs
	/** 注册一次程序滚动：传入可选持续时间。 */
	[PubSubEvents.Message_Register_Programmatic_Scroll]: SuperMagicMessageRegisterProgrammaticScrollArgs
	/** 用户交互引起的内容高度变化，临时抑制自动滚底：零参数。 */
	[PubSubEvents.Message_Suppress_Auto_Scroll]: []
	/** 更新当前激活文件 ID：传入文件 ID。 */
	[PubSubEvents.Update_Active_File_Id]: SuperMagicUpdateActiveFileIdArgs
	/** 在文件树中定位文件：传入文件 ID。 */
	[PubSubEvents.Locate_File_In_Tree]: SuperMagicLocateFileInTreeArgs
	/** 重新编辑消息：传入待恢复的内容与 mentions。 */
	[PubSubEvents.Re_Edit_Message]: SuperMagicReEditMessageArgs
	/** 打开文件 tab：传入标准文件打开 payload。 */
	[PubSubEvents.Open_File_Tab]: SuperMagicOpenFileTabPayload
	/** 打开 playback tab：当前保留历史透传 payload。 */
	[PubSubEvents.Open_Playback_Tab]: SuperMagicOpenPlaybackTabPayload
	/** 消息队列消费完成：传入可选消息数据。 */
	[PubSubEvents.SuperMagicMessageQueueConsumed]: SuperMagicQueueConsumedArgs
	/** Intermediate 文件变更：传入完整 seq，订阅方自行解析。 */
	[PubSubEvents.Super_Magic_File_Change_Intermediate]: [
		payload: SeqResponse<SuperMagicFileChangeMessage>,
	]
	/** 通过外部消息内容直接发送消息：传入发送内容 payload。 */
	[PubSubEvents.Send_Message_by_Content]: SuperMagicSendMessageByContentArgs
	/** 附件加载状态变化：传入 loading 布尔值。 */
	[PubSubEvents.Update_Attachments_Loading]: SuperMagicUpdateAttachmentsLoadingArgs
	/** 请求刷新附件：可选附带回调。 */
	[PubSubEvents.Update_Attachments]: SuperMagicUpdateAttachmentsArgs
	/** 进入文件全选：无参数。 */
	[PubSubEvents.Select_All_Files]: []
	/** 取消文件全选：无参数。 */
	[PubSubEvents.Deselect_All_Files]: []
	/** 取消文件选择模式：无参数。 */
	[PubSubEvents.Cancel_File_Selection]: []
	/** 更新自动详情：约束为单个 detail 参数，消费方自行收窄。 */
	[PubSubEvents.Super_Magic_Update_Auto_Detail]: SuperMagicUpdateAutoDetailArgs
	/** 新消息到达：传入当前订阅方依赖的最小消息结构。 */
	[PubSubEvents.Super_Magic_New_Message_V2]: SuperMagicNewMessageArgs
	/** 创建新话题：无参数。 */
	[PubSubEvents.Create_New_Topic]: []
	/** 接收录音总结音频文件：传入标准音频 mention payload。 */
	[PubSubEvents.Receive_RecordSummary_Audio_File]: SuperMagicReceiveRecordSummaryAudioFileArgs
	/** 设置输入框文本：传入字符串消息。 */
	[PubSubEvents.Set_Input_Message]: SuperMagicSetInputMessageArgs
	/** 添加内容到聊天框：传入可选内容与额外信息。 */
	[PubSubEvents.Add_Content_To_Chat]: SuperMagicAddContentToChatPayload
	/** 进入编辑状态：传入目标文件 ID。 */
	[PubSubEvents.Enter_Edit_Mode]: SuperMagicEnterEditModeArgs
	/** 在光标处插入单个或多个 marker 到聊天。 */
	[PubSubEvents.Super_Magic_Insert_Marker_To_Chat]: SuperMagicInsertMarkerToChatPayload
	/** 批量同步 markers 到聊天框。 */
	[PubSubEvents.Super_Magic_Sync_Markers_To_Chat]: SuperMagicSyncMarkersToChatPayload
	/** marker 数据更新：同步 suggestion / loading / result 等状态。 */
	[PubSubEvents.Super_Magic_Marker_Data_Updated]: SuperMagicMarkerDataUpdatedPayload
	/** marker 删除：同步来源与 designProjectId。 */
	[PubSubEvents.Super_Magic_Marker_Removed]: SuperMagicMarkerRemovedPayload
	/** Manager 同步 marker 到画布：传入 designProjectId。 */
	[PubSubEvents.Super_Magic_Markers_Synced_To_Manager]: SuperMagicMarkersSyncedToManagerPayload
	/** 清空画布 marker：传入可选原因。 */
	[PubSubEvents.Super_Magic_Clear_Canvas_Markers]: SuperMagicClearCanvasMarkersPayload
	/** 聚焦画布元素：传入画布 ID、元素 ID 列表与聚焦配置。 */
	[PubSubEvents.Super_Magic_Focus_Canvas_Element]: SuperMagicFocusCanvasElementPayload
	/** 话题模式变化：传入模式、工作区 ID、项目 ID。 */
	[PubSubEvents.Super_Magic_Topic_Mode_Changed]: SuperMagicTopicModeChangedPayload
	/** 接收 app 分享的话题模式：传入模式与 agent_code。 */
	[PubSubEvents.Super_Magic_Receive_Shared_Project_Mode]: SuperMagicReceiveSharedProjectModePayload
	/** 刷新分享列表：传入刷新类型。 */
	[PubSubEvents.Refresh_Share_List]: SuperMagicRefreshShareListArgs
	/** 详情页刷新：无参数。 */
	[PubSubEvents.Super_Magic_Detail_Refresh]: []
	/** 追加建议文本到输入框末尾：传入建议文本。 */
	[PubSubEvents.Append_Suggestion_To_Editor]: [text: string]
	/** 幻灯片添加后设置编辑器内容。 */
	[PubSubEvents.Set_Content_When_Slide_Added]: SuperMagicSetContentWhenSlideAddedArgs
	/** 设置 demo 文本到输入框：传入字符串文本。 */
	[PubSubEvents.Set_Demo_Text_To_Input]: SuperMagicSetDemoTextToInputArgs
	/** 触发知识库列表轮询：零参数。 */
	[PubSubEvents.Trigger_Knowledge_List_Polling]: []
	/** 触发文档列表轮询：零参数。 */
	[PubSubEvents.Trigger_Document_List_Polling]: []
	/** 添加文件到聊天输入框：传入标准文件 mention payload。 */
	[PubSubEvents.Add_File_To_Chat]: SuperMagicAddFileToChatPayload
	/** 发送打断消息：可选回调，打断完成后执行。 */
	[PubSubEvents.Send_Interrupt_Message]: SuperMagicSendInterruptMessageArgs
	/** 触发创建新话题：零参数。 */
	[PubSubEvents.Trigger_Create_Topic]: []
	/** 添加话题到列表：传入新建的话题对象。 */
	[PubSubEvents.Add_Topic]: SuperMagicAddTopicArgs
	/** WebSocket 流式原始消息：传入 RawMessage。 */
	[PubSubEvents.Stream_Message]: SuperMagicStreamMessageArgs
	/** 退出全屏：零参数。 */
	[PubSubEvents.Exit_Fullscreen]: SuperMagicExitFullscreenArgs
	/** 文件详情区最大化：零参数。 */
	[PubSubEvents.Maximize_File]: SuperMagicMaximizeFileArgs
	/** 切换详情面板模式：传入 "files" 或 "single"。 */
	[PubSubEvents.Switch_Detail_Mode]: SuperMagicSwitchDetailModeArgs
	/** 刷新 Agent 列表：零参数。 */
	[PubSubEvents.Update_Agents]: SuperMagicUpdateAgentsArgs
	/** 分享页文件夹点击：零参数。 */
	[PubSubEvents.Folder_Click]: SuperMagicFolderClickArgs
	/** Playback 开始播放：零参数。 */
	[PubSubEvents.Playback_Start]: SuperMagicPlaybackStartArgs
	/** Playback 播放结束：传入进度数据与话题 ID。 */
	[PubSubEvents.Playback_End]: SuperMagicPlaybackEndPayload
	/** 外部/原生层将拖拽数据投入消息编辑器：传入拖拽数据，消费方自行收窄。 */
	[PubSubEvents.Insert_Drag_Data_To_Editor]: SuperMagicInsertDragDataToEditorArgs
}
