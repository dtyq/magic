package dto

import (
	"encoding/json"
	"fmt"

	confighelper "magic/internal/application/knowledge/helper/config"
	pkgjsoncompat "magic/internal/pkg/jsoncompat"
)

// JSONObject 表示对象结构的动态 JSON 字段，并兼容空数组输入。
type JSONObject map[string]any

// UnmarshalJSON 将对象 JSON 解码为 map，并兼容历史空对象脏值表达。
func (o *JSONObject) UnmarshalJSON(data []byte) error {
	decoded := map[string]any{}
	if err := pkgjsoncompat.UnmarshalObjectOrEmpty(data, map[string]any{}, &decoded); err != nil {
		return fmt.Errorf("unmarshal json object: %w", err)
	}

	*o = decoded
	return nil
}

// 知识库相关 DTO（接口层定义，不依赖领域层）

// SourceBindingTargetPayload 表示来源绑定的精确目标。
type SourceBindingTargetPayload struct {
	TargetType string `json:"target_type"`
	TargetRef  string `json:"target_ref"`
}

// SourceBindingPayload 表示知识库来源绑定请求项。
type SourceBindingPayload struct {
	Provider   string                       `json:"provider"`
	RootType   string                       `json:"root_type"`
	RootRef    string                       `json:"root_ref"`
	SyncMode   string                       `json:"sync_mode"`
	Enabled    *bool                        `json:"enabled,omitempty"`
	SyncConfig JSONObject                   `json:"sync_config,omitempty"`
	Targets    []SourceBindingTargetPayload `json:"targets,omitempty"`
}

