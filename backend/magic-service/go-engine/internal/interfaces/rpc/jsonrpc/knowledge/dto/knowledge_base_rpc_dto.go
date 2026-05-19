package dto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	confighelper "magic/internal/application/knowledge/helper/config"
	pkgjsoncompat "magic/internal/pkg/jsoncompat"
)

const rawJSONNullLiteral = "null"

const defaultSourceBindingNodesLimit = 20

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

// UnmarshalJSON 兼容 target_ref 传数字 ID。
func (p *SourceBindingTargetPayload) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "source binding target payload")
	if err != nil {
		return err
	}

	targetType, err := decodeRequestStringValue(raw, "target_type")
	if err != nil {
		return err
	}
	targetRef, err := decodeRequestIDStringValue(raw, "target_ref")
	if err != nil {
		return err
	}

	*p = SourceBindingTargetPayload{
		TargetType: targetType,
		TargetRef:  targetRef,
	}
	return nil
}

// SourceBindingPayload 表示知识库来源绑定请求项。
type SourceBindingPayload struct {
	Provider      string                       `json:"provider"`
	RootType      string                       `json:"root_type"`
	RootRef       string                       `json:"root_ref"`
	WorkspaceID   *string                      `json:"workspace_id,omitempty"`
	WorkspaceType *string                      `json:"workspace_type,omitempty"`
	SyncMode      string                       `json:"sync_mode"`
	Enabled       *bool                        `json:"enabled,omitempty"`
	SyncConfig    JSONObject                   `json:"sync_config,omitempty"`
	Targets       []SourceBindingTargetPayload `json:"targets,omitempty"`
}

// UnmarshalJSON 兼容 enabled 传字符串布尔，保持 PHP `(bool)` 真值语义。
func (p *SourceBindingPayload) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "source binding payload")
	if err != nil {
		return err
	}

	provider, err := decodeRequestStringValue(raw, "provider")
	if err != nil {
		return err
	}
	rootType, err := decodeRequestStringValue(raw, "root_type")
	if err != nil {
		return err
	}
	rootRef, err := decodeRequestIDStringValue(raw, "root_ref")
	if err != nil {
		return err
	}
	workspaceID, workspaceIDProvided, err := decodeRequestIDString(raw, "workspace_id")
	if err != nil {
		return err
	}
	syncMode, err := decodeRequestStringValue(raw, "sync_mode")
	if err != nil {
		return err
	}
	enabled, _, err := decodeRequestBoolPHPTruth(raw, "enabled")
	if err != nil {
		return err
	}

	var syncConfig JSONObject
	if field, ok := raw["sync_config"]; ok {
		syncConfig, err = decodeSourceBindingSyncConfig(field, "sync_config")
		if err != nil {
			return err
		}
	}
	targets, _, err := decodeOptionalJSONArrayCompat[SourceBindingTargetPayload](raw["targets"], "targets")
	if err != nil {
		return err
	}

	var workspaceIDPtr *string
	if workspaceIDProvided {
		workspaceIDPtr = &workspaceID
	}

	*p = SourceBindingPayload{
		Provider:    provider,
		RootType:    rootType,
		RootRef:     rootRef,
		WorkspaceID: workspaceIDPtr,
		SyncMode:    syncMode,
		Enabled:     enabled,
		SyncConfig:  syncConfig,
		Targets:     targets,
	}
	return nil
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
	Limit         int           `json:"limit" validate:"min=1"`
}

