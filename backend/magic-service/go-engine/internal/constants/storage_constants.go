package constants

// 存储常量：多租户数据隔离配置

const (
	// QdrantCollectionName 架构说明：所有组织共用一个集合，通过 payload 中的 organization_code 过滤实现租户隔离
	// 原因：支持几十万组织，无法为每个组织创建单独集合
	// 参考文档：docs/long_term_memory_system.md 第 5.2 节
	QdrantCollectionName = "magic_memory"
)

const (
	// OrgIDField 组织编码字段名，用于 payload 过滤（兼容历史常量名）
	OrgIDField = "organization_code"

	// LegacyOrgIDField 兼容旧字段名
	LegacyOrgIDField = "organization_id"

	// UserIDField 用户 ID 字段名
	UserIDField = "user_id"

	// BusinessIDField 业务/事务 ID 字段名
	BusinessIDField = "business_id"
)

// Qdrant payload 中的内存分块字段名
const (
	// TextField 文本内容字段名
	TextField = "text"

	// SourceTypeField 来源类型字段名（conversation|document|file|url）
	SourceTypeField = "source_type"

	// SourceIDField 唯一来源标识字段名
	SourceIDField = "source_id"

	// ChunkIndexField 来源内分块序号字段名
	ChunkIndexField = "chunk_index"

	// TotalChunksField 分块总数字段名
	TotalChunksField = "total_chunks"

	// ModelField embedding 模型名称字段名
	ModelField = "model"

	// CreatedAtField 创建时间字段名
	CreatedAtField = "created_at"
)

// HTTP 请求字段名
const (
	// BusinessParamsField API 请求中的业务参数字段名
	BusinessParamsField = "business_params"
)
