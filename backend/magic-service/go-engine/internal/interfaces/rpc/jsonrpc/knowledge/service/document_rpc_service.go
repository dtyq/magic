package service

import (
	"context"
	"errors"
	"fmt"

	docdto "magic/internal/application/knowledge/document/dto"
	documentapp "magic/internal/application/knowledge/document/service"
	pagehelper "magic/internal/application/knowledge/helper/page"
	"magic/internal/infrastructure/logging"
	"magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
	"magic/internal/pkg/ctxmeta"
)

var errUnexpectedDocumentListResultType = errors.New("unexpected document list result type")

type documentQueryApplicationService interface {
	Show(ctx context.Context, code, knowledgeBaseCode, organizationCode, userID string) (*docdto.DocumentDTO, error)
	GetOriginalFileLink(ctx context.Context, code, knowledgeBaseCode, organizationCode, userID string) (*docdto.OriginalFileLinkDTO, error)
	List(ctx context.Context, input *docdto.ListDocumentInput) (*pagehelper.Result, error)
	GetByThirdFileID(ctx context.Context, input *docdto.GetDocumentsByThirdFileIDInput) ([]*docdto.DocumentDTO, error)
	CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error)
}

type documentCreateApplicationService interface {
	Create(ctx context.Context, input *docdto.CreateDocumentInput) (*docdto.DocumentDTO, error)
}

type documentUpdateApplicationService interface {
	Update(ctx context.Context, input *docdto.UpdateDocumentInput) (*docdto.DocumentDTO, error)
}

type documentDestroyApplicationService interface {
	Destroy(ctx context.Context, code, knowledgeBaseCode, organizationCode, userID string) error
}

type documentSyncApplicationService interface {
	ScheduleSync(ctx context.Context, input *documentapp.SyncDocumentInput)
}

type documentThirdFileRevectorizeApplicationService interface {
	ReVectorizedByThirdFileID(ctx context.Context, input *docdto.ReVectorizedByThirdFileIDInput) error
}

type documentProjectFileChangeApplicationService interface {
	NotifyProjectFileChange(ctx context.Context, input *docdto.NotifyProjectFileChangeInput) error
}

type documentApplicationService interface {
	documentQueryApplicationService
	documentCreateApplicationService
	documentUpdateApplicationService
	documentDestroyApplicationService
	documentSyncApplicationService
	documentThirdFileRevectorizeApplicationService
	documentProjectFileChangeApplicationService
}

type documentRPCServiceDeps struct {
	queryService             documentQueryApplicationService
	createService            documentCreateApplicationService
	updateService            documentUpdateApplicationService
	destroyService           documentDestroyApplicationService
	syncService              documentSyncApplicationService
	thirdFileRevectorize     documentThirdFileRevectorizeApplicationService
	projectFileChangeService documentProjectFileChangeApplicationService
}

// DocumentRPCService 文档 RPC 处理器
type DocumentRPCService struct {
	queryService             documentQueryApplicationService
	createService            documentCreateApplicationService
	updateService            documentUpdateApplicationService
	destroyService           documentDestroyApplicationService
	syncService              documentSyncApplicationService
	thirdFileRevectorize     documentThirdFileRevectorizeApplicationService
	projectFileChangeService documentProjectFileChangeApplicationService
	logger                   *logging.SugaredLogger
}

// NewDocumentRPCService 创建文档 RPC 处理器
func NewDocumentRPCService(
	appService *documentapp.DocumentAppService,
	logger *logging.SugaredLogger,
) *DocumentRPCService {
	return newDocumentRPCService(documentRPCServiceDeps{
		queryService:             appService,
		createService:            documentapp.NewDocumentCreateAppService(appService),
		updateService:            documentapp.NewDocumentUpdateAppService(appService),
		destroyService:           documentapp.NewDocumentDestroyAppService(appService),
		syncService:              documentapp.NewDocumentSyncAppService(appService),
		thirdFileRevectorize:     documentapp.NewThirdFileRevectorizeAppService(appService),
		projectFileChangeService: documentapp.NewProjectFileChangeAppService(appService),
	}, logger)
}

