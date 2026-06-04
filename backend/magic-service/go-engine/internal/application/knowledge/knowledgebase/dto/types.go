// Package dto 定义 knowledgebase application 子域对外暴露的 DTO。
package dto

import confighelper "magic/internal/application/knowledge/helper/config"

// KnowledgeBaseDTO 表示知识库应用服务输出。
type KnowledgeBaseDTO struct {
	ID                int64                                 `json:"id"`
	Code              string                                `json:"code"`
	Name              string                                `json:"name"`
	Description       string                                `json:"description"`
	Type              int                                   `json:"type"`
	Enabled           bool                                  `json:"enabled"`
	BusinessID        string                                `json:"business_id"`
	OrganizationCode  string                                `json:"organization_code"`
	Creator           string                                `json:"creator"`
	Modifier          string                                `json:"modifier"`
	CreatedUID        string                                `json:"created_uid"`
	UpdatedUID        string                                `json:"updated_uid"`
	SyncStatus        int                                   `json:"sync_status"`
	SyncStatusMessage string                                `json:"sync_status_message"`
	Model             string                                `json:"model"`
	VectorDB          string                                `json:"vector_db"`
	FragmentCount     int                                   `json:"fragment_count"`
	ExpectedCount     int                                   `json:"expected_count"`
	CompletedCount    int                                   `json:"completed_count"`
	ExpectedNum       int                                   `json:"expected_num"`
	CompletedNum      int                                   `json:"completed_num"`
	WordCount         int                                   `json:"word_count"`
	UserOperation     int                                   `json:"user_operation"`
	Icon              string                                `json:"icon"`
	RetrieveConfig    *confighelper.RetrieveConfigDTO       `json:"retrieve_config"`
	FragmentConfig    *confighelper.FragmentConfigOutputDTO `json:"fragment_config"`
	EmbeddingConfig   *confighelper.EmbeddingConfig         `json:"embedding_config"`
	SourceType        *int                                  `json:"source_type,omitempty"`
	SourceBindings    []SourceBindingDTO                    `json:"source_bindings,omitempty"`
	KnowledgeBaseType string                                `json:"knowledge_base_type"`
	AgentCodes        []string                              `json:"agent_codes,omitempty"`
	BindingEnabled    *bool                                 `json:"binding_enabled,omitempty"`
	OriginEnabled     *bool                                 `json:"origin_enabled,omitempty"`
	CreatedAt         string                                `json:"created_at"`
	UpdatedAt         string                                `json:"updated_at"`
}

// SourceBindingTargetDTO 表示来源绑定的精确选择项输出。
type SourceBindingTargetDTO struct {
	TargetType string `json:"target_type"`
	TargetRef  string `json:"target_ref"`
}

// SourceBindingDTO 表示知识库来源绑定输出。
type SourceBindingDTO struct {
	Provider      string                   `json:"provider"`
	RootType      string                   `json:"root_type"`
	RootRef       string                   `json:"root_ref"`
	WorkspaceID   *int64                   `json:"workspace_id,omitempty"`
	WorkspaceType *string                  `json:"workspace_type,omitempty"`
	SyncMode      string                   `json:"sync_mode"`
	Enabled       bool                     `json:"enabled"`
	SyncConfig    map[string]any           `json:"sync_config,omitempty"`
	Targets       []SourceBindingTargetDTO `json:"targets,omitempty"`
}

// SourceBindingTargetInput 表示来源绑定的精确选择项。
type SourceBindingTargetInput struct {
	TargetType string
	TargetRef  string
}

// SourceBindingInput 表示知识库来源绑定输入。
type SourceBindingInput struct {
	Provider   string
	RootType   string
	RootRef    string
	SyncMode   string
	Enabled    *bool
	SyncConfig map[string]any
	Targets    []SourceBindingTargetInput
}

// LegacyDocumentFileInput 表示 legacy document_files 原始输入。
type LegacyDocumentFileInput map[string]any

