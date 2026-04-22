package constants

// 知识库存储常量：共享集合配置。
const (
	// 所有知识库共享一个集合，通过 payload 过滤实现隔离。
	KnowledgeBaseCollectionName = "magic_knowledge"

	// KnowledgeBaseCollectionMetaCode 是保留的集合元数据记录编码。
	KnowledgeBaseCollectionMetaCode = "__qdrant_collection_meta__"

	// KnowledgeBaseCollectionMetaName 是保留元数据记录名称。
	KnowledgeBaseCollectionMetaName = "__qdrant_collection_meta__"

	// KnowledgeBaseCollectionMetaDescription 是保留元数据记录描述。
	KnowledgeBaseCollectionMetaDescription = "__qdrant_collection_meta__"

	// KnowledgeBaseCollectionMetaOrganizationCode 是保留元数据记录组织编码。
	KnowledgeBaseCollectionMetaOrganizationCode = "__qdrant_collection_meta__"

	// KnowledgeBaseCollectionMetaVectorDB 固定为线上向量库类型标识。
	KnowledgeBaseCollectionMetaVectorDB = "odin_qdrant"

	// 知识库编码字段名。
	KnowledgeCodeField = "knowledge_code"

	// 组织编码字段名。
	OrganizationCodeField = "organization_code"

	// 文档编码字段名。
	DocumentCodeField = "document_code"

	// KnowledgeBaseSourceTypeLegacyLocalFile 表示旧 flow 向量知识库的本地文件来源。
	KnowledgeBaseSourceTypeLegacyLocalFile = 1

	// KnowledgeBaseSourceTypeLegacyEnterpriseWiki 表示旧 flow 向量知识库的企业知识库来源。
	KnowledgeBaseSourceTypeLegacyEnterpriseWiki = 1001

	// KnowledgeBaseSourceTypeDigitalEmployeeLocalFile 表示数字员工知识库的本地文件来源。
	KnowledgeBaseSourceTypeDigitalEmployeeLocalFile = 1

	// KnowledgeBaseSourceTypeDigitalEmployeeCustomContent 表示数字员工知识库的自定义内容来源。
	KnowledgeBaseSourceTypeDigitalEmployeeCustomContent = 2

	// KnowledgeBaseSourceTypeDigitalEmployeeProject 表示数字员工知识库的项目文件来源。
	KnowledgeBaseSourceTypeDigitalEmployeeProject = 3

	// KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki 表示数字员工知识库的企业知识库来源。
	KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki = 4

	// KnowledgeBaseSourceTypeLocalFile 保留旧名称，表示旧向量知识库的本地文件来源默认值。
	KnowledgeBaseSourceTypeLocalFile = KnowledgeBaseSourceTypeLegacyLocalFile

	// KnowledgeBaseSourceTypeCustomContent 保留旧名称，表示数字员工知识库的自定义内容来源。
	KnowledgeBaseSourceTypeCustomContent = KnowledgeBaseSourceTypeDigitalEmployeeCustomContent

	// KnowledgeBaseSourceTypeProject 保留旧名称，表示数字员工知识库的项目文件来源。
	KnowledgeBaseSourceTypeProject = KnowledgeBaseSourceTypeDigitalEmployeeProject

	// KnowledgeBaseSourceTypeEnterpriseWiki 保留旧名称，表示数字员工知识库的企业知识库来源。
	KnowledgeBaseSourceTypeEnterpriseWiki = KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki

	// KnowledgeBaseSourceTypeStaffLocalFile 保留旧名称，兼容旧代码引用。
	KnowledgeBaseSourceTypeStaffLocalFile = KnowledgeBaseSourceTypeDigitalEmployeeLocalFile

	// KnowledgeBaseSourceTypeStaffCustomContent 保留旧名称，兼容旧代码引用。
	KnowledgeBaseSourceTypeStaffCustomContent = KnowledgeBaseSourceTypeDigitalEmployeeCustomContent

	// KnowledgeBaseSourceTypeStaffProject 保留旧名称，兼容旧代码引用。
	KnowledgeBaseSourceTypeStaffProject = KnowledgeBaseSourceTypeDigitalEmployeeProject

	// KnowledgeBaseSourceTypeStaffEnterpriseWiki 保留旧名称，兼容旧代码引用。
	KnowledgeBaseSourceTypeStaffEnterpriseWiki = KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki
)

// IsValidKnowledgeBaseSourceType 判断知识库来源类型是否有效。
func IsValidKnowledgeBaseSourceType(sourceType int) bool {
	switch sourceType {
	case KnowledgeBaseSourceTypeLegacyLocalFile,
		KnowledgeBaseSourceTypeLegacyEnterpriseWiki,
		KnowledgeBaseSourceTypeDigitalEmployeeCustomContent,
		KnowledgeBaseSourceTypeDigitalEmployeeProject,
		KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki:
		return true
	default:
		return false
	}
}
