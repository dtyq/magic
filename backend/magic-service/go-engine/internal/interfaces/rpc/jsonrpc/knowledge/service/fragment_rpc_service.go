package service

import (
	"context"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	fragmentapp "magic/internal/application/knowledge/fragment/service"
	"magic/internal/infrastructure/logging"
	"magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
	"magic/internal/pkg/ctxmeta"
)

type fragmentCoreApplicationService interface {
	Create(ctx context.Context, input *fragdto.CreateFragmentInput) (*fragdto.FragmentDTO, error)
	Show(ctx context.Context, id int64, organizationCode, knowledgeCode, documentCode string) (*fragdto.FragmentDTO, error)
	ListV2(ctx context.Context, input *fragdto.ListFragmentInput) (*fragdto.FragmentPageResultDTO, error)
	Destroy(ctx context.Context, id int64, knowledgeCode, documentCode, organizationCode string) error
	Sync(ctx context.Context, input *fragdto.SyncFragmentInput) (*fragdto.FragmentDTO, error)
	Similarity(ctx context.Context, input *fragdto.SimilarityInput) ([]*fragdto.SimilarityResultDTO, error)
	SimilarityByAgent(ctx context.Context, input *fragdto.AgentSimilarityInput) (*fragdto.AgentSimilarityResultDTO, error)
	PreviewV2(ctx context.Context, input *fragdto.PreviewFragmentInput) (*fragdto.FragmentPageResultDTO, error)
}

type fragmentRuntimeApplicationService interface {
	RuntimeCreate(ctx context.Context, input *fragdto.RuntimeCreateFragmentInput) (*fragdto.FragmentDTO, error)
	RuntimeDestroyByBusinessID(ctx context.Context, input *fragdto.RuntimeDestroyByBusinessIDInput) error
	RuntimeDestroyByMetadataFilter(ctx context.Context, input *fragdto.RuntimeDestroyByMetadataFilterInput) error
	RuntimeSimilarity(ctx context.Context, input *fragdto.RuntimeSimilarityInput) ([]*fragdto.SimilarityResultDTO, error)
}

type fragmentApplicationService interface {
	fragmentCoreApplicationService
	fragmentRuntimeApplicationService
}

// FragmentRPCService 片段 RPC 处理器
type FragmentRPCService struct {
	appService fragmentApplicationService
	logger     *logging.SugaredLogger
}

// NewFragmentRPCService 创建片段处理器
func NewFragmentRPCService(
	appService *fragmentapp.FragmentAppService,
	logger *logging.SugaredLogger,
) *FragmentRPCService {
	return newFragmentRPCService(appService, logger)
}

// NewFragmentRPCServiceWithDependencies 创建支持接口替身的片段 RPC 处理器。
func NewFragmentRPCServiceWithDependencies(
	appService fragmentApplicationService,
	logger *logging.SugaredLogger,
) *FragmentRPCService {
	return newFragmentRPCService(appService, logger)
}

func newFragmentRPCService(
	appService fragmentApplicationService,
	logger *logging.SugaredLogger,
) *FragmentRPCService {
	return &FragmentRPCService{
		appService: appService,
		logger:     logger,
	}
}

// ==================== 新的强类型 RPC 方法 ====================

// CreateRPC 创建片段（RPC 版本）
func (h *FragmentRPCService) CreateRPC(ctx context.Context, req *dto.CreateFragmentRequest) (*dto.FragmentResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	input := &fragdto.CreateFragmentInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		KnowledgeCode:    req.KnowledgeCode,
		DocumentCode:     req.DocumentCode,
		BusinessID:       req.BusinessID,
		Content:          req.Content,
		Metadata:         req.Metadata,
	}

	result, err := h.appService.Create(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to create fragment", "error", err)
		return nil, mapBusinessError(err)
	}

	return dto.NewFragmentResponse(result), nil
}