// SourceBindingNode 表示来源绑定选择器统一节点。
type SourceBindingNode struct {
	NodeType    string         `json:"node_type"`
	NodeRef     string         `json:"node_ref"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	HasChildren bool           `json:"has_children"`
	Selectable  bool           `json:"selectable"`
	Meta        map[string]any `json:"meta,omitempty"`
}

// ListSourceBindingNodesRequest 查询来源绑定节点请求。
type ListSourceBindingNodesRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	SourceType    string        `json:"source_type" validate:"required"`
	Provider      string        `json:"provider,omitempty"`
	ParentType    string        `json:"parent_type" validate:"required"`
	ParentRef     string        `json:"parent_ref,omitempty"`
	Offset        int           `json:"offset" validate:"min=0"`
	Limit         int           `json:"limit" validate:"min=0"`
}

// ListSourceBindingNodesResponse 查询来源绑定节点响应。
type ListSourceBindingNodesResponse struct {
	Page  int                 `json:"page"`
	Total int64               `json:"total"`
	List  []SourceBindingNode `json:"list"`
}

// Validate 校验 ListSourceBindingNodesRequest 的 RPC 入参。
func (r ListSourceBindingNodesRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	if err := validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode()); err != nil {
		return err
	}
	return validateRequiredUserID(r.DataIsolation.UserID)
}

// CreateKnowledgeBaseRequest 创建知识库请求
type CreateKnowledgeBaseRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	Code          string        `json:"code,omitempty"`
	Name          string        `json:"name" validate:"required"`
	Description   string        `json:"description"`
	Type          int           `json:"type"`
	Model         string        `json:"model"`
	VectorDB      string        `json:"vector_db"`
	BusinessID    string        `json:"business_id"`
	Icon          string        `json:"icon"`
	// SourceType 保留原始协议值；RPC 层不据此判产品线。
	SourceType *int `json:"source_type,omitempty"`
	// AgentCodes 仅创建接口用于判产品线：非空即 digital_employee，空即 flow_vector。
	AgentCodes      []string                        `json:"agent_codes,omitempty"`
	RetrieveConfig  *confighelper.RetrieveConfigDTO `json:"retrieve_config"`
	FragmentConfig  *confighelper.FragmentConfigDTO `json:"fragment_config"`
	EmbeddingConfig *confighelper.EmbeddingConfig   `json:"embedding_config"`
	SourceBindings  []SourceBindingPayload          `json:"source_bindings,omitempty"`
}

// UnmarshalJSON 兼容旧调用方传入 agent_code 的单数字员工范围。
func (r *CreateKnowledgeBaseRequest) UnmarshalJSON(data []byte) error {
	var decoded struct {
		DataIsolation   DataIsolation          `json:"data_isolation"`
		Code            string                 `json:"code,omitempty"`
		Name            string                 `json:"name"`
		Description     string                 `json:"description"`
		Type            int                    `json:"type"`
		Model           string                 `json:"model"`
		VectorDB        string                 `json:"vector_db"`
		BusinessID      string                 `json:"business_id"`
		Icon            string                 `json:"icon"`
		SourceType      *int                   `json:"source_type,omitempty"`
		AgentCodes      []string               `json:"agent_codes,omitempty"`
		RetrieveConfig  json.RawMessage        `json:"retrieve_config"`
		FragmentConfig  json.RawMessage        `json:"fragment_config"`
		EmbeddingConfig json.RawMessage        `json:"embedding_config"`
		SourceBindings  []SourceBindingPayload `json:"source_bindings,omitempty"`
	}
	if err := unmarshalWithAgentCodesCompat(data, &decoded, func(agentCodes []string) {
		decoded.AgentCodes = agentCodes
	}); err != nil {
		return err
	}

	retrieveConfig, err := decodeOptionalObjectCompatPreserveEmptyObject[confighelper.RetrieveConfigDTO](decoded.RetrieveConfig, "retrieve_config")
	if err != nil {
		return err
	}
	fragmentConfig, err := decodeOptionalObjectCompatPreserveEmptyObject[confighelper.FragmentConfigDTO](decoded.FragmentConfig, "fragment_config")
	if err != nil {
		return err
	}
	embeddingConfig, err := decodeOptionalObjectCompatPreserveEmptyObject[confighelper.EmbeddingConfig](decoded.EmbeddingConfig, "embedding_config")
	if err != nil {
		return err
	}

	*r = CreateKnowledgeBaseRequest{
		DataIsolation:   decoded.DataIsolation,
		Code:            decoded.Code,
		Name:            decoded.Name,
		Description:     decoded.Description,
		Type:            decoded.Type,
		Model:           decoded.Model,
		VectorDB:        decoded.VectorDB,
		BusinessID:      decoded.BusinessID,
		Icon:            decoded.Icon,
		SourceType:      decoded.SourceType,
		AgentCodes:      decoded.AgentCodes,
		RetrieveConfig:  retrieveConfig,
		FragmentConfig:  fragmentConfig,
		EmbeddingConfig: embeddingConfig,
		SourceBindings:  decoded.SourceBindings,
	}
	return nil
}

// UpdateKnowledgeBaseRequest 更新知识库请求
type UpdateKnowledgeBaseRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	Code          string        `json:"code" validate:"required"`
	Name          string        `json:"name"`
	Description   string        `json:"description"`
	Enabled       *bool         `json:"enabled"`
	Icon          string        `json:"icon"`
	// SourceType 在 RPC 层允许为空，真正是否必填由应用层结合存量产品线决定。
	SourceType      *int                            `json:"source_type,omitempty"`
	RetrieveConfig  *confighelper.RetrieveConfigDTO `json:"retrieve_config"`
	FragmentConfig  *confighelper.FragmentConfigDTO `json:"fragment_config"`
	EmbeddingConfig *confighelper.EmbeddingConfig   `json:"embedding_config"`
	SourceBindings  *[]SourceBindingPayload         `json:"source_bindings,omitempty"`
}

// UnmarshalJSON 兼容历史对象脏值传参。
func (r *UpdateKnowledgeBaseRequest) UnmarshalJSON(data []byte) error {
	var decoded struct {
		DataIsolation   DataIsolation           `json:"data_isolation"`
		Code            string                  `json:"code"`
		Name            string                  `json:"name"`
		Description     string                  `json:"description"`
		Enabled         *bool                   `json:"enabled"`
		Icon            string                  `json:"icon"`
		SourceType      *int                    `json:"source_type,omitempty"`
		RetrieveConfig  json.RawMessage         `json:"retrieve_config"`
		FragmentConfig  json.RawMessage         `json:"fragment_config"`
		EmbeddingConfig json.RawMessage         `json:"embedding_config"`
		SourceBindings  *[]SourceBindingPayload `json:"source_bindings,omitempty"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return fmt.Errorf("unmarshal request: %w", err)
	}

	retrieveConfig, err := decodeOptionalObjectCompatPreserveEmptyObject[confighelper.RetrieveConfigDTO](decoded.RetrieveConfig, "retrieve_config")
	if err != nil {
		return err
	}
	fragmentConfig, err := decodeOptionalObjectCompatPreserveEmptyObject[confighelper.FragmentConfigDTO](decoded.FragmentConfig, "fragment_config")
	if err != nil {
		return err
	}
	embeddingConfig, err := decodeOptionalObjectCompatPreserveEmptyObject[confighelper.EmbeddingConfig](decoded.EmbeddingConfig, "embedding_config")
	if err != nil {
		return err
	}

	*r = UpdateKnowledgeBaseRequest{
		DataIsolation:   decoded.DataIsolation,
		Code:            decoded.Code,
		Name:            decoded.Name,
		Description:     decoded.Description,
		Enabled:         decoded.Enabled,
		Icon:            decoded.Icon,
		SourceType:      decoded.SourceType,
		RetrieveConfig:  retrieveConfig,
		FragmentConfig:  fragmentConfig,
		EmbeddingConfig: embeddingConfig,
		SourceBindings:  decoded.SourceBindings,
	}
	return nil
}

