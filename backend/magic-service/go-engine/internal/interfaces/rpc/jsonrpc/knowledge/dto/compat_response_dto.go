package dto

import (
	"math"
	"strconv"
	"strings"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	fragdto "magic/internal/application/knowledge/fragment/dto"
	confighelper "magic/internal/application/knowledge/helper/config"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
)

const (
	rpcCompatVersion                 = 1
	legacyFlowSourceTypeLocalFile    = 1
	legacyDocumentFileTypeExternal   = 1
	legacyDocumentFileTypeThirdParty = 2
	knowledgeBaseTypeDigitalEmployee = "digital_employee"
	fragmentModeCustom               = 1
	fragmentModeAuto                 = 2
	defaultRetrieveConfigVersion     = 1
	defaultRetrieveSearchMethod      = "hybrid_search"
	defaultRetrieveTopK              = 10
	defaultScoreThreshold            = 0.5
	defaultRerankingMode             = "weighted_score"
	defaultVectorWeight              = 1.0
	defaultKeywordWeight             = 0.0
	defaultGraphRelationWeight       = 0.5
	defaultGraphMaxDepth             = 2
	defaultGraphTimeout              = 5.0
	defaultGraphRetryCount           = 3
	flowDefaultChunkSize             = 500
	flowDefaultChunkOverlap          = 50
	flowDefaultSeparator             = "\\n\\n"
	flowDefaultTextPreprocessRule    = 1
)

// OperatorInfoResponse 兼容 PHP 侧 operator DTO 结构。
type OperatorInfoResponse struct {
	ID        string `json:"id"`
	UID       string `json:"uid"`
	Name      string `json:"name"`
	Time      string `json:"time"`
	Timestamp int64  `json:"timestamp"`
	Avatar    string `json:"avatar"`
}

// KnowledgeBaseResponse 兼容 PHP 侧知识库 DTO 输出结构。
type KnowledgeBaseResponse struct {
	ID                string                `json:"id"`
	Code              string                `json:"code"`
	Name              string                `json:"name"`
	Description       string                `json:"description"`
	Type              int                   `json:"type"`
	Enabled           bool                  `json:"enabled"`
	BusinessID        string                `json:"business_id"`
	SyncStatus        int                   `json:"sync_status"`
	SyncStatusMessage string                `json:"sync_status_message"`
	Model             string                `json:"model"`
	VectorDB          string                `json:"vector_db"`
	OrganizationCode  string                `json:"organization_code"`
	Creator           string                `json:"creator"`
	Modifier          string                `json:"modifier"`
	CreatedUID        string                `json:"created_uid"`
	UpdatedUID        string                `json:"updated_uid"`
	CreatedAt         string                `json:"created_at"`
	UpdatedAt         string                `json:"updated_at"`
	FragmentCount     int                   `json:"fragment_count"`
	ExpectedCount     int                   `json:"expected_count"`
	CompletedCount    int                   `json:"completed_count"`
	UserOperation     *int                  `json:"user_operation,omitempty"`
	ExpectedNum       int                   `json:"expected_num"`
	CompletedNum      int                   `json:"completed_num"`
	WordCount         int                   `json:"word_count"`
	DocumentCount     int                   `json:"document_count"`
	RetrieveConfig    any                   `json:"retrieve_config,omitempty"`
	FragmentConfig    any                   `json:"fragment_config,omitempty"`
	EmbeddingConfig   any                   `json:"embedding_config,omitempty"`
	SourceType        *int                  `json:"source_type,omitempty"`
	AgentCodes        []string              `json:"agent_codes,omitempty"`
	Icon              string                `json:"icon"`
	CreatorInfo       *OperatorInfoResponse `json:"creator_info,omitempty"`
	ModifierInfo      *OperatorInfoResponse `json:"modifier_info,omitempty"`
}

// KnowledgeBasePageResponse 兼容 PHP 侧分页结构。
type KnowledgeBasePageResponse struct {
	Page  int                      `json:"page"`
	Total int64                    `json:"total"`
	List  []*KnowledgeBaseResponse `json:"list"`
}