// UnmarshalJSON 兼容 page/page_size 与 offset/limit 两种分页入参。
func (r *ListSourceBindingNodesRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "list source binding nodes request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}

	sourceType, err := decodeRequestStringValue(raw, "source_type")
	if err != nil {
		return err
	}
	provider, err := decodeRequestStringValue(raw, "provider")
	if err != nil {
		return err
	}
	parentType, err := decodeRequestStringValue(raw, "parent_type")
	if err != nil {
		return err
	}
	parentRef, err := decodeRequestIDStringValue(raw, "parent_ref")
	if err != nil {
		return err
	}
	offset, limit, err := decodeRequestPageWindow(raw, defaultSourceBindingNodesLimit)
	if err != nil {
		return err
	}

	*r = ListSourceBindingNodesRequest{
		DataIsolation: dataIsolation,
		SourceType:    sourceType,
		Provider:      provider,
		ParentType:    parentType,
		ParentRef:     parentRef,
		Offset:        offset,
		Limit:         limit,
	}
	return nil
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
	AgentCodes             []string                        `json:"agent_codes,omitempty"`
	RetrieveConfig         *confighelper.RetrieveConfigDTO `json:"retrieve_config"`
	FragmentConfig         *confighelper.FragmentConfigDTO `json:"fragment_config"`
	EmbeddingConfig        *confighelper.EmbeddingConfig   `json:"embedding_config"`
	SourceBindings         []SourceBindingPayload          `json:"source_bindings,omitempty"`
	DocumentFiles          []JSONObject                    `json:"document_files,omitempty"`
	SourceBindingsProvided bool                            `json:"-"`
}