// SourceBindingNode 表示来源绑定选择器统一节点。
type SourceBindingNode struct {
	NodeType    string         `json:"node_type"`
	NodeRef     string         `json:"node_ref"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	HasChildren bool           `json:"has_children"`
	Selectable  bool           `json:"selectable"`
	Meta        map[string]any `json:"meta"`
}

// ListSourceBindingNodesInput 表示来源绑定节点查询输入。
type ListSourceBindingNodesInput struct {
	OrganizationCode string
	UserID           string
	SourceType       string
	Provider         string
	ParentType       string
	ParentRef        string
	Offset           int
	Limit            int
}

// ListSourceBindingNodesResult 表示来源绑定节点查询结果。
type ListSourceBindingNodesResult struct {
	Total int64               `json:"total"`
	List  []SourceBindingNode `json:"list"`
}

// RepairSourceBindingsInput 表示历史来源绑定修复输入。
type RepairSourceBindingsInput struct {
	OrganizationCode  string
	UserID            string
	OrganizationCodes []string
	ThirdPlatformType string
	BatchSize         int
}

// SwitchEmbeddingModelMetaInput 表示知识库共享 collection 元数据直接切换输入。
type SwitchEmbeddingModelMetaInput struct {
	OrganizationCode string
	UserID           string
	TargetModel      string
	TargetDimension  int64
}

// SwitchEmbeddingModelMetaResult 表示知识库共享 collection 元数据直接切换结果。
type SwitchEmbeddingModelMetaResult struct {
	CollectionName         string `json:"collection_name"`
	PhysicalCollectionName string `json:"physical_collection_name"`
	Model                  string `json:"model"`
	VectorDimension        int64  `json:"vector_dimension"`
	SparseBackend          string `json:"sparse_backend"`
}

// RepairSourceBindingsFailure 表示修复失败样本。
type RepairSourceBindingsFailure struct {
	OrganizationCode string `json:"organization_code,omitempty"`
	KnowledgeCode    string `json:"knowledge_code"`
	ThirdFileID      string `json:"third_file_id"`
	Message          string `json:"message"`
}

// RepairSourceBindingsOrganizationResult 表示单个组织的历史来源绑定修复结果。
type RepairSourceBindingsOrganizationResult struct {
	OrganizationCode  string `json:"organization_code"`
	ScannedKnowledge  int    `json:"scanned_knowledge"`
	CandidateBindings int    `json:"candidate_bindings"`
	AddedBindings     int    `json:"added_bindings"`
	MaterializedDocs  int    `json:"materialized_documents"`
	ReusedDocuments   int    `json:"reused_documents"`
	BackfilledRows    int    `json:"backfilled_rows"`
	FailedGroups      int    `json:"failed_groups"`
}

// RepairSourceBindingsResult 表示历史来源绑定修复结果。
type RepairSourceBindingsResult struct {
	OrganizationCode     string                                   `json:"organization_code"`
	OrganizationCodes    []string                                 `json:"organization_codes,omitempty"`
	ThirdPlatformType    string                                   `json:"third_platform_type"`
	ScannedOrganizations int                                      `json:"scanned_organizations"`
	ScannedKnowledge     int                                      `json:"scanned_knowledge"`
	CandidateBindings    int                                      `json:"candidate_bindings"`
	AddedBindings        int                                      `json:"added_bindings"`
	MaterializedDocs     int                                      `json:"materialized_documents"`
	ReusedDocuments      int                                      `json:"reused_documents"`
	BackfilledRows       int                                      `json:"backfilled_rows"`
	FailedGroups         int                                      `json:"failed_groups"`
	Organizations        []RepairSourceBindingsOrganizationResult `json:"organizations,omitempty"`
	Failures             []RepairSourceBindingsFailure            `json:"failures"`
}

// AgentKnowledgeBaseBindingsInput 表示数字员工与 flow 向量知识库的增量绑定请求。
type AgentKnowledgeBaseBindingsInput struct {
	OrganizationCode   string
	UserID             string
	AgentCode          string
	KnowledgeBaseCodes []string
}

// AgentKnowledgeBaseBindingsResult 表示数字员工与 flow 向量知识库绑定处理结果。
type AgentKnowledgeBaseBindingsResult struct {
	AgentCode          string   `json:"agent_code"`
	KnowledgeBaseCodes []string `json:"knowledge_base_codes"`
}

// UpdateAgentKnowledgeBaseBindingInput 表示更新数字员工下关联 flow 知识库配置的请求。
type UpdateAgentKnowledgeBaseBindingInput struct {
	OrganizationCode  string
	UserID            string
	AgentCode         string
	KnowledgeBaseCode string
	Name              *string
	Description       *string
	Icon              *string
	Enabled           *bool
}

// UpdateAgentKnowledgeBaseBindingResult 表示关联 flow 知识库配置的有效展示结果。
type UpdateAgentKnowledgeBaseBindingResult struct {
	AgentCode         string `json:"agent_code"`
	KnowledgeBaseCode string `json:"knowledge_base_code"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	Icon              string `json:"icon"`
	Enabled           bool   `json:"enabled"`
}

// CreateKnowledgeBaseInput 表示创建知识库请求。
type CreateKnowledgeBaseInput struct {
	OrganizationCode       string
	UserID                 string
	Code                   string
	Name                   string
	Description            string
	Type                   int
	Model                  string
	VectorDB               string
	BusinessID             string
	Icon                   string
	SourceType             *int
	AgentCodes             []string
	RetrieveConfig         *confighelper.RetrieveConfigDTO
	FragmentConfig         *confighelper.FragmentConfigDTO
	EmbeddingConfig        *confighelper.EmbeddingConfig
	SourceBindings         []SourceBindingInput
	LegacyDocumentFiles    []LegacyDocumentFileInput
	SourceBindingsProvided bool
}

// UpdateKnowledgeBaseInput 表示更新知识库请求。
type UpdateKnowledgeBaseInput struct {
	OrganizationCode    string
	UserID              string
	Code                string
	Name                string
	Description         string
	Enabled             *bool
	Icon                string
	SourceType          *int
	RetrieveConfig      *confighelper.RetrieveConfigDTO
	FragmentConfig      *confighelper.FragmentConfigDTO
	EmbeddingConfig     *confighelper.EmbeddingConfig
	SourceBindings      *[]SourceBindingInput
	LegacyDocumentFiles *[]LegacyDocumentFileInput
}

// SaveProcessKnowledgeBaseInput 表示知识库向量化进度更新请求。
type SaveProcessKnowledgeBaseInput struct {
	OrganizationCode string
	UserID           string
	Code             string
	ExpectedNum      int
	CompletedNum     int
}

// ListKnowledgeBaseInput 表示知识库列表查询请求。
type ListKnowledgeBaseInput struct {
	OrganizationCode string
	UserID           string
	AgentCodes       []string
	Name             string
	Type             *int
	Enabled          *bool
	Codes            []string
	BusinessIDs      []string
	Offset           int
	Limit            int
}

// RebuildKnowledgeBasePermissionsInput 表示知识库权限补齐输入。
type RebuildKnowledgeBasePermissionsInput struct {
	OperatorOrganizationCode  string
	OperatorUserID            string
	KnowledgeOrganizationCode string
	KnowledgeBaseCodes        []string
	Limit                     int
}

// RebuildKnowledgeBasePermissionsResult 表示知识库权限补齐结果。
type RebuildKnowledgeBasePermissionsResult struct {
	Scanned     int `json:"scanned"`
	Initialized int `json:"initialized"`
}