// DocumentResponse 兼容 PHP 侧文档 DTO 输出结构。
type DocumentResponse struct {
	ID                int64                 `json:"id"`
	OrganizationCode  string                `json:"organization_code"`
	KnowledgeBaseCode string                `json:"knowledge_base_code"`
	SourceBindingID   int64                 `json:"source_binding_id"`
	SourceItemID      int64                 `json:"source_item_id"`
	ProjectID         int64                 `json:"project_id"`
	ProjectFileID     int64                 `json:"project_file_id"`
	AutoAdded         bool                  `json:"auto_added"`
	CreatedUID        string                `json:"created_uid"`
	UpdatedUID        string                `json:"updated_uid"`
	Name              string                `json:"name"`
	Description       string                `json:"description"`
	Code              string                `json:"code"`
	Enabled           bool                  `json:"enabled"`
	DocType           int                   `json:"doc_type"`
	DocMetadata       map[string]any        `json:"doc_metadata"`
	StrategyConfig    any                   `json:"strategy_config,omitempty"`
	DocumentFile      any                   `json:"document_file,omitempty"`
	ThirdPlatformType string                `json:"third_platform_type"`
	ThirdFileID       string                `json:"third_file_id"`
	SyncStatus        int                   `json:"sync_status"`
	SyncTimes         int                   `json:"sync_times"`
	SyncStatusMessage string                `json:"sync_status_message"`
	EmbeddingModel    string                `json:"embedding_model"`
	VectorDB          string                `json:"vector_db"`
	RetrieveConfig    any                   `json:"retrieve_config,omitempty"`
	FragmentConfig    any                   `json:"fragment_config,omitempty"`
	EmbeddingConfig   any                   `json:"embedding_config,omitempty"`
	VectorDBConfig    any                   `json:"vector_db_config,omitempty"`
	WordCount         int                   `json:"word_count"`
	CreatedAt         string                `json:"created_at"`
	UpdatedAt         string                `json:"updated_at"`
	CreatorInfo       *OperatorInfoResponse `json:"creator_info,omitempty"`
	ModifierInfo      *OperatorInfoResponse `json:"modifier_info,omitempty"`
	Version           int                   `json:"version"`
}

// DocumentPageResponse 兼容 PHP 侧文档分页结构。
type DocumentPageResponse struct {
	Page  int                 `json:"page"`
	Total int64               `json:"total"`
	List  []*DocumentResponse `json:"list"`
}

// FragmentResponse 兼容 PHP 侧片段 DTO 输出结构。
type FragmentResponse struct {
	ID                int64                 `json:"id"`
	KnowledgeBaseCode string                `json:"knowledge_base_code"`
	KnowledgeCode     string                `json:"knowledge_code"`
	OrganizationCode  string                `json:"organization_code"`
	Creator           string                `json:"creator"`
	Modifier          string                `json:"modifier"`
	CreatedUID        string                `json:"created_uid"`
	UpdatedUID        string                `json:"updated_uid"`
	DocumentCode      string                `json:"document_code"`
	BusinessID        string                `json:"business_id"`
	DocumentName      string                `json:"document_name"`
	DocumentType      int                   `json:"document_type"`
	DocType           int                   `json:"doc_type"`
	Content           string                `json:"content"`
	Metadata          map[string]any        `json:"metadata"`
	SyncStatus        int                   `json:"sync_status"`
	SyncStatusMessage string                `json:"sync_status_message"`
	Score             float64               `json:"score"`
	PointID           string                `json:"point_id"`
	WordCount         int                   `json:"word_count"`
	CreatedAt         string                `json:"created_at"`
	UpdatedAt         string                `json:"updated_at"`
	CreatorInfo       *OperatorInfoResponse `json:"creator_info,omitempty"`
	ModifierInfo      *OperatorInfoResponse `json:"modifier_info,omitempty"`
	Version           int                   `json:"version"`
}

// FragmentPageResponse 兼容 PHP 侧片段分页结构。
type FragmentPageResponse struct {
	Page          int                       `json:"page"`
	Total         int64                     `json:"total"`
	List          []*FragmentResponse       `json:"list"`
	DocumentNodes []fragdto.DocumentNodeDTO `json:"document_nodes,omitempty"`
}