// NewDocumentRPCServiceWithDependencies 创建支持接口替身的文档 RPC 处理器。
func NewDocumentRPCServiceWithDependencies(
	appService documentApplicationService,
	logger *logging.SugaredLogger,
) *DocumentRPCService {
	return newDocumentRPCService(documentRPCServiceDeps{
		queryService:             appService,
		createService:            appService,
		updateService:            appService,
		destroyService:           appService,
		syncService:              appService,
		thirdFileRevectorize:     appService,
		projectFileChangeService: appService,
	}, logger)
}

func newDocumentRPCService(
	deps documentRPCServiceDeps,
	logger *logging.SugaredLogger,
) *DocumentRPCService {
	return &DocumentRPCService{
		queryService:             deps.queryService,
		createService:            deps.createService,
		updateService:            deps.updateService,
		destroyService:           deps.destroyService,
		syncService:              deps.syncService,
		thirdFileRevectorize:     deps.thirdFileRevectorize,
		projectFileChangeService: deps.projectFileChangeService,
		logger:                   logger,
	}
}

// ==================== 新的强类型 RPC 方法 ====================

// CreateRPC 创建文档（RPC 版本）
func (h *DocumentRPCService) CreateRPC(ctx context.Context, req *dto.CreateDocumentRequest) (*dto.DocumentResponse, error) {
	ctx = ctxmeta.WithAccessActor(ctx, ctxmeta.AccessActor{
		OrganizationCode: req.OrganizationCode,
		UserID:           req.UserID,
	})
	input := &docdto.CreateDocumentInput{
		OrganizationCode:  req.OrganizationCode,
		UserID:            req.UserID,
		KnowledgeBaseCode: req.KnowledgeBaseCode,
		Name:              req.Name,
		Description:       req.Description,
		DocType:           req.DocType,
		DocMetadata:       req.DocMetadata,
		StrategyConfig:    req.StrategyConfig,
		DocumentFile:      req.DocumentFile,
		ThirdPlatformType: req.ThirdPlatformType,
		ThirdFileID:       req.ThirdFileID,
		EmbeddingModel:    req.EmbeddingModel,
		VectorDB:          req.VectorDB,
		RetrieveConfig:    req.RetrieveConfig,
		FragmentConfig:    req.FragmentConfig,
		EmbeddingConfig:   req.EmbeddingConfig,
		VectorDBConfig:    req.VectorDBConfig,
		AutoSync:          true,
		WaitForSyncResult: false,
	}

	result, err := h.createService.Create(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to create document", "error", err)
		return nil, mapBusinessError(err)
	}

	return dto.NewDocumentResponse(result), nil
}

// UpdateRPC 更新文档（RPC 版本）
func (h *DocumentRPCService) UpdateRPC(ctx context.Context, req *dto.UpdateDocumentRequest) (*dto.DocumentResponse, error) {
	ctx = ctxmeta.WithAccessActor(ctx, ctxmeta.AccessActor{
		OrganizationCode: req.OrganizationCode,
		UserID:           req.UserID,
	})
	input := &docdto.UpdateDocumentInput{
		OrganizationCode:  req.OrganizationCode,
		UserID:            req.UserID,
		Code:              req.Code,
		KnowledgeBaseCode: req.KnowledgeBaseCode,
		Name:              req.Name,
		Description:       req.Description,
		Enabled:           req.Enabled,
		DocType:           req.DocType,
		DocMetadata:       req.DocMetadata,
		StrategyConfig:    req.StrategyConfig,
		DocumentFile:      req.DocumentFile,
		RetrieveConfig:    req.RetrieveConfig,
		FragmentConfig:    req.FragmentConfig,
		WordCount:         req.WordCount,
		WaitForSyncResult: false,
	}

	result, err := h.updateService.Update(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to update document", "error", err)
		return nil, mapBusinessError(err)
	}

	return dto.NewDocumentResponse(result), nil
}