// RuntimeCreateRPC flow/teamshare runtime 创建片段（同步写向量）。
func (h *FragmentRPCService) RuntimeCreateRPC(ctx context.Context, req *dto.RuntimeCreateFragmentRequest) (*dto.FragmentResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	result, err := h.appService.RuntimeCreate(ctx, &fragdto.RuntimeCreateFragmentInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		KnowledgeCode:    req.KnowledgeCode,
		DocumentCode:     req.DocumentCode,
		Content:          req.Content,
		Metadata:         req.Metadata,
		BusinessID:       req.BusinessID,
		CompatID:         req.ID,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: req.BusinessParams.ResolveOrganizationCode(),
			UserID:           req.BusinessParams.UserID,
			BusinessID:       req.BusinessParams.BusinessID,
		},
	})
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to runtime create fragment", "error", err)
		return nil, mapBusinessError(err)
	}
	return dto.NewFragmentResponse(result), nil
}

// ShowRPC 查询片段详情（RPC 版本）
func (h *FragmentRPCService) ShowRPC(ctx context.Context, req *dto.ShowFragmentRequest) (*dto.FragmentResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	result, err := h.appService.Show(
		ctx,
		req.ID,
		req.DataIsolation.ResolveOrganizationCode(),
		req.KnowledgeCode,
		req.DocumentCode,
	)
	if err != nil {
		return nil, mapBusinessError(err)
	}

	return dto.NewFragmentResponse(result), nil
}

// ListRPC 查询片段列表（RPC 版本）
func (h *FragmentRPCService) ListRPC(ctx context.Context, req *dto.ListFragmentRequest) (*dto.FragmentPageResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	input := &fragdto.ListFragmentInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		KnowledgeCode:    req.KnowledgeCode,
		DocumentCode:     req.DocumentCode,
		Content:          req.Content,
		SyncStatus:       req.SyncStatus,
		Offset:           req.Page.Offset,
		Limit:            req.Page.Limit,
	}

	result, err := h.appService.ListV2(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to list fragments", "error", err)
		return nil, mapBusinessError(err)
	}
	result.Page = resolveListPage(req)
	return dto.NewFragmentPageResponse(result), nil
}

// ListHTTPRPC 查询片段列表并返回最终 low_code HTTP body。
func (h *FragmentRPCService) ListHTTPRPC(ctx context.Context, req *dto.ListFragmentRequest) (*dto.HTTPPassthroughResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	input := &fragdto.ListFragmentInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		KnowledgeCode:    req.KnowledgeCode,
		DocumentCode:     req.DocumentCode,
		Content:          req.Content,
		SyncStatus:       req.SyncStatus,
		Offset:           req.Page.Offset,
		Limit:            req.Page.Limit,
	}

	result, err := h.appService.ListV2(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to list fragments for passthrough", "error", err)
		return newErrorPassthroughResponse(err, req.AcceptEncoding)
	}
	result.Page = resolveListPage(req)

	return newSuccessPassthroughResponse(dto.NewFragmentPageResponse(result), req.AcceptEncoding)
}

// DestroyRPC 删除片段（RPC 版本）
func (h *FragmentRPCService) DestroyRPC(ctx context.Context, req *dto.DestroyFragmentRequest) (*map[string]bool, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	if err := h.appService.Destroy(
		ctx,
		req.ID,
		req.KnowledgeCode,
		req.DocumentCode,
		req.DataIsolation.ResolveOrganizationCode(),
	); err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to destroy fragment", "error", err)
		return nil, mapBusinessError(err)
	}

	return &map[string]bool{"success": true}, nil
}

// RuntimeDestroyByBusinessIDRPC flow/teamshare runtime 按 business_id 删除片段。
func (h *FragmentRPCService) RuntimeDestroyByBusinessIDRPC(
	ctx context.Context,
	req *dto.RuntimeDestroyByBusinessIDRequest,
) (*map[string]bool, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	if err := h.appService.RuntimeDestroyByBusinessID(ctx, &fragdto.RuntimeDestroyByBusinessIDInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		KnowledgeCode:    req.KnowledgeCode,
		BusinessID:       req.BusinessID,
	}); err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to runtime destroy fragment by business id", "error", err)
		return nil, mapBusinessError(err)
	}
	return &map[string]bool{"success": true}, nil
}