// SimilarityFragmentResponse 兼容普通 similarity HTTP 接口的片段结构。
// 这里将 id 固定投影为字符串，避免前端消费 bigint 精度丢失。
type SimilarityFragmentResponse struct {
	ID                string                `json:"id"`
	KnowledgeBaseCode string                `json:"knowledge_base_code"`
	KnowledgeCode     string                `json:"knowledge_code"`
	OrganizationCode  string                `json:"organization_code"`
	Creator           string                `json:"creator"`
	Modifier          string                `json:"modifier"`
	CreatedUID        string                `json:"created_uid"`
	UpdatedUID        string                `json:"updated_uid"`
	DocumentCode      string                `json:"document_code"`
	BusinessID        string                `json:"business_id"`
	DocumentName      string                `json:"document_name"`
	DocumentType      int                   `json:"document_type"`
	DocType           int                   `json:"doc_type"`
	Content           string                `json:"content"`
	Metadata          map[string]any        `json:"metadata"`
	SyncStatus        int                   `json:"sync_status"`
	SyncStatusMessage string                `json:"sync_status_message"`
	Score             float64               `json:"score"`
	PointID           string                `json:"point_id"`
	WordCount         int                   `json:"word_count"`
	CreatedAt         string                `json:"created_at"`
	UpdatedAt         string                `json:"updated_at"`
	CreatorInfo       *OperatorInfoResponse `json:"creator_info,omitempty"`
	ModifierInfo      *OperatorInfoResponse `json:"modifier_info,omitempty"`
	Version           int                   `json:"version"`
}

// SimilarityPageResponse 兼容 PHP 侧分页包装。
type SimilarityPageResponse struct {
	Page  int                           `json:"page"`
	Total int64                         `json:"total"`
	List  []*SimilarityFragmentResponse `json:"list"`
}

// AgentSimilarityResponse 兼容数字员工知识检索响应。
type AgentSimilarityResponse struct {
	HitCount  int                        `json:"hit_count"`
	Documents []*AgentSimilarityDocument `json:"documents"`
}

// AgentSimilarityDocument 是面向 agent 消费的知识检索文档分组。
type AgentSimilarityDocument struct {
	KnowledgeCode string                    `json:"knowledge_code"`
	DocumentCode  string                    `json:"document_code"`
	DocumentName  string                    `json:"document_name"`
	Snippets      []*AgentSimilaritySnippet `json:"snippets"`
}

// AgentSimilaritySnippet 是文档内命中的知识片段。
type AgentSimilaritySnippet struct {
	Score float64 `json:"score"`
	Text  string  `json:"text"`
}

func newOperatorInfoResponse(userID, datetime string) *OperatorInfoResponse {
	if userID == "" {
		return nil
	}

	return &OperatorInfoResponse{
		ID:        userID,
		UID:       userID,
		Name:      "",
		Time:      datetime,
		Timestamp: parseOperatorTimestamp(datetime),
		Avatar:    "",
	}
}

func parseOperatorTimestamp(datetime string) int64 {
	if datetime == "" {
		return 0
	}
	parsed, err := time.ParseInLocation("2006-01-02 15:04:05", datetime, time.Local)
	if err != nil {
		return 0
	}
	return parsed.Unix()
}

func normalizeDocumentCount(count int64) int {
	if count < 0 {
		return 0
	}
	return int(count)
}

// NewKnowledgeBaseResponse 将知识库 DTO 投影为兼容旧 HTTP 协议的 JSON-RPC 响应。
func NewKnowledgeBaseResponse(kb *kbdto.KnowledgeBaseDTO, documentCount int64) *KnowledgeBaseResponse {
	if kb == nil {
		return nil
	}

	response := &KnowledgeBaseResponse{
		ID:                kb.Code,
		Code:              kb.Code,
		Name:              kb.Name,
		Description:       kb.Description,
		Type:              kb.Type,
		Enabled:           kb.Enabled,
		BusinessID:        kb.BusinessID,
		SyncStatus:        kb.SyncStatus,
		SyncStatusMessage: kb.SyncStatusMessage,
		Model:             kb.Model,
		VectorDB:          kb.VectorDB,
		OrganizationCode:  kb.OrganizationCode,
		Creator:           kb.Creator,
		Modifier:          kb.Modifier,
		CreatedUID:        kb.CreatedUID,
		UpdatedUID:        kb.UpdatedUID,
		CreatedAt:         kb.CreatedAt,
		UpdatedAt:         kb.UpdatedAt,
		FragmentCount:     kb.FragmentCount,
		ExpectedCount:     kb.ExpectedCount,
		CompletedCount:    kb.CompletedCount,
		ExpectedNum:       kb.ExpectedNum,
		CompletedNum:      kb.CompletedNum,
		WordCount:         kb.WordCount,
		DocumentCount:     normalizeDocumentCount(documentCount),
		RetrieveConfig:    normalizeCompatRetrieveConfig(kb.RetrieveConfig),
		EmbeddingConfig:   kb.EmbeddingConfig,
		AgentCodes:        append([]string(nil), kb.AgentCodes...),
		Icon:              kb.Icon,
		CreatorInfo:       newOperatorInfoResponse(kb.Creator, kb.CreatedAt),
		ModifierInfo:      newOperatorInfoResponse(kb.Modifier, kb.UpdatedAt),
	}

	selectKnowledgeBaseResponseProjector(kb)(response, kb)
	return response
}