// ShowRPC 查询文档详情（RPC 版本）
func (h *DocumentRPCService) ShowRPC(ctx context.Context, req *dto.ShowDocumentRequest) (*dto.DocumentResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	result, err := h.queryService.Show(
		ctx,
		req.Code,
		req.KnowledgeBaseCode,
		req.DataIsolation.ResolveOrganizationCode(),
		req.DataIsolation.UserID,
	)
	if err != nil {
		return nil, mapBusinessError(err)
	}

	return dto.NewDocumentResponse(result), nil
}

// GetOriginalFileLinkRPC 获取文档原始文件访问链接（RPC 版本）。
func (h *DocumentRPCService) GetOriginalFileLinkRPC(
	ctx context.Context,
	req *dto.GetOriginalFileLinkRequest,
) (*dto.OriginalFileLinkResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	result, err := h.queryService.GetOriginalFileLink(
		ctx,
		req.Code,
		req.KnowledgeBaseCode,
		req.DataIsolation.ResolveOrganizationCode(),
		req.DataIsolation.UserID,
	)
	if err != nil {
		return nil, mapBusinessError(err)
	}

	return &dto.OriginalFileLinkResponse{
		Available: result.Available,
		URL:       result.URL,
		Name:      result.Name,
		Key:       result.Key,
		Type:      result.Type,
	}, nil
}

// ListRPC 查询文档列表（RPC 版本）
func (h *DocumentRPCService) ListRPC(ctx context.Context, req *dto.ListDocumentRequest) (*dto.DocumentPageResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, dto.DataIsolation{
		OrganizationCode:              req.OrganizationCode,
		UserID:                        req.DataIsolation.UserID,
		ThirdPlatformUserID:           req.DataIsolation.ThirdPlatformUserID,
		ThirdPlatformOrganizationCode: req.DataIsolation.ThirdPlatformOrganizationCode,
	})
	input := &docdto.ListDocumentInput{
		OrganizationCode:  req.OrganizationCode,
		UserID:            req.DataIsolation.UserID,
		KnowledgeBaseCode: req.KnowledgeBaseCode,
		Name:              req.Name,
		DocType:           req.DocType,
		Enabled:           req.Enabled,
		SyncStatus:        req.SyncStatus,
		Offset:            req.Page.Offset,
		Limit:             req.Page.Limit,
	}

	result, err := h.queryService.List(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to list documents", "error", err)
		return nil, mapBusinessError(err)
	}

	documents, ok := result.List.([]*docdto.DocumentDTO)
	if result.List == nil {
		documents = []*docdto.DocumentDTO{}
		ok = true
	}
	if !ok {
		return nil, mapBusinessError(fmt.Errorf("%w: %T", errUnexpectedDocumentListResultType, result.List))
	}

	return dto.NewDocumentPageResponse(
		resolveOffsetPage(req.Page.Offset, req.Page.Limit),
		result.Total,
		documents,
	), nil
}

// GetByThirdFileIdRPC 按第三方文件查询文档。
func (h *DocumentRPCService) GetByThirdFileIdRPC(
	ctx context.Context,
	req *dto.GetDocumentsByThirdFileIdRequest,
) ([]*dto.DocumentResponse, error) {
	results, err := h.queryService.GetByThirdFileID(ctx, &docdto.GetDocumentsByThirdFileIDInput{
		OrganizationCode:  req.DataIsolation.ResolveOrganizationCode(),
		KnowledgeBaseCode: req.KnowledgeBaseCode,
		ThirdPlatformType: req.ThirdPlatformType,
		ThirdFileID:       req.ThirdFileID,
	})
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to get documents by third file id", "error", err)
		return nil, mapBusinessError(err)
	}

	return dto.NewDocumentResponses(results), nil
}