// RuntimeDestroyByMetadataFilterRPC flow/teamshare runtime 按 metadata filter 删除片段。
func (h *FragmentRPCService) RuntimeDestroyByMetadataFilterRPC(
	ctx context.Context,
	req *dto.RuntimeDestroyByMetadataFilterRequest,
) (*map[string]bool, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	if err := h.appService.RuntimeDestroyByMetadataFilter(ctx, &fragdto.RuntimeDestroyByMetadataFilterInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		KnowledgeCode:    req.KnowledgeCode,
		MetadataFilter:   map[string]any(req.MetadataFilter),
	}); err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to runtime destroy fragment by metadata filter", "error", err)
		return nil, mapBusinessError(err)
	}
	return &map[string]bool{"success": true}, nil
}

// SyncRPC 同步片段到向量库（RPC 版本）
func (h *FragmentRPCService) SyncRPC(_ context.Context, _ *dto.SyncFragmentRequest) (*dto.FragmentResponse, error) {
	return nil, mapBusinessError(fragmentapp.ErrFragmentWriteDisabled)
}

// SimilarityRPC 相似度搜索（RPC 版本）
func (h *FragmentRPCService) SimilarityRPC(ctx context.Context, req *dto.SimilarityRequest) (*dto.SimilarityPageResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	input := &fragdto.SimilarityInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		KnowledgeCode:    req.KnowledgeCode,
		Query:            req.Query,
		// Keep fragment similarity on the app-service default instead of inheriting
		// the legacy caller-supplied top_k from upstream knowledge retrieve config.
		TopK:           0,
		ScoreThreshold: req.ScoreThreshold,
		Filters:        toSimilarityFilterInput(req.Filters),
		Debug:          req.Debug,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: req.BusinessParams.ResolveOrganizationCode(),
			UserID:           req.BusinessParams.UserID,
			BusinessID:       req.BusinessParams.BusinessID,
		},
	}

	results, err := h.appService.Similarity(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to search similarity", "error", err)
		return nil, mapBusinessError(err)
	}
	return dto.NewSimilarityPageResponse(results), nil
}

// SimilarityHTTPRPC 相似度搜索并返回最终 low_code HTTP body。
func (h *FragmentRPCService) SimilarityHTTPRPC(ctx context.Context, req *dto.SimilarityRequest) (*dto.HTTPPassthroughResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	input := &fragdto.SimilarityInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		KnowledgeCode:    req.KnowledgeCode,
		Query:            req.Query,
		TopK:             0,
		ScoreThreshold:   req.ScoreThreshold,
		Filters:          toSimilarityFilterInput(req.Filters),
		Debug:            req.Debug,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: req.BusinessParams.ResolveOrganizationCode(),
			UserID:           req.BusinessParams.UserID,
			BusinessID:       req.BusinessParams.BusinessID,
		},
	}

	results, err := h.appService.Similarity(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to search similarity for passthrough", "error", err)
		return newErrorPassthroughResponse(err, req.AcceptEncoding)
	}

	return newSuccessPassthroughResponse(dto.NewSimilarityPageResponse(results), req.AcceptEncoding)
}