type knowledgeBaseResponseProjector func(*KnowledgeBaseResponse, *kbdto.KnowledgeBaseDTO)

func selectKnowledgeBaseResponseProjector(kb *kbdto.KnowledgeBaseDTO) knowledgeBaseResponseProjector {
	if kb == nil {
		return projectFlowVectorKnowledgeBaseResponse
	}

	switch strings.ToLower(strings.TrimSpace(kb.KnowledgeBaseType)) {
	case knowledgeBaseTypeDigitalEmployee:
		return projectDigitalEmployeeKnowledgeBaseResponse
	default:
		return projectFlowVectorKnowledgeBaseResponse
	}
}

func projectFlowVectorKnowledgeBaseResponse(resp *KnowledgeBaseResponse, kb *kbdto.KnowledgeBaseDTO) {
	if resp == nil || kb == nil {
		return
	}

	userOperation := kb.UserOperation
	resp.UserOperation = &userOperation
	resp.SourceType = normalizeLegacyFlowSourceType(kb.SourceType)
	resp.FragmentConfig = projectFlowFragmentConfigOutput(kb.FragmentConfig)
}

func projectDigitalEmployeeKnowledgeBaseResponse(resp *KnowledgeBaseResponse, kb *kbdto.KnowledgeBaseDTO) {
	if resp == nil || kb == nil {
		return
	}

	resp.UserOperation = nil
	resp.SourceType = cloneOptionalInt(kb.SourceType)
	resp.FragmentConfig = projectAutoFragmentConfigOutput(kb.FragmentConfig)
}

func normalizeLegacyFlowSourceType(sourceType *int) *int {
	if sourceType != nil {
		return cloneOptionalInt(sourceType)
	}

	value := legacyFlowSourceTypeLocalFile
	return &value
}

func cloneOptionalInt(value *int) *int {
	if value == nil {
		return nil
	}

	cloned := *value
	return &cloned
}

// NewKnowledgeBasePageResponse 将知识库分页结果投影为兼容旧 HTTP 协议的 JSON-RPC 响应。
func NewKnowledgeBasePageResponse(
	page int,
	total int64,
	knowledgeBases []*kbdto.KnowledgeBaseDTO,
	documentCounts map[string]int64,
) *KnowledgeBasePageResponse {
	if documentCounts == nil {
		documentCounts = map[string]int64{}
	}

	list := make([]*KnowledgeBaseResponse, 0, len(knowledgeBases))
	for _, knowledgeBase := range knowledgeBases {
		if knowledgeBase == nil {
			continue
		}
		list = append(list, NewKnowledgeBaseResponse(knowledgeBase, documentCounts[knowledgeBase.Code]))
	}

	return &KnowledgeBasePageResponse{
		Page:  page,
		Total: total,
		List:  list,
	}
}