// CountByKnowledgeBaseCodesRPC 按知识库批量统计文档数量（RPC 版本）
func (h *DocumentRPCService) CountByKnowledgeBaseCodesRPC(ctx context.Context, req *dto.CountByKnowledgeBaseCodesRequest) (map[string]int64, error) {
	result, err := h.queryService.CountByKnowledgeBaseCodes(ctx, req.DataIsolation.ResolveOrganizationCode(), req.KnowledgeBaseCodes)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to count documents by knowledge base codes", "error", err)
		return nil, mapBusinessError(err)
	}

	return result, nil
}

// DestroyRPC 删除文档（RPC 版本）
func (h *DocumentRPCService) DestroyRPC(ctx context.Context, req *dto.DestroyDocumentRequest) (*map[string]bool, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	if err := h.destroyService.Destroy(
		ctx,
		req.Code,
		req.KnowledgeBaseCode,
		req.DataIsolation.ResolveOrganizationCode(),
		req.DataIsolation.UserID,
	); err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to destroy document", "error", err)
		return nil, mapBusinessError(err)
	}

	return &map[string]bool{"success": true}, nil
}

// SyncRPC 同步文档（RPC 版本）
func (h *DocumentRPCService) SyncRPC(ctx context.Context, req *dto.SyncDocumentRequest) (*map[string]bool, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	input := &documentapp.SyncDocumentInput{
		OrganizationCode:  req.DataIsolation.ResolveOrganizationCode(),
		KnowledgeBaseCode: req.KnowledgeBaseCode,
		Code:              req.Code,
		Mode:              req.Mode,
		Async:             true,
		RevectorizeSource: req.RevectorizeSource,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: req.BusinessParams.ResolveOrganizationCode(),
			UserID:           req.BusinessParams.UserID,
			BusinessID:       req.BusinessParams.BusinessID,
		},
	}

	h.syncService.ScheduleSync(ctx, input)
	return &map[string]bool{"success": true}, nil
}

// ReVectorizedByThirdFileIdRPC 按第三方文件触发文档重向量化。
func (h *DocumentRPCService) ReVectorizedByThirdFileIdRPC(
	ctx context.Context,
	req *dto.ReVectorizedByThirdFileIdRequest,
) (*map[string]bool, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	input := &docdto.ReVectorizedByThirdFileIDInput{
		OrganizationCode:              req.DataIsolation.ResolveOrganizationCode(),
		UserID:                        req.DataIsolation.UserID,
		ThirdPlatformUserID:           req.DataIsolation.ThirdPlatformUserID,
		ThirdPlatformOrganizationCode: req.DataIsolation.ThirdPlatformOrganizationCode,
		ThirdPlatformType:             req.ThirdPlatformType,
		ThirdFileID:                   req.ThirdFileID,
		ThirdKnowledgeID:              req.ThirdKnowledgeID,
	}

	if err := h.thirdFileRevectorize.ReVectorizedByThirdFileID(ctx, input); err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to re-vectorize document by third file id", "error", err)
		return nil, mapBusinessError(err)
	}

	return &map[string]bool{"success": true}, nil
}

// NotifyProjectFileChangeRPC 按项目文件变更触发重同步。
func (h *DocumentRPCService) NotifyProjectFileChangeRPC(
	ctx context.Context,
	req *dto.NotifyProjectFileChangeRequest,
) (*map[string]bool, error) {
	if err := h.projectFileChangeService.NotifyProjectFileChange(ctx, &docdto.NotifyProjectFileChangeInput{
		ProjectFileID:    req.ProjectFileID,
		OrganizationCode: req.OrganizationCode,
		ProjectID:        req.ProjectID,
		Status:           req.Status,
	}); err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to notify project file change", "project_file_id", req.ProjectFileID, "error", err)
		return nil, mapBusinessError(err)
	}
	return &map[string]bool{"success": true}, nil
}
