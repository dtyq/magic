package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	docdto "magic/internal/application/knowledge/document/dto"
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/pkg/timeformat"
)

var (
	errManagedDocumentAppRequired    = errors.New("managed document app is required")
	errManagedDocumentInputRequired  = errors.New("managed document input is required")
	errManagedDocumentResultRequired = errors.New("managed document result is required")
)

const managedDocumentListLimit = 10_000

// ManagedDocumentDTO 表示对外暴露的最小托管文档信息。
type ManagedDocumentDTO struct {
	Code              string
	KnowledgeBaseCode string
	SourceBindingID   int64
	SourceItemID      int64
	ProjectID         int64
	ProjectFileID     int64
	DocumentFile      *documentdomain.File
}

// ManagedDocumentAppService 承接知识库侧托管文档协作流程。
type ManagedDocumentAppService struct {
	support *DocumentAppService
}

// NewManagedDocumentAppService 创建托管文档协作应用服务。
func NewManagedDocumentAppService(support *DocumentAppService) *ManagedDocumentAppService {
	return &ManagedDocumentAppService{support: support}
}

// ManagedDocumentApp 返回知识库侧托管文档协作应用服务。
func (s *DocumentAppService) ManagedDocumentApp() *ManagedDocumentAppService {
	if s == nil {
		return nil
	}
	return NewManagedDocumentAppService(s)
}

// CreateManagedDocument 实现知识库侧托管文档创建协作接口。
func (s *ManagedDocumentAppService) CreateManagedDocument(
	ctx context.Context,
	input *documentdomain.CreateManagedDocumentInput,
) (*ManagedDocumentDTO, error) {
	if s == nil || s.support == nil {
		return nil, errManagedDocumentAppRequired
	}
	if input == nil {
		return nil, errManagedDocumentInputRequired
	}

	documentDTO, err := s.support.createManagedDocument(ctx, input)
	if err != nil {
		return nil, err
	}
	if documentDTO == nil {
		return nil, errManagedDocumentResultRequired
	}
	if input.AutoSync {
		s.support.scheduleCreateSync(ctx, input.OrganizationCode, input.UserID, input.KnowledgeBaseCode, documentDTO.Code)
	}
	return &ManagedDocumentDTO{
		Code:              documentDTO.Code,
		KnowledgeBaseCode: documentDTO.KnowledgeBaseCode,
		SourceBindingID:   documentDTO.SourceBindingID,
		SourceItemID:      documentDTO.SourceItemID,
		ProjectID:         documentDTO.ProjectID,
		ProjectFileID:     documentDTO.ProjectFileID,
		DocumentFile:      documentFileDTOToDomain(documentDTO.DocumentFile),
	}, nil
}

// ListManagedDocumentsByKnowledgeBaseAndProject 实现知识库侧项目文档读取协作接口。
func (s *ManagedDocumentAppService) ListManagedDocumentsByKnowledgeBaseAndProject(
	ctx context.Context,
	knowledgeBaseCode string,
	projectID int64,
) ([]*ManagedDocumentDTO, error) {
	if s == nil || s.support == nil {
		return nil, errManagedDocumentAppRequired
	}
	docs, err := s.support.domainService.ListByKnowledgeBaseAndProject(ctx, knowledgeBaseCode, projectID)
	if err != nil {
		return nil, fmt.Errorf("list managed documents by knowledge base and project: %w", err)
	}
	return managedDocumentsToDTOs(docs), nil
}

// ListManagedDocumentsByKnowledgeBase 实现知识库侧按知识库读取文档接口。
func (s *ManagedDocumentAppService) ListManagedDocumentsByKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
) ([]*ManagedDocumentDTO, error) {
	if s == nil || s.support == nil {
		return nil, errManagedDocumentAppRequired
	}
	docs, _, err := s.support.domainService.ListByKnowledgeBase(ctx, knowledgeBaseCode, 0, managedDocumentListLimit)
	if err != nil {
		return nil, fmt.Errorf("list managed documents by knowledge base: %w", err)
	}
	return managedDocumentsToDTOs(docs), nil
}

// DestroyManagedDocument 实现知识库侧托管文档删除协作接口。
func (s *ManagedDocumentAppService) DestroyManagedDocument(ctx context.Context, code, knowledgeBaseCode string) error {
	if s == nil || s.support == nil {
		return errManagedDocumentAppRequired
	}
	return NewDocumentDestroyAppService(s.support).DestroyManagedDocument(ctx, code, knowledgeBaseCode)
}

// ScheduleManagedDocumentSync 实现知识库侧托管文档调度协作接口。
func (s *ManagedDocumentAppService) ScheduleManagedDocumentSync(ctx context.Context, input *documentdomain.SyncDocumentInput) {
	if s == nil || s.support == nil {
		return
	}
	s.support.ScheduleSync(ctx, input)
}