// SaveProcessKnowledgeBaseRequest 更新知识库向量化进度请求。
type SaveProcessKnowledgeBaseRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	Code          string        `json:"code" validate:"required"`
	ExpectedNum   int           `json:"expected_num"`
	CompletedNum  int           `json:"completed_num"`
}

// ShowKnowledgeBaseRequest 查询知识库请求
type ShowKnowledgeBaseRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	Code          string        `json:"code" validate:"required"`
}

// ListKnowledgeBaseRequest 查询知识库列表请求
// 注意：offset/limit 为顶层字段，与 PHP 侧传参格式对齐（非 page 子对象）
type ListKnowledgeBaseRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	AgentCodes    []string      `json:"agent_codes,omitempty"`
	Name          string        `json:"name"`
	Type          *int          `json:"type"`
	Enabled       *bool         `json:"enabled"`
	Codes         []string      `json:"codes"`
	BusinessIDs   []string      `json:"business_ids"`
	Offset        int           `json:"offset" validate:"min=0"`
	Limit         int           `json:"limit" validate:"min=1"`
}

// UnmarshalJSON 兼容旧调用方传入 agent_code 的单数字员工范围。
func (r *ListKnowledgeBaseRequest) UnmarshalJSON(data []byte) error {
	type request ListKnowledgeBaseRequest
	var decoded request
	if err := unmarshalWithAgentCodesCompat(data, &decoded, func(agentCodes []string) {
		decoded.AgentCodes = agentCodes
	}); err != nil {
		return err
	}
	*r = ListKnowledgeBaseRequest(decoded)
	return nil
}

// DestroyKnowledgeBaseRequest 删除知识库请求
type DestroyKnowledgeBaseRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	Code          string        `json:"code" validate:"required"`
}

// RebuildKnowledgeBaseRequest 手动触发知识库重建请求。
type RebuildKnowledgeBaseRequest struct {
	DataIsolation             DataIsolation `json:"data_isolation"`
	Scope                     string        `json:"scope,omitempty"`
	OrganizationCode          string        `json:"organization_code,omitempty"`
	KnowledgeOrganizationCode string        `json:"knowledge_organization_code,omitempty"`
	KnowledgeBaseCode         string        `json:"knowledge_base_code,omitempty"`
	DocumentCode              string        `json:"document_code,omitempty"`
	Mode                      string        `json:"mode,omitempty"`
	TargetModel               string        `json:"target_model,omitempty"`
	TargetDimension           int64         `json:"target_dimension,omitempty"`
	Concurrency               int           `json:"concurrency,omitempty"`
	BatchSize                 int           `json:"batch_size,omitempty"`
	Retry                     int           `json:"retry,omitempty"`
}