// RuntimeSimilarityRPC flow/teamshare runtime 多知识库相似度搜索。
func (h *FragmentRPCService) RuntimeSimilarityRPC(
	ctx context.Context,
	req *dto.RuntimeSimilarityRequest,
) (*dto.SimilarityPageResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	results, err := h.appService.RuntimeSimilarity(ctx, &fragdto.RuntimeSimilarityInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		KnowledgeCodes:   append([]string{}, req.KnowledgeCodes...),
		Query:            req.Query,
		Question:         req.Question,
		TopK:             req.TopK,
		ScoreThreshold:   req.ScoreThreshold,
		MetadataFilter:   map[string]any(req.MetadataFilter),
		Debug:            req.Debug,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: req.BusinessParams.ResolveOrganizationCode(),
			UserID:           req.BusinessParams.UserID,
			BusinessID:       req.BusinessParams.BusinessID,
		},
	})
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to runtime search similarity", "error", err)
		return nil, mapBusinessError(err)
	}
	return dto.NewSimilarityPageResponse(results), nil
}

// SimilarityByAgentRPC 数字员工维度相似度搜索（RPC 版本）。
func (h *FragmentRPCService) SimilarityByAgentRPC(
	ctx context.Context,
	req *dto.AgentSimilarityRequest,
) (*dto.AgentSimilarityResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	result, err := h.appService.SimilarityByAgent(ctx, &fragdto.AgentSimilarityInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		AgentCode:        req.AgentCode,
		Query:            req.Query,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
			UserID:           req.DataIsolation.UserID,
		},
	})
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to search employee knowledge similarity", "error", err)
		return nil, mapBusinessError(err)
	}
	return dto.NewAgentSimilarityResponse(result), nil
}

func toSimilarityFilterInput(filters *dto.SimilarityFilters) *fragdto.SimilarityFilterInput {
	if filters == nil {
		return nil
	}
	result := &fragdto.SimilarityFilterInput{
		DocumentCodes: append([]string{}, filters.DocumentCodes...),
		DocumentTypes: append([]int{}, filters.DocumentTypes...),
		SectionPaths:  append([]string{}, filters.SectionPaths...),
		SectionLevels: append([]int{}, filters.SectionLevels...),
		Tags:          append([]string{}, filters.Tags...),
	}
	if filters.TimeRange != nil {
		result.TimeRange = &fragdto.SimilarityTimeRangeInput{
			StartUnix: filters.TimeRange.StartUnix,
			EndUnix:   filters.TimeRange.EndUnix,
		}
	}
	return result
}

// PreviewRPC 片段预览（RPC 版本）
func (h *FragmentRPCService) PreviewRPC(ctx context.Context, req *dto.PreviewFragmentRequest) (*dto.FragmentPageResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	input := &fragdto.PreviewFragmentInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		DocumentCode:     req.DocumentCode,
		DocumentFile:     req.DocumentFile,
		StrategyConfig:   req.StrategyConfig,
		FragmentConfig:   req.FragmentConfig,
	}

	result, err := h.appService.PreviewV2(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to preview fragments", "error", err)
		return nil, mapBusinessError(err)
	}
	return dto.NewFragmentPageResponse(result), nil
}

// PreviewHTTPRPC 预览切片并返回最终 low_code HTTP body。
func (h *FragmentRPCService) PreviewHTTPRPC(ctx context.Context, req *dto.PreviewFragmentRequest) (*dto.HTTPPassthroughResponse, error) {
	ctx = withAccessActorFromDataIsolation(ctx, req.DataIsolation)
	input := &fragdto.PreviewFragmentInput{
		DocumentCode:     req.DocumentCode,
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		DocumentFile:     req.DocumentFile,
		StrategyConfig:   req.StrategyConfig,
		FragmentConfig:   req.FragmentConfig,
	}

	result, err := h.appService.PreviewV2(ctx, input)
	if err != nil {
		h.logger.KnowledgeErrorContext(ctx, "Failed to preview fragments for passthrough", "error", err)
		return newErrorPassthroughResponse(err, req.AcceptEncoding)
	}

	return newSuccessPassthroughResponse(dto.NewFragmentPageResponse(result), req.AcceptEncoding)
}

func resolveListPage(req *dto.ListFragmentRequest) int {
	if req == nil || req.Page.Limit <= 0 {
		return 1
	}
	return max(1, req.Page.Offset/req.Page.Limit+1)
}
