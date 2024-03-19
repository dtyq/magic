export enum customNodeType {
	// 开始
	Start = "1",
	// 大模型
	LLM = "2",
	// 消息回复
	ReplyMessage = "3",
	// 选择器
	If = "4",
	// 代码
	Code = "5",
	// 数据加载
	Loader = "8",
	// HTTP请求
	HTTP = "10",
	// 子流程
	Sub = "11",
	// 结束
	End = "12",
	// 历史消息查询
	MessageSearch = "13",
	// 文本切割
	TextSplit = "14",
	// 意图识别
	IntentionRecognition = "24",
	// 向量存储（知识库片段存储）
	VectorStorage = "16",
	// 向量搜索（相似度匹配）
	VectorSearch = "17",
	// 向量删除（片段删除）
	VectorDelete = "27",
	// 数据设置
	CacheSetter = "18",
	// 数据读取
	CacheGetter = "19",
	// 消息记忆存储
	MessageMemory = "20",
	// 变量 - 变量保存
	VariableSave = "21",
	// 变量 - 从数组变量中弹出第一个值
	// VariableArrayPop = "22",
	// 变量 - 往数组变量中推入一个值
	// VariableArrayPush = "23",
	// 循环节点
	Loop = "30",
	// 循环体节点
	LoopBody = "31",
	// 循环结束节点
	LoopEnd = "32",
	// 人员检索
	SearchUsers = "28",
	// 等待消息节点
	WaitForReply = "29",
	// 知识检索节点
	KnowledgeSearch = "44",
	// 委托节点
	Agent = "50",
	// 电子表格解析节点
	Excel = "51",
	// 工具节点
	Tools = "26",
	// 向量知识库 / 匹配数据库
	VectorDatabaseMatch = "52",
	// 文生图节点
	Text2Image = "53",
	// 群聊节点
	GroupChat = "54",
	// 特殊节点：快捷指令节点
	Instructions = "1001",
}

export const MAGIC_FLOW_ID_PREFIX = "MAGIC-FLOW-"

// 需要动态生成output的节点
export const DynamicOutputNodeTypes = [
	customNodeType.Code,
	customNodeType.VariableSave,
	customNodeType.Sub,
]

// 当前话题
export const KnowledgeCurrentTopic = "knowledge_user_current_topic"
// 当前会话
export const KnowledgeCurrentConversation = "knowledge_user_current_conversation"

export const OmitNodeKeys = [
	"data",
	"expandParent",
	"extent",
	"parentId",
	"deletable",
	"position",
	"step",
	"zIndex",
	"type",
]