// NewDocumentResponse 将文档应用 DTO 投影为带固定兼容 version 的 JSON-RPC 响应。
func NewDocumentResponse(doc *docdto.DocumentDTO) *DocumentResponse {
	if doc == nil {
		return nil
	}
	response := &DocumentResponse{
		ID:                doc.ID,
		OrganizationCode:  doc.OrganizationCode,
		KnowledgeBaseCode: doc.KnowledgeBaseCode,
		SourceBindingID:   doc.SourceBindingID,
		SourceItemID:      doc.SourceItemID,
		ProjectID:         doc.ProjectID,
		ProjectFileID:     doc.ProjectFileID,
		AutoAdded:         doc.AutoAdded,
		CreatedUID:        doc.CreatedUID,
		UpdatedUID:        doc.UpdatedUID,
		Name:              doc.Name,
		Description:       doc.Description,
		Code:              doc.Code,
		Enabled:           doc.Enabled,
		DocType:           doc.DocType,
		DocMetadata:       doc.DocMetadata,
		StrategyConfig:    doc.StrategyConfig,
		DocumentFile:      newDocumentFileCompatPayload(doc),
		ThirdPlatformType: doc.ThirdPlatformType,
		ThirdFileID:       doc.ThirdFileID,
		SyncStatus:        doc.SyncStatus,
		SyncTimes:         doc.SyncTimes,
		SyncStatusMessage: doc.SyncStatusMessage,
		EmbeddingModel:    doc.EmbeddingModel,
		VectorDB:          doc.VectorDB,
		RetrieveConfig:    normalizeCompatRetrieveConfig(doc.RetrieveConfig),
		EmbeddingConfig:   doc.EmbeddingConfig,
		VectorDBConfig:    doc.VectorDBConfig,
		WordCount:         doc.WordCount,
		CreatedAt:         doc.CreatedAt,
		UpdatedAt:         doc.UpdatedAt,
		CreatorInfo:       newOperatorInfoResponse(doc.CreatedUID, doc.CreatedAt),
		ModifierInfo:      newOperatorInfoResponse(doc.UpdatedUID, doc.UpdatedAt),
		Version:           rpcCompatVersion,
	}
	selectDocumentResponseProjector(doc)(response, doc)
	return response
}

type documentResponseProjector func(*DocumentResponse, *docdto.DocumentDTO)

func selectDocumentResponseProjector(doc *docdto.DocumentDTO) documentResponseProjector {
	if doc == nil {
		return projectFlowVectorDocumentResponse
	}

	switch strings.ToLower(strings.TrimSpace(doc.KnowledgeBaseType)) {
	case knowledgeBaseTypeDigitalEmployee:
		return projectDigitalEmployeeDocumentResponse
	default:
		return projectFlowVectorDocumentResponse
	}
}

func projectFlowVectorDocumentResponse(resp *DocumentResponse, doc *docdto.DocumentDTO) {
	if resp == nil || doc == nil {
		return
	}
	resp.FragmentConfig = projectFlowFragmentConfig(doc.FragmentConfig)
}

func projectDigitalEmployeeDocumentResponse(resp *DocumentResponse, doc *docdto.DocumentDTO) {
	if resp == nil || doc == nil {
		return
	}
	resp.FragmentConfig = projectAutoFragmentConfig(doc.FragmentConfig)
}

func newDocumentFileCompatPayload(doc *docdto.DocumentDTO) any {
	if doc == nil || doc.DocumentFile == nil {
		return nil
	}

	documentFile := doc.DocumentFile
	payload := map[string]any{
		"type": convertLegacyDocumentFileType(documentFile.Type),
		"name": documentFile.Name,
		"url":  documentFile.URL,
		"size": documentFile.Size,
	}

	if documentFile.Extension != "" {
		payload["extension"] = documentFile.Extension
	}
	if documentFile.KnowledgeBaseID != "" {
		payload["knowledge_base_id"] = documentFile.KnowledgeBaseID
	}
	if documentFile.Key != "" {
		payload["key"] = documentFile.Key
	}
	if documentFile.FileLink != nil {
		payload["file_link"] = documentFile.FileLink
	}

	thirdFileID := firstNonEmptyString(documentFile.ThirdID, doc.ThirdFileID)
	if thirdFileID != "" {
		payload["third_id"] = thirdFileID
		payload["third_file_id"] = thirdFileID
	}

	platformType := firstNonEmptyString(documentFile.SourceType, doc.ThirdPlatformType)
	if platformType != "" {
		payload["source_type"] = platformType
		payload["platform_type"] = platformType
	}

	return payload
}