// UnmarshalJSON 兼容旧调用方传入 agent_code 的单数字员工范围。
func (r *CreateKnowledgeBaseRequest) UnmarshalJSON(data []byte) error {
	var decoded struct {
		DataIsolation   DataIsolation   `json:"data_isolation"`
		Code            string          `json:"code,omitempty"`
		Name            string          `json:"name"`
		Description     string          `json:"description"`
		Type            json.RawMessage `json:"type"`
		Model           string          `json:"model"`
		VectorDB        string          `json:"vector_db"`
		BusinessID      string          `json:"business_id"`
		Icon            string          `json:"icon"`
		SourceType      json.RawMessage `json:"source_type,omitempty"`
		AgentCodes      []string        `json:"agent_codes,omitempty"`
		RetrieveConfig  json.RawMessage `json:"retrieve_config"`
		FragmentConfig  json.RawMessage `json:"fragment_config"`
		EmbeddingConfig json.RawMessage `json:"embedding_config"`
		SourceBindings  json.RawMessage `json:"source_bindings,omitempty"`
		DocumentFiles   json.RawMessage `json:"document_files,omitempty"`
	}
	if err := unmarshalWithAgentCodesCompat(data, &decoded, func(agentCodes []string) {
		decoded.AgentCodes = agentCodes
	}); err != nil {
		return err
	}
	typeValue, _, err := pkgjsoncompat.DecodeOptionalInt(decoded.Type, "type")
	if err != nil {
		return fmt.Errorf("decode type: %w", err)
	}
	sourceType, _, err := pkgjsoncompat.DecodeOptionalInt(decoded.SourceType, "source_type")
	if err != nil {
		return fmt.Errorf("decode source_type: %w", err)
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
	sourceBindings, err := decodeOptionalSourceBindings(decoded.SourceBindings, "source_bindings")
	if err != nil {
		return err
	}
	documentFiles, err := decodeOptionalJSONObjectSlice(decoded.DocumentFiles, "document_files")
	if err != nil {
		return err
	}

	*r = CreateKnowledgeBaseRequest{
		DataIsolation:          decoded.DataIsolation,
		Code:                   decoded.Code,
		Name:                   decoded.Name,
		Description:            decoded.Description,
		Type:                   dereferenceInt(typeValue),
		Model:                  decoded.Model,
		VectorDB:               decoded.VectorDB,
		BusinessID:             decoded.BusinessID,
		Icon:                   decoded.Icon,
		SourceType:             sourceType,
		AgentCodes:             decoded.AgentCodes,
		RetrieveConfig:         retrieveConfig,
		FragmentConfig:         fragmentConfig,
		EmbeddingConfig:        embeddingConfig,
		SourceBindings:         sourceBindings,
		DocumentFiles:          documentFiles,
		SourceBindingsProvided: rawFieldProvided(decoded.SourceBindings),
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
	DocumentFiles   *[]JSONObject                   `json:"document_files,omitempty"`
}

// UnmarshalJSON 兼容历史对象脏值传参。
func (r *UpdateKnowledgeBaseRequest) UnmarshalJSON(data []byte) error {
	var decoded struct {
		DataIsolation   DataIsolation   `json:"data_isolation"`
		Code            string          `json:"code"`
		Name            string          `json:"name"`
		Description     string          `json:"description"`
		Enabled         json.RawMessage `json:"enabled"`
		Status          json.RawMessage `json:"status"`
		Icon            string          `json:"icon"`
		SourceType      json.RawMessage `json:"source_type,omitempty"`
		RetrieveConfig  json.RawMessage `json:"retrieve_config"`
		FragmentConfig  json.RawMessage `json:"fragment_config"`
		EmbeddingConfig json.RawMessage `json:"embedding_config"`
		SourceBindings  json.RawMessage `json:"source_bindings,omitempty"`
		DocumentFiles   json.RawMessage `json:"document_files,omitempty"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return fmt.Errorf("unmarshal request: %w", err)
	}
	enabled, _, err := pkgjsoncompat.DecodeOptionalBoolPHPTruth(decoded.Enabled, "enabled")
	if err != nil {
		return fmt.Errorf("decode enabled: %w", err)
	}
	status, _, err := pkgjsoncompat.DecodeOptionalInt(decoded.Status, "status")
	if err != nil {
		return fmt.Errorf("decode status: %w", err)
	}
	sourceType, _, err := pkgjsoncompat.DecodeOptionalInt(decoded.SourceType, "source_type")
	if err != nil {
		return fmt.Errorf("decode source_type: %w", err)
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
	sourceBindingsValue, sourceBindingsProvided, err := decodeOptionalJSONArrayCompat[SourceBindingPayload](decoded.SourceBindings, "source_bindings")
	if err != nil {
		return err
	}
	documentFilesValue, err := decodeOptionalJSONObjectSlice(decoded.DocumentFiles, "document_files")
	if err != nil {
		return err
	}
	documentFilesProvided := rawFieldProvided(decoded.DocumentFiles)

	var sourceBindings *[]SourceBindingPayload
	if sourceBindingsProvided {
		sourceBindings = &sourceBindingsValue
	}
	var documentFiles *[]JSONObject
	if documentFilesProvided {
		documentFiles = &documentFilesValue
	}

	*r = UpdateKnowledgeBaseRequest{
		DataIsolation:   decoded.DataIsolation,
		Code:            decoded.Code,
		Name:            decoded.Name,
		Description:     decoded.Description,
		Enabled:         resolveEnabledCompat(enabled, status),
		Icon:            decoded.Icon,
		SourceType:      sourceType,
		RetrieveConfig:  retrieveConfig,
		FragmentConfig:  fragmentConfig,
		EmbeddingConfig: embeddingConfig,
		SourceBindings:  sourceBindings,
		DocumentFiles:   documentFiles,
	}
	return nil
}

func decodeOptionalSourceBindings(raw json.RawMessage, fieldName string) ([]SourceBindingPayload, error) {
	values, provided, err := decodeOptionalJSONArrayCompat[SourceBindingPayload](raw, fieldName)
	if err != nil {
		return nil, err
	}
	if !provided {
		return nil, nil
	}
	return values, nil
}

func decodeOptionalJSONObjectSlice(raw json.RawMessage, fieldName string) ([]JSONObject, error) {
	values, provided, err := decodeOptionalJSONArrayCompat[json.RawMessage](raw, fieldName)
	if err != nil {
		return nil, err
	}
	if !provided {
		return nil, nil
	}
	results := make([]JSONObject, 0, len(values))
	for idx, item := range values {
		decoded, err := decodeJSONObjectWithIDStringFields(
			item,
			fmt.Sprintf("%s[%d]", fieldName, idx),
			[]string{"third_id", "third_file_id", "knowledge_base_id", "project_file_id"},
			nil,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, decoded)
	}
	return results, nil
}

func decodeSourceBindingSyncConfig(raw json.RawMessage, fieldName string) (JSONObject, error) {
	return decodeJSONObjectWithIDStringFields(
		raw,
		fieldName,
		nil,
		map[string][]string{
			"root_context":  {"knowledge_base_id"},
			"document_file": {"third_id", "third_file_id", "knowledge_base_id", "project_file_id"},
		},
	)
}

func decodeJSONObjectWithIDStringFields(
	raw json.RawMessage,
	fieldName string,
	topLevelIDKeys []string,
	nestedIDKeys map[string][]string,
) (JSONObject, error) {
	decoded := map[string]any{}
	if err := pkgjsoncompat.UnmarshalObjectOrEmpty(raw, map[string]any{}, &decoded); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}

	rawFields := map[string]json.RawMessage{}
	if err := pkgjsoncompat.UnmarshalObjectOrEmpty(raw, map[string]json.RawMessage{}, &rawFields); err != nil {
		return nil, fmt.Errorf("unmarshal %s raw fields: %w", fieldName, err)
	}

	if err := applyJSONObjectIDStringFields(decoded, rawFields, fieldName, topLevelIDKeys); err != nil {
		return nil, err
	}
	for nestedField, idKeys := range nestedIDKeys {
		nestedRaw, ok := rawFields[nestedField]
		if !ok {
			continue
		}
		nestedDecoded := map[string]any{}
		if current, ok := decoded[nestedField].(map[string]any); ok {
			nestedDecoded = current
		}
		nestedRawFields := map[string]json.RawMessage{}
		if err := pkgjsoncompat.UnmarshalObjectOrEmpty(nestedRaw, map[string]json.RawMessage{}, &nestedRawFields); err != nil {
			return nil, fmt.Errorf("unmarshal %s.%s raw fields: %w", fieldName, nestedField, err)
		}
		if len(nestedDecoded) == 0 {
			if err := pkgjsoncompat.UnmarshalObjectOrEmpty(nestedRaw, map[string]any{}, &nestedDecoded); err != nil {
				return nil, fmt.Errorf("unmarshal %s.%s: %w", fieldName, nestedField, err)
			}
		}
		if err := applyJSONObjectIDStringFields(nestedDecoded, nestedRawFields, fieldName+"."+nestedField, idKeys); err != nil {
			return nil, err
		}
		decoded[nestedField] = nestedDecoded
	}

	return JSONObject(decoded), nil
}

func applyJSONObjectIDStringFields(
	decoded map[string]any,
	rawFields map[string]json.RawMessage,
	fieldName string,
	idKeys []string,
) error {
	for _, key := range idKeys {
		rawValue, ok := rawFields[key]
		if !ok {
			continue
		}
		value, _, err := pkgjsoncompat.DecodeOptionalIDString(rawValue, fieldName+"."+key)
		if err != nil {
			return fmt.Errorf("decode %s.%s: %w", fieldName, key, err)
		}
		decoded[key] = value
	}
	return nil
}

func decodeOptionalJSONArrayCompat[T any](raw json.RawMessage, fieldName string) ([]T, bool, error) {
	trimmed := bytes.TrimSpace(raw)
	switch {
	case len(trimmed) == 0:
		return nil, false, nil
	case bytes.Equal(trimmed, []byte(rawJSONNullLiteral)):
		return []T{}, true, nil
	case bytes.Equal(trimmed, []byte("[]")):
		return []T{}, true, nil
	case trimmed[0] == '"':
		var rawString string
		if err := json.Unmarshal(trimmed, &rawString); err != nil {
			return nil, false, fmt.Errorf("unmarshal %s: %w", fieldName, err)
		}
		switch strings.TrimSpace(rawString) {
		case "", rawJSONNullLiteral:
			return []T{}, true, nil
		case "[]":
			return []T{}, true, nil
		}
	}

	var decoded []T
	if err := json.Unmarshal(trimmed, &decoded); err != nil {
		return nil, false, fmt.Errorf("unmarshal %s: %w", fieldName, err)
	}
	return decoded, true, nil
}

func rawFieldProvided(raw json.RawMessage) bool {
	return len(bytes.TrimSpace(raw)) > 0
}

// SaveProcessKnowledgeBaseRequest 更新知识库向量化进度请求。
type SaveProcessKnowledgeBaseRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	Code          string        `json:"code" validate:"required"`
	ExpectedNum   int           `json:"expected_num"`
	CompletedNum  int           `json:"completed_num"`
}

// UnmarshalJSON 兼容历史数值字段传字符串。
func (r *SaveProcessKnowledgeBaseRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "save process knowledge base request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	code, err := decodeRequestStringValue(raw, "code")
	if err != nil {
		return err
	}
	expectedNum, err := decodeRequestIntValue(raw, "expected_num")
	if err != nil {
		return err
	}
	completedNum, err := decodeRequestIntValue(raw, "completed_num")
	if err != nil {
		return err
	}

	*r = SaveProcessKnowledgeBaseRequest{
		DataIsolation: dataIsolation,
		Code:          code,
		ExpectedNum:   expectedNum,
		CompletedNum:  completedNum,
	}
	return nil
}

// ShowKnowledgeBaseRequest 查询知识库请求
type ShowKnowledgeBaseRequest struct {
	DataIsolation DataIsolation `json:"data_isolation"`
	Code          string        `json:"code" validate:"required"`
}

// RebuildKnowledgeBasePermissionsRequest 补齐知识库权限请求。
type RebuildKnowledgeBasePermissionsRequest struct {
	DataIsolation             DataIsolation `json:"data_isolation"`
	KnowledgeOrganizationCode string        `json:"knowledge_organization_code,omitempty"`
	KnowledgeBaseCodes        []string      `json:"knowledge_base_codes,omitempty"`
	Limit                     int           `json:"limit" validate:"min=0"`
}

// UnmarshalJSON 兼容 limit 传字符串。
func (r *RebuildKnowledgeBasePermissionsRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "rebuild knowledge base permissions request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	knowledgeOrganizationCode, err := decodeRequestStringValue(raw, "knowledge_organization_code")
	if err != nil {
		return err
	}
	knowledgeBaseCodes, err := decodeRequestStringSlice(raw, "knowledge_base_codes")
	if err != nil {
		return err
	}
	limit, err := decodeRequestIntValue(raw, "limit")
	if err != nil {
		return err
	}

	*r = RebuildKnowledgeBasePermissionsRequest{
		DataIsolation:             dataIsolation,
		KnowledgeOrganizationCode: knowledgeOrganizationCode,
		KnowledgeBaseCodes:        knowledgeBaseCodes,
		Limit:                     limit,
	}
	return nil
}

// Validate 校验权限补齐请求。
func (r RebuildKnowledgeBasePermissionsRequest) Validate() error {
	if err := validateStruct(r); err != nil {
		return err
	}
	return validateResolvedOrgCode("data_isolation.organization_code", r.DataIsolation.ResolveOrganizationCode())
}

// RebuildKnowledgeBasePermissionsResponse 补齐知识库权限响应。
type RebuildKnowledgeBasePermissionsResponse struct {
	Scanned     int `json:"scanned"`
	Initialized int `json:"initialized"`
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
	raw, err := unmarshalRequestObject(data, "list knowledge base request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	name, err := decodeRequestStringValue(raw, "name")
	if err != nil {
		return err
	}
	typeValue, _, err := decodeRequestInt(raw, "type")
	if err != nil {
		return err
	}
	enabled, enabledProvided, err := decodeRequestBoolPHPTruth(raw, "enabled")
	if err != nil {
		return err
	}
	if !enabledProvided {
		searchType, _, decodeErr := decodeRequestInt(raw, "search_type")
		if decodeErr != nil {
			return decodeErr
		}
		switch dereferenceInt(searchType) {
		case 2:
			value := true
			enabled = &value
		case 3:
			value := false
			enabled = &value
		}
	}
	codes, err := decodeRequestStringSlice(raw, "codes")
	if err != nil {
		return err
	}
	businessIDs, err := decodeRequestStringSlice(raw, "business_ids")
	if err != nil {
		return err
	}
	offset, limit, err := decodeRequestPageWindow(raw, 100)
	if err != nil {
		return err
	}

	var decoded struct {
		AgentCodes []string `json:"agent_codes,omitempty"`
	}
	if err := unmarshalWithAgentCodesCompat(data, &decoded, func(agentCodes []string) {
		decoded.AgentCodes = agentCodes
	}); err != nil {
		return err
	}

	*r = ListKnowledgeBaseRequest{
		DataIsolation: dataIsolation,
		AgentCodes:    decoded.AgentCodes,
		Name:          name,
		Type:          typeValue,
		Enabled:       enabled,
		Codes:         codes,
		BusinessIDs:   businessIDs,
		Offset:        offset,
		Limit:         limit,
	}
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

// UnmarshalJSON 兼容历史数值字段传字符串。
func (r *RebuildKnowledgeBaseRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "rebuild knowledge base request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	scope, err := decodeRequestStringValue(raw, "scope")
	if err != nil {
		return err
	}
	organizationCode, err := decodeRequestStringValue(raw, "organization_code")
	if err != nil {
		return err
	}
	knowledgeOrganizationCode, err := decodeRequestStringValue(raw, "knowledge_organization_code")
	if err != nil {
		return err
	}
	knowledgeBaseCode, err := decodeRequestStringValue(raw, "knowledge_base_code")
	if err != nil {
		return err
	}
	documentCode, err := decodeRequestStringValue(raw, "document_code")
	if err != nil {
		return err
	}
	mode, err := decodeRequestStringValue(raw, "mode")
	if err != nil {
		return err
	}
	targetModel, err := decodeRequestStringValue(raw, "target_model")
	if err != nil {
		return err
	}
	targetDimension, err := decodeRequestInt64Value(raw, "target_dimension")
	if err != nil {
		return err
	}
	concurrency, err := decodeRequestIntValue(raw, "concurrency")
	if err != nil {
		return err
	}
	batchSize, err := decodeRequestIntValue(raw, "batch_size")
	if err != nil {
		return err
	}
	retry, err := decodeRequestIntValue(raw, "retry")
	if err != nil {
		return err
	}

	*r = RebuildKnowledgeBaseRequest{
		DataIsolation:             dataIsolation,
		Scope:                     scope,
		OrganizationCode:          organizationCode,
		KnowledgeOrganizationCode: knowledgeOrganizationCode,
		KnowledgeBaseCode:         knowledgeBaseCode,
		DocumentCode:              documentCode,
		Mode:                      mode,
		TargetModel:               targetModel,
		TargetDimension:           targetDimension,
		Concurrency:               concurrency,
		BatchSize:                 batchSize,
		Retry:                     retry,
	}
	return nil
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

// UnmarshalJSON 兼容 batch_size 传字符串。
func (r *RepairSourceBindingsRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "repair source bindings request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	organizationCodes, err := decodeRequestStringSlice(raw, "organization_codes")
	if err != nil {
		return err
	}
	thirdPlatformType, err := decodeRequestStringValue(raw, "third_platform_type")
	if err != nil {
		return err
	}
	batchSize, err := decodeRequestIntValue(raw, "batch_size")
	if err != nil {
		return err
	}

	*r = RepairSourceBindingsRequest{
		DataIsolation:     dataIsolation,
		OrganizationCodes: organizationCodes,
		ThirdPlatformType: thirdPlatformType,
		BatchSize:         batchSize,
	}
	return nil
}

// RebuildCleanupRequest 重建残留清理请求。
type RebuildCleanupRequest struct {
	DataIsolation       DataIsolation `json:"data_isolation"`
	Apply               bool          `json:"apply"`
	ForceDeleteNonEmpty bool          `json:"force_delete_non_empty"`
}

// UnmarshalJSON 兼容历史布尔字段传字符串。
func (r *RebuildCleanupRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "rebuild cleanup request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	apply, _, err := decodeRequestBoolPHPTruth(raw, "apply")
	if err != nil {
		return err
	}
	forceDeleteNonEmpty, _, err := decodeRequestBoolPHPTruth(raw, "force_delete_non_empty")
	if err != nil {
		return err
	}

	*r = RebuildCleanupRequest{
		DataIsolation:       dataIsolation,
		Apply:               dereferenceBool(apply),
		ForceDeleteNonEmpty: dereferenceBool(forceDeleteNonEmpty),
	}
	return nil
}

func dereferenceInt(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}

func dereferenceBool(value *bool) bool {
	if value == nil {
		return false
	}
	return *value
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