// SplitParsedDocumentToChunks 实现预览切片协作接口。
func (s *DocumentAppService) SplitParsedDocumentToChunks(
	ctx context.Context,
	input documentsplitter.ParsedDocumentChunkInput,
) ([]documentsplitter.TokenChunk, string, error) {
	chunks, splitVersion, err := documentsplitter.SplitParsedDocumentToChunks(ctx, input)
	if err != nil {
		return nil, "", fmt.Errorf("split parsed document to chunks: %w", err)
	}

	return chunks, splitVersion, nil
}

// EntityToDTO 将文档实体映射为查询 DTO。
func EntityToDTO(e *documentdomain.KnowledgeBaseDocument) *docdto.DocumentDTO {
	if e == nil {
		return nil
	}

	dto := &docdto.DocumentDTO{
		ID:                e.ID,
		OrganizationCode:  e.OrganizationCode,
		KnowledgeBaseCode: e.KnowledgeBaseCode,
		SourceBindingID:   e.SourceBindingID,
		SourceItemID:      e.SourceItemID,
		ProjectID:         e.ProjectID,
		ProjectFileID:     e.ProjectFileID,
		AutoAdded:         e.AutoAdded,
		CreatedUID:        e.CreatedUID,
		UpdatedUID:        e.UpdatedUID,
		Name:              e.Name,
		Description:       e.Description,
		Code:              e.Code,
		Enabled:           e.Enabled,
		DocType:           e.DocType,
		DocMetadata:       e.DocMetadata,
		StrategyConfig:    confighelper.StrategyConfigDTOFromMetadata(e.DocMetadata),
		ThirdPlatformType: e.ThirdPlatformType,
		ThirdFileID:       e.ThirdFileID,
		SyncStatus:        int(e.SyncStatus),
		SyncTimes:         e.SyncTimes,
		SyncStatusMessage: e.SyncStatusMessage,
		EmbeddingModel:    e.EmbeddingModel,
		VectorDB:          e.VectorDB,
		EmbeddingConfig:   confighelper.EmbeddingConfigEntityToDTO(e.EmbeddingConfig),
		VectorDBConfig:    confighelper.VectorDBConfigEntityToDTO(e.VectorDBConfig),
		WordCount:         e.WordCount,
		CreatedAt:         timeformat.FormatAPIDatetime(e.CreatedAt),
		UpdatedAt:         timeformat.FormatAPIDatetime(e.UpdatedAt),
	}

	if e.DocumentFile != nil {
		documentFileKey := resolveDocumentFileDTOKey(e.DocumentFile)
		dto.DocumentFile = &docfilehelper.DocumentFileDTO{
			Type:            e.DocumentFile.Type,
			Name:            e.DocumentFile.Name,
			URL:             e.DocumentFile.URL,
			Key:             documentFileKey,
			Size:            e.DocumentFile.Size,
			Extension:       e.DocumentFile.Extension,
			ThirdID:         e.DocumentFile.ThirdID,
			SourceType:      e.DocumentFile.SourceType,
			KnowledgeBaseID: e.DocumentFile.KnowledgeBaseID,
		}
	}

	if e.RetrieveConfig != nil {
		dto.RetrieveConfig = confighelper.RetrieveConfigEntityToDTO(e.RetrieveConfig)
	}

	dto.FragmentConfig = confighelper.FragmentConfigEntityToDTO(e.FragmentConfig)
	return dto
}

func resolveDocumentFileDTOKey(file *documentdomain.File) string {
	if file == nil {
		return ""
	}
	if key := strings.TrimSpace(file.FileKey); key != "" {
		return key
	}

	url := strings.TrimSpace(file.URL)
	if url == "" || strings.Contains(url, "://") {
		return ""
	}
	return url
}

func managedDocumentsToDTOs(docs []*documentdomain.KnowledgeBaseDocument) []*ManagedDocumentDTO {
	results := make([]*ManagedDocumentDTO, 0, len(docs))
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		results = append(results, &ManagedDocumentDTO{
			Code:              doc.Code,
			KnowledgeBaseCode: doc.KnowledgeBaseCode,
			SourceBindingID:   doc.SourceBindingID,
			SourceItemID:      doc.SourceItemID,
			ProjectID:         doc.ProjectID,
			ProjectFileID:     doc.ProjectFileID,
			DocumentFile:      doc.DocumentFile,
		})
	}
	return results
}

// ApplyEffectiveModel 将解析后的有效模型回填到 DTO。
func ApplyEffectiveModel(dto *docdto.DocumentDTO, effectiveModel string) *docdto.DocumentDTO {
	if dto == nil {
		return nil
	}
	dto.EmbeddingModel = effectiveModel
	dto.EmbeddingConfig = confighelper.CloneEmbeddingConfigWithModel(dto.EmbeddingConfig, effectiveModel)
	return dto
}

// ApplyKnowledgeBaseType 将知识库产品线回填到文档 DTO。
func ApplyKnowledgeBaseType(
	dto *docdto.DocumentDTO,
	knowledgeBaseType knowledgebasedomain.Type,
) *docdto.DocumentDTO {
	if dto == nil {
		return nil
	}
	dto.KnowledgeBaseType = string(knowledgebasedomain.NormalizeKnowledgeBaseTypeOrDefault(knowledgeBaseType))
	return dto
}