func convertLegacyDocumentFileType(documentFileType string) any {
	switch strings.TrimSpace(documentFileType) {
	case "external":
		return legacyDocumentFileTypeExternal
	case "third_platform":
		return legacyDocumentFileTypeThirdParty
	default:
		return documentFileType
	}
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func normalizeCompatRetrieveConfig(cfg *confighelper.RetrieveConfigDTO) *confighelper.RetrieveConfigDTO {
	if cfg != nil {
		return confighelper.RetrieveConfigEntityToDTO(confighelper.RetrieveConfigDTOToEntity(cfg))
	}
	return &confighelper.RetrieveConfigDTO{
		Version:               defaultRetrieveConfigVersion,
		SearchMethod:          defaultRetrieveSearchMethod,
		TopK:                  defaultRetrieveTopK,
		ScoreThreshold:        defaultScoreThreshold,
		ScoreThresholdEnabled: false,
		RerankingMode:         defaultRerankingMode,
		RerankingEnable:       false,
		Weights: &confighelper.RetrieveWeightsDTO{
			VectorSetting: &confighelper.VectorWeightSettingDTO{
				VectorWeight:          defaultVectorWeight,
				EmbeddingModelName:    "",
				EmbeddingProviderName: "",
			},
			KeywordSetting: &confighelper.KeywordWeightSettingDTO{
				KeywordWeight: defaultKeywordWeight,
			},
			GraphSetting: &confighelper.GraphWeightSettingDTO{
				RelationWeight:    defaultGraphRelationWeight,
				MaxDepth:          defaultGraphMaxDepth,
				IncludeProperties: true,
				Timeout:           defaultGraphTimeout,
				RetryCount:        defaultGraphRetryCount,
			},
		},
		RerankingModel: &confighelper.RerankingModelConfigDTO{
			RerankingModelName:    "",
			RerankingProviderName: "",
		},
	}
}

func projectFlowFragmentConfigOutput(
	cfg *confighelper.FragmentConfigOutputDTO,
) *confighelper.FragmentConfigOutputDTO {
	if isDefaultAutoFragmentConfigOutput(cfg) {
		return newFlowDefaultFragmentConfigOutput()
	}
	return confighelper.NormalizeFragmentConfigOutputDTO(cfg)
}

func projectAutoFragmentConfigOutput(
	cfg *confighelper.FragmentConfigOutputDTO,
) *confighelper.FragmentConfigOutputDTO {
	if isDefaultAutoFragmentConfigOutput(cfg) {
		return newAutoDefaultFragmentConfigOutput()
	}
	return confighelper.NormalizeFragmentConfigOutputDTO(cfg)
}

func projectFlowFragmentConfig(cfg *confighelper.FragmentConfigDTO) *confighelper.FragmentConfigDTO {
	if isDefaultAutoFragmentConfig(cfg) {
		return newFlowDefaultFragmentConfig()
	}
	return confighelper.NormalizeFragmentConfigDTO(cfg)
}

func projectAutoFragmentConfig(cfg *confighelper.FragmentConfigDTO) *confighelper.FragmentConfigDTO {
	if isDefaultAutoFragmentConfig(cfg) {
		return newAutoDefaultFragmentConfig()
	}
	return confighelper.NormalizeFragmentConfigDTO(cfg)
}

func isDefaultAutoFragmentConfigOutput(cfg *confighelper.FragmentConfigOutputDTO) bool {
	return cfg == nil || (cfg.Mode == fragmentModeAuto && cfg.Normal == nil && cfg.Hierarchy == nil)
}

func isDefaultAutoFragmentConfig(cfg *confighelper.FragmentConfigDTO) bool {
	return cfg == nil || (cfg.Mode == fragmentModeAuto && cfg.Normal == nil && cfg.Hierarchy == nil)
}

func newFlowDefaultFragmentConfigOutput() *confighelper.FragmentConfigOutputDTO {
	return &confighelper.FragmentConfigOutputDTO{
		Mode: fragmentModeCustom,
		Normal: &confighelper.NormalFragmentConfigOutputDTO{
			TextPreprocessRule: []int{flowDefaultTextPreprocessRule},
			SegmentRule: &confighelper.SegmentRuleOutputDTO{
				Separator:        flowDefaultSeparator,
				ChunkSize:        flowDefaultChunkSize,
				ChunkOverlap:     flowDefaultChunkOverlap,
				ChunkOverlapUnit: confighelper.ChunkOverlapUnitAbsolute,
			},
		},
	}
}

func newAutoDefaultFragmentConfigOutput() *confighelper.FragmentConfigOutputDTO {
	return &confighelper.FragmentConfigOutputDTO{
		Mode: fragmentModeAuto,
	}
}

func newFlowDefaultFragmentConfig() *confighelper.FragmentConfigDTO {
	return &confighelper.FragmentConfigDTO{
		Mode: fragmentModeCustom,
		Normal: &confighelper.NormalFragmentConfigDTO{
			TextPreprocessRule: []int{flowDefaultTextPreprocessRule},
			SegmentRule: &confighelper.SegmentRuleDTO{
				Separator:        flowDefaultSeparator,
				ChunkSize:        flowDefaultChunkSize,
				ChunkOverlap:     flowDefaultChunkOverlap,
				ChunkOverlapUnit: confighelper.ChunkOverlapUnitAbsolute,
			},
		},
	}
}

func newAutoDefaultFragmentConfig() *confighelper.FragmentConfigDTO {
	return &confighelper.FragmentConfigDTO{
		Mode: fragmentModeAuto,
	}
}

// NewDocumentPageResponse 将文档分页结果投影为兼容旧 HTTP 协议的 JSON-RPC 响应。
func NewDocumentPageResponse(page int, total int64, documents []*docdto.DocumentDTO) *DocumentPageResponse {
	return &DocumentPageResponse{
		Page:  page,
		Total: total,
		List:  NewDocumentResponses(documents),
	}
}

// NewDocumentResponses 将文档 DTO 列表投影为兼容旧 HTTP 协议的 JSON-RPC 响应列表。
func NewDocumentResponses(documents []*docdto.DocumentDTO) []*DocumentResponse {
	if len(documents) == 0 {
		return []*DocumentResponse{}
	}

	responses := make([]*DocumentResponse, 0, len(documents))
	for _, document := range documents {
		if document == nil {
			continue
		}
		responses = append(responses, NewDocumentResponse(document))
	}
	return responses
}

// NewFragmentResponse 将片段应用 DTO 投影为带固定兼容 version 的 JSON-RPC 响应。
func NewFragmentResponse(fragment *fragdto.FragmentDTO) *FragmentResponse {
	if fragment == nil {
		return nil
	}
	return &FragmentResponse{
		ID:                fragment.ID,
		KnowledgeBaseCode: fragment.KnowledgeCode,
		KnowledgeCode:     fragment.KnowledgeCode,
		OrganizationCode:  fragment.OrganizationCode,
		Creator:           fragment.Creator,
		Modifier:          fragment.Modifier,
		CreatedUID:        fragment.CreatedUID,
		UpdatedUID:        fragment.UpdatedUID,
		DocumentCode:      fragment.DocumentCode,
		BusinessID:        fragment.BusinessID,
		DocumentName:      fragment.DocumentName,
		DocumentType:      fragment.DocumentType,
		DocType:           fragment.DocumentType,
		Content:           fragment.Content,
		Metadata:          fragment.Metadata,
		SyncStatus:        fragment.SyncStatus,
		SyncStatusMessage: fragment.SyncStatusMessage,
		Score:             0,
		PointID:           fragment.PointID,
		WordCount:         fragment.WordCount,
		CreatedAt:         fragment.CreatedAt,
		UpdatedAt:         fragment.UpdatedAt,
		CreatorInfo:       newOperatorInfoResponse(fragment.Creator, fragment.CreatedAt),
		ModifierInfo:      newOperatorInfoResponse(fragment.Modifier, fragment.UpdatedAt),
		Version:           rpcCompatVersion,
	}
}

// NewFragmentListResponse 将片段列表 DTO 投影为兼容旧 HTTP 协议的 JSON-RPC 响应。
func NewFragmentListResponse(fragment *fragdto.FragmentListItemDTO) *FragmentResponse {
	if fragment == nil {
		return nil
	}
	return &FragmentResponse{
		ID:                fragment.ID,
		KnowledgeBaseCode: fragment.KnowledgeBaseCode,
		KnowledgeCode:     fragment.KnowledgeCode,
		OrganizationCode:  fragment.OrganizationCode,
		Creator:           fragment.Creator,
		Modifier:          fragment.Modifier,
		CreatedUID:        fragment.CreatedUID,
		UpdatedUID:        fragment.UpdatedUID,
		DocumentCode:      fragment.DocumentCode,
		BusinessID:        fragment.BusinessID,
		DocumentName:      fragment.DocumentName,
		DocumentType:      fragment.DocumentType,
		DocType:           fragment.DocType,
		Content:           fragment.Content,
		Metadata:          fragment.Metadata,
		SyncStatus:        fragment.SyncStatus,
		SyncStatusMessage: fragment.SyncStatusMessage,
		Score:             fragment.Score,
		PointID:           fragment.PointID,
		WordCount:         fragment.WordCount,
		CreatedAt:         fragment.CreatedAt,
		UpdatedAt:         fragment.UpdatedAt,
		CreatorInfo:       newOperatorInfoResponse(fragment.Creator, fragment.CreatedAt),
		ModifierInfo:      newOperatorInfoResponse(fragment.Modifier, fragment.UpdatedAt),
		Version:           fragment.Version,
	}
}

// NewFragmentPageResponse 将片段分页 DTO 投影为兼容旧 HTTP 协议的 JSON-RPC 响应。
func NewFragmentPageResponse(page *fragdto.FragmentPageResultDTO) *FragmentPageResponse {
	if page == nil {
		return nil
	}

	list := make([]*FragmentResponse, 0, len(page.List))
	for _, item := range page.List {
		if item == nil {
			continue
		}
		list = append(list, NewFragmentListResponse(item))
	}

	return &FragmentPageResponse{
		Page:          page.Page,
		Total:         page.Total,
		List:          list,
		DocumentNodes: append([]fragdto.DocumentNodeDTO{}, page.DocumentNodes...),
	}
}

// NewSimilarityResponse 将相似度结果 DTO 投影为兼容旧 HTTP 协议的 JSON-RPC 响应。
func NewSimilarityResponse(result *fragdto.SimilarityResultDTO) *SimilarityFragmentResponse {
	if result == nil {
		return nil
	}
	return &SimilarityFragmentResponse{
		ID:                strconv.FormatInt(result.ID, 10),
		KnowledgeBaseCode: result.KnowledgeBaseCode,
		KnowledgeCode:     result.KnowledgeCode,
		DocumentCode:      result.DocumentCode,
		BusinessID:        result.BusinessID,
		DocumentName:      result.DocumentName,
		DocumentType:      result.DocumentType,
		DocType:           result.DocType,
		Content:           result.Content,
		Metadata:          result.Metadata,
		Score:             result.Score,
		WordCount:         result.WordCount,
		Version:           rpcCompatVersion,
	}
}

// NewSimilarityPageResponse 将相似度结果分页投影为兼容旧 HTTP 协议的 JSON-RPC 响应。
func NewSimilarityPageResponse(results []*fragdto.SimilarityResultDTO) *SimilarityPageResponse {
	list := make([]*SimilarityFragmentResponse, 0, len(results))
	for _, item := range results {
		if item == nil {
			continue
		}
		list = append(list, NewSimilarityResponse(item))
	}

	return &SimilarityPageResponse{
		Page:  1,
		Total: int64(len(results)),
		List:  list,
	}
}

// NewAgentSimilarityResponse 投影数字员工维度知识检索结果。
func NewAgentSimilarityResponse(result *fragdto.AgentSimilarityResultDTO) *AgentSimilarityResponse {
	if result == nil {
		return &AgentSimilarityResponse{
			Documents: []*AgentSimilarityDocument{},
		}
	}
	documents := make([]*AgentSimilarityDocument, 0, len(result.Hits))
	documentByKey := make(map[agentSimilarityDocumentKey]*AgentSimilarityDocument)
	hitCount := 0
	for _, item := range result.Hits {
		if item == nil {
			continue
		}
		key, document := newAgentSimilarityDocument(item)
		existing, ok := documentByKey[key]
		if !ok {
			existing = document
			documentByKey[key] = existing
			documents = append(documents, existing)
		}
		existing.Snippets = append(existing.Snippets, newAgentSimilaritySnippet(item))
		hitCount++
	}

	return &AgentSimilarityResponse{
		HitCount:  hitCount,
		Documents: documents,
	}
}

type agentSimilarityDocumentKey struct {
	knowledgeCode string
	documentCode  string
	documentName  string
}

func newAgentSimilarityDocument(hit *fragdto.SimilarityResultDTO) (agentSimilarityDocumentKey, *AgentSimilarityDocument) {
	knowledgeCode := hit.KnowledgeCode
	if knowledgeCode == "" {
		knowledgeCode = hit.KnowledgeBaseCode
	}
	key := agentSimilarityDocumentKey{
		knowledgeCode: knowledgeCode,
		documentCode:  hit.DocumentCode,
		documentName:  hit.DocumentName,
	}
	return key, &AgentSimilarityDocument{
		KnowledgeCode: knowledgeCode,
		DocumentCode:  hit.DocumentCode,
		DocumentName:  hit.DocumentName,
		Snippets:      []*AgentSimilaritySnippet{},
	}
}

func newAgentSimilaritySnippet(hit *fragdto.SimilarityResultDTO) *AgentSimilaritySnippet {
	return &AgentSimilaritySnippet{
		Score: roundAgentSimilarityScore(hit.Score),
		Text:  hit.Content,
	}
}

func roundAgentSimilarityScore(score float64) float64 {
	return math.Round(score*100) / 100
}