// RebuildKnowledgeBaseResponse 手动触发知识库重建响应。
type RebuildKnowledgeBaseResponse struct {
	Status        string `json:"status"`
	RunID         string `json:"run_id"`
	Scope         string `json:"scope"`
	RequestedMode string `json:"requested_mode"`
	TargetModel   string `json:"target_model"`
}

// RepairSourceBindingsRequest 历史来源绑定修复请求。
type RepairSourceBindingsRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	OrganizationCodes []string      `json:"organization_codes,omitempty"`
	ThirdPlatformType string        `json:"third_platform_type,omitempty"`
	BatchSize         int           `json:"batch_size,omitempty"`
}

// RebuildCleanupRequest 重建残留清理请求。
type RebuildCleanupRequest struct {
	DataIsolation       DataIsolation `json:"data_isolation"`
	Apply               bool          `json:"apply"`
	ForceDeleteNonEmpty bool          `json:"force_delete_non_empty"`
}

// RepairSourceBindingsFailure 修复失败样本。
type RepairSourceBindingsFailure struct {
	OrganizationCode string `json:"organization_code,omitempty"`
	KnowledgeCode    string `json:"knowledge_code"`
	ThirdFileID      string `json:"third_file_id"`
	Message          string `json:"message"`
}

// RepairSourceBindingsOrganizationResult 表示单个组织的修复汇总。
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

// RepairSourceBindingsResponse 历史来源绑定修复响应。
type RepairSourceBindingsResponse struct {
	Status               string                                   `json:"status,omitempty"`
	TaskID               string                                   `json:"task_id,omitempty"`
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

// RebuildCleanupCollectionAudit 表示 cleanup 接口中的集合审计项。
type RebuildCleanupCollectionAudit struct {
	Name   string `json:"name"`
	Points int64  `json:"points"`
}

// RebuildCleanupDualWriteState 表示 cleanup 接口中的双写状态。
type RebuildCleanupDualWriteState struct {
	RunID            string `json:"run_id"`
	Enabled          bool   `json:"enabled"`
	Mode             string `json:"mode"`
	ActiveCollection string `json:"active_collection"`
	ShadowCollection string `json:"shadow_collection"`
	ActiveModel      string `json:"active_model"`
	TargetModel      string `json:"target_model"`
}

// RebuildCleanupResponse 重建残留清理响应。
type RebuildCleanupResponse struct {
	Apply                    bool                            `json:"apply"`
	ForceDeleteNonEmpty      bool                            `json:"force_delete_non_empty"`
	CandidatePattern         string                          `json:"candidate_pattern"`
	AliasName                string                          `json:"alias_name"`
	AliasTarget              string                          `json:"alias_target"`
	MetaPhysicalCollection   string                          `json:"meta_physical_collection"`
	CurrentRunID             string                          `json:"current_run_id"`
	DualWriteState           *RebuildCleanupDualWriteState   `json:"dual_write_state,omitempty"`
	SafeToDeleteCollections  []RebuildCleanupCollectionAudit `json:"safe_to_delete_collections"`
	KeptCollections          []RebuildCleanupCollectionAudit `json:"kept_collections"`
	SkipReason               map[string]string               `json:"skip_reason"`
	DeletedDualwriteState    bool                            `json:"deleted_dualwrite_state"`
	TotalCollections         int                             `json:"total_collections"`
	CandidateCollectionCount int                             `json:"candidate_collection_count"`
	SafeToDeleteCount        int                             `json:"safe_to_delete_count"`
	KeptCount                int                             `json:"kept_count"`
}
