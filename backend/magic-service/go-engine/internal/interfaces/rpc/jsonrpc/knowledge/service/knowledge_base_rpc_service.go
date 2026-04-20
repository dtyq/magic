// Package service 提供知识库、文档、片段和嵌入计算的 JSON-RPC 处理器实现。
package service

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"strings"
	"time"

	pagehelper "magic/internal/application/knowledge/helper/page"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	knowledgebaseapp "magic/internal/application/knowledge/knowledgebase/service"
	apprebuild "magic/internal/application/knowledge/rebuild"
	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	"magic/internal/infrastructure/logging"
	"magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
	"magic/internal/pkg/ctxmeta"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

var (
	errRebuildScopeOrganizationCodeRequired    = errors.New("knowledge_organization_code is required when scope=organization")
	errRebuildScopeKnowledgeBaseFieldsRequired = errors.New("knowledge_organization_code and knowledge_base_code are required when scope=knowledge_base")
	errRebuildScopeDocumentFieldsRequired      = errors.New("knowledge_organization_code, knowledge_base_code and document_code are required when scope=document")
	errRebuildScopeInvalid                     = errors.New("invalid rebuild scope")
	errRebuildModeInvalid                      = errors.New("invalid rebuild mode")
	errUnexpectedKnowledgeBaseListResultType   = errors.New("unexpected knowledge base list result type")
	errTeamshareKnowledgeCodeRequired          = errors.New("teamshare start vector missing knowledge code")
)

type knowledgeBaseSaveProcessQuery interface {
	SaveProcess(ctx context.Context, input *kbdto.SaveProcessKnowledgeBaseInput) (*kbdto.KnowledgeBaseDTO, error)
}

type knowledgeBaseShowQuery interface {
	Show(ctx context.Context, code, orgCode, userID string) (*kbdto.KnowledgeBaseDTO, error)
}

type knowledgeBaseListQuery interface {
	List(ctx context.Context, input *kbdto.ListKnowledgeBaseInput) (*pagehelper.Result, error)
}

type knowledgeBaseCreateCommand interface {
	Create(ctx context.Context, input *kbdto.CreateKnowledgeBaseInput) (*kbdto.KnowledgeBaseDTO, error)
}

type knowledgeBaseUpdateCommand interface {
	Update(ctx context.Context, input *kbdto.UpdateKnowledgeBaseInput) (*kbdto.KnowledgeBaseDTO, error)
}

type knowledgeBaseSourceBindingNodesCommand interface {
	ListSourceBindingNodes(ctx context.Context, input *kbdto.ListSourceBindingNodesInput) (*kbdto.ListSourceBindingNodesResult, error)
}

type knowledgeBaseDestroyCommand interface {
	Destroy(ctx context.Context, code, orgCode, userID string) error
}

type knowledgeBaseRepairCommand interface {
	RepairSourceBindings(ctx context.Context, input *kbdto.RepairSourceBindingsInput) (*kbdto.RepairSourceBindingsResult, error)
}

type knowledgeBaseTeamshareStartVectorCommand interface {
	TeamshareStartVector(ctx context.Context, input *kbdto.TeamshareStartVectorInput) (*kbdto.TeamshareStartVectorResult, error)
}

type knowledgeBaseTeamshareManageableQuery interface {
	TeamshareManageable(ctx context.Context, input *kbdto.TeamshareManageableInput) ([]*kbdto.TeamshareKnowledgeProgressDTO, error)
}

type knowledgeBaseTeamshareManageableProgressQuery interface {
	TeamshareManageableProgress(ctx context.Context, input *kbdto.TeamshareManageableProgressInput) ([]*kbdto.TeamshareKnowledgeProgressDTO, error)
}

type knowledgeBaseRebuildTrigger interface {
	Trigger(ctx context.Context, opts rebuilddto.RunOptions) (*apprebuild.TriggerResult, error)
}

type knowledgeBaseRebuildCleaner interface {
	Cleanup(ctx context.Context, input *rebuilddto.CleanupInput) (*rebuilddto.CleanupResult, error)
}

type knowledgeBaseRebuildPreparer interface {
	PrepareRebuild(ctx context.Context, operatorOrganizationCode string, scope knowledgebaseapp.RebuildScope) error
}

type knowledgeBaseDocumentCounter interface {
	CountByKnowledgeBaseCodes(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]int64, error)
}

type knowledgeBaseCommandAppProvider interface {
	CreateCommandApp() *knowledgebaseapp.KnowledgeBaseCreateApp
	UpdateCommandApp() *knowledgebaseapp.KnowledgeBaseUpdateApp
	DestroyCommandApp() *knowledgebaseapp.KnowledgeBaseDestroyApp
	SourceBindingNodesCommandApp() *knowledgebaseapp.SourceBindingNodesApp
	SourceBindingRepairCommandApp() *knowledgebaseapp.SourceBindingRepairApp
	RebuildPrepareCommandApp() *knowledgebaseapp.RebuildPrepareApp
}

type knowledgeBaseQueryAppProvider interface {
	SaveProcessQueryApp() *knowledgebaseapp.KnowledgeBaseSaveProcessApp
	ShowQueryApp() *knowledgebaseapp.KnowledgeBaseShowApp
	ListQueryApp() *knowledgebaseapp.KnowledgeBaseListApp
}

// KnowledgeBaseRPCService 知识库 RPC 处理器
type KnowledgeBaseRPCService struct {
	saveProcessQuery knowledgeBaseSaveProcessQuery
	showQuery        knowledgeBaseShowQuery
	listQuery        knowledgeBaseListQuery
	createCommand    knowledgeBaseCreateCommand
	updateCommand    knowledgeBaseUpdateCommand
	nodesCommand     knowledgeBaseSourceBindingNodesCommand
	destroyCommand   knowledgeBaseDestroyCommand
	repairCommand    knowledgeBaseRepairCommand
	teamshareStart   knowledgeBaseTeamshareStartVectorCommand
	teamshareList    knowledgeBaseTeamshareManageableQuery
	teamshareShow    knowledgeBaseTeamshareManageableProgressQuery
	rebuildPreparer  knowledgeBaseRebuildPreparer
	documentCounter  knowledgeBaseDocumentCounter
	rebuildTrigger   knowledgeBaseRebuildTrigger
	rebuildCleaner   knowledgeBaseRebuildCleaner
	logger           *logging.SugaredLogger
}

// NewKnowledgeBaseRPCService 创建知识库处理器
func NewKnowledgeBaseRPCService(
	appService any,
	rebuildTrigger knowledgeBaseRebuildTrigger,
	rebuildCleaner knowledgeBaseRebuildCleaner,
	logger *logging.SugaredLogger,
) *KnowledgeBaseRPCService {
	svc := &KnowledgeBaseRPCService{
		rebuildTrigger: rebuildTrigger,
		rebuildCleaner: rebuildCleaner,
		logger:         logger,
	}
	if saveProcessQuery, ok := appService.(knowledgeBaseSaveProcessQuery); ok {
		svc.saveProcessQuery = saveProcessQuery
	}
	if showQuery, ok := appService.(knowledgeBaseShowQuery); ok {
		svc.showQuery = showQuery
	}
	if listQuery, ok := appService.(knowledgeBaseListQuery); ok {
		svc.listQuery = listQuery
	}
	if createCommand, ok := appService.(knowledgeBaseCreateCommand); ok {
		svc.createCommand = createCommand
	}
	if updateCommand, ok := appService.(knowledgeBaseUpdateCommand); ok {
		svc.updateCommand = updateCommand
	}
	if nodesCommand, ok := appService.(knowledgeBaseSourceBindingNodesCommand); ok {
		svc.nodesCommand = nodesCommand
	}
	if destroyCommand, ok := appService.(knowledgeBaseDestroyCommand); ok {
		svc.destroyCommand = destroyCommand
	}
	if repairCommand, ok := appService.(knowledgeBaseRepairCommand); ok {
		svc.repairCommand = repairCommand
	}
	if teamshareStart, ok := appService.(knowledgeBaseTeamshareStartVectorCommand); ok {
		svc.teamshareStart = teamshareStart
	}
	if teamshareList, ok := appService.(knowledgeBaseTeamshareManageableQuery); ok {
		svc.teamshareList = teamshareList
	}
	if teamshareShow, ok := appService.(knowledgeBaseTeamshareManageableProgressQuery); ok {
		svc.teamshareShow = teamshareShow
	}
	if provider, ok := appService.(knowledgeBaseCommandAppProvider); ok {
		svc.createCommand = provider.CreateCommandApp()
		svc.updateCommand = provider.UpdateCommandApp()
		svc.nodesCommand = provider.SourceBindingNodesCommandApp()
		svc.destroyCommand = provider.DestroyCommandApp()
		svc.repairCommand = provider.SourceBindingRepairCommandApp()
		svc.rebuildPreparer = provider.RebuildPrepareCommandApp()
	}
	if svc.rebuildPreparer == nil {
		if preparer, ok := appService.(knowledgeBaseRebuildPreparer); ok {
			svc.rebuildPreparer = preparer
		}
	}
	if provider, ok := appService.(knowledgeBaseQueryAppProvider); ok {
		svc.saveProcessQuery = provider.SaveProcessQueryApp()
		svc.showQuery = provider.ShowQueryApp()
		svc.listQuery = provider.ListQueryApp()
	}
	return svc
}

// NewKnowledgeBaseRPCServiceFromConcrete 为 Wire 提供具体类型构造入口。
func NewKnowledgeBaseRPCServiceFromConcrete(
	appService *knowledgebaseapp.KnowledgeBaseAppService,
	rebuildTrigger *apprebuild.TriggerService,
	rebuildCleaner *apprebuild.CleanupService,
	logger *logging.SugaredLogger,
) *KnowledgeBaseRPCService {
	return NewKnowledgeBaseRPCService(appService, rebuildTrigger, rebuildCleaner, logger)
}

// SetDocumentCounter 注入知识库文档计数依赖。
func (h *KnowledgeBaseRPCService) SetDocumentCounter(counter knowledgeBaseDocumentCounter) {
	if h == nil {
		return
	}
	h.documentCounter = counter
}

// ==================== 新的强类型 RPC 方法 ====================

// CreateRPC 创建知识库（RPC 版本）
func (h *KnowledgeBaseRPCService) CreateRPC(ctx context.Context, req *dto.CreateKnowledgeBaseRequest) (*dto.KnowledgeBaseResponse, error) {
	input := &kbdto.CreateKnowledgeBaseInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		Code:             req.Code,
		Name:             req.Name,
		Description:      req.Description,
		Type:             req.Type,
		Model:            req.Model,
		VectorDB:         req.VectorDB,
		BusinessID:       req.BusinessID,
		Icon:             req.Icon,
		SourceType:       req.SourceType,
		AgentCodes:       append([]string(nil), req.AgentCodes...),
		EmbeddingConfig:  req.EmbeddingConfig,
		SourceBindings:   toSourceBindingInputs(req.SourceBindings),
	}

	if req.RetrieveConfig != nil {
		input.RetrieveConfig = req.RetrieveConfig
	}

	if req.FragmentConfig != nil {
		input.FragmentConfig = req.FragmentConfig
	}

	result, err := h.createCommand.Create(ctx, input)
	if err != nil {
		h.logger.ErrorContext(ctx, "Failed to create knowledge base", "error", err)
		return nil, mapBusinessError(err)
	}

	return dto.NewKnowledgeBaseResponse(result, h.lookupDocumentCount(ctx, input.OrganizationCode, result.Code)), nil
}

// UpdateRPC 更新知识库（RPC 版本）
func (h *KnowledgeBaseRPCService) UpdateRPC(ctx context.Context, req *dto.UpdateKnowledgeBaseRequest) (*dto.KnowledgeBaseResponse, error) {
	input := &kbdto.UpdateKnowledgeBaseInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		Code:             req.Code,
		Name:             req.Name,
		Description:      req.Description,
		Enabled:          req.Enabled,
		Icon:             req.Icon,
		SourceType:       req.SourceType,
		EmbeddingConfig:  req.EmbeddingConfig,
	}
	if req.SourceBindings != nil {
		sourceBindings := toSourceBindingInputs(*req.SourceBindings)
		input.SourceBindings = &sourceBindings
	}

	if req.RetrieveConfig != nil {
		input.RetrieveConfig = req.RetrieveConfig
	}

	if req.FragmentConfig != nil {
		input.FragmentConfig = req.FragmentConfig
	}

	result, err := h.updateCommand.Update(ctx, input)
	if err != nil {
		h.logger.ErrorContext(ctx, "Failed to update knowledge base", "error", err)
		return nil, mapBusinessError(err)
	}

	return dto.NewKnowledgeBaseResponse(result, h.lookupDocumentCount(ctx, input.OrganizationCode, result.Code)), nil
}

// ShowRPC 查询知识库详情（RPC 版本）
func (h *KnowledgeBaseRPCService) ShowRPC(ctx context.Context, req *dto.ShowKnowledgeBaseRequest) (*dto.KnowledgeBaseResponse, error) {
	result, err := h.showQuery.Show(
		ctx,
		req.Code,
		req.DataIsolation.ResolveOrganizationCode(),
		req.DataIsolation.UserID,
	)
	if err != nil {
		return nil, mapBusinessError(err)
	}

	return dto.NewKnowledgeBaseResponse(result, h.lookupDocumentCount(ctx, req.DataIsolation.ResolveOrganizationCode(), result.Code)), nil
}

// SaveProcessRPC 更新知识库向量化进度（RPC 版本）。
func (h *KnowledgeBaseRPCService) SaveProcessRPC(ctx context.Context, req *dto.SaveProcessKnowledgeBaseRequest) (*dto.KnowledgeBaseResponse, error) {
	input := &kbdto.SaveProcessKnowledgeBaseInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		Code:             req.Code,
		ExpectedNum:      req.ExpectedNum,
		CompletedNum:     req.CompletedNum,
	}

	result, err := h.saveProcessQuery.SaveProcess(ctx, input)
	if err != nil {
		h.logger.ErrorContext(ctx, "Failed to update knowledge base progress", "error", err)
		return nil, mapBusinessError(err)
	}

	return dto.NewKnowledgeBaseResponse(result, h.lookupDocumentCount(ctx, input.OrganizationCode, result.Code)), nil
}

// ListRPC 查询知识库列表（RPC 版本）
func (h *KnowledgeBaseRPCService) ListRPC(ctx context.Context, req *dto.ListKnowledgeBaseRequest) (*dto.KnowledgeBasePageResponse, error) {
	// PHP 以 type=0 表示"不过滤类型"，需要转换为 nil 以避免 AND type=0 过滤条件
	var typeFilter *int
	if req.Type != nil && *req.Type != 0 {
		typeFilter = req.Type
	}
	input := &kbdto.ListKnowledgeBaseInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		AgentCodes:       append([]string(nil), req.AgentCodes...),
		Name:             req.Name,
		Type:             typeFilter,
		Enabled:          req.Enabled,
		Codes:            req.Codes,
		BusinessIDs:      req.BusinessIDs,
		Offset:           req.Offset,
		Limit:            req.Limit,
	}

	result, err := h.listQuery.List(ctx, input)
	if err != nil {
		h.logger.ErrorContext(ctx, "Failed to list knowledge bases", "error", err)
		return nil, mapBusinessError(err)
	}

	knowledgeBases, ok := result.List.([]*kbdto.KnowledgeBaseDTO)
	if result.List == nil {
		knowledgeBases = []*kbdto.KnowledgeBaseDTO{}
		ok = true
	}
	if !ok {
		return nil, mapBusinessError(fmt.Errorf("%w: %T", errUnexpectedKnowledgeBaseListResultType, result.List))
	}

	documentCounts := h.lookupDocumentCounts(ctx, input.OrganizationCode, knowledgeBases)
	return dto.NewKnowledgeBasePageResponse(
		resolveOffsetPage(req.Offset, req.Limit),
		result.Total,
		knowledgeBases,
		documentCounts,
	), nil
}

// TeamshareStartVectorRPC 触发 Teamshare 知识库本地接管与重建。
func (h *KnowledgeBaseRPCService) TeamshareStartVectorRPC(
	ctx context.Context,
	req *dto.TeamshareStartVectorRequest,
) (*dto.TeamshareStartVectorResponse, error) {
	if h.teamshareStart == nil {
		return nil, jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInternalError, "teamshare startVector handler not initialized", nil)
	}
	if h.rebuildTrigger == nil {
		return nil, jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInternalError, "knowledge rebuild trigger not initialized", nil)
	}
	result, err := h.teamshareStart.TeamshareStartVector(ctx, &kbdto.TeamshareStartVectorInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		KnowledgeID:      req.KnowledgeID,
	})
	if err != nil {
		h.logger.ErrorContext(ctx, "Failed to start teamshare vector", "error", err)
		return nil, mapBusinessError(err)
	}
	runID, err := h.triggerTeamshareKnowledgeRebuild(
		ctx,
		req.DataIsolation.ResolveOrganizationCode(),
		req.DataIsolation.UserID,
		strings.TrimSpace(result.KnowledgeCode),
	)
	if err != nil {
		h.logger.ErrorContext(ctx, "Failed to trigger teamshare rebuild", "error", err)
		return nil, mapBusinessError(err)
	}

	return &dto.TeamshareStartVectorResponse{ID: runID}, nil
}

func (h *KnowledgeBaseRPCService) triggerTeamshareKnowledgeRebuild(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeBaseCode string,
) (string, error) {
	if strings.TrimSpace(knowledgeBaseCode) == "" {
		return "", errTeamshareKnowledgeCodeRequired
	}

	opts := apprebuild.NormalizeRunOptions(rebuilddto.RunOptions{
		Scope: rebuilddto.Scope{
			Mode:              rebuilddto.ScopeModeKnowledgeBase,
			OrganizationCode:  strings.TrimSpace(organizationCode),
			KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
			UserID:            strings.TrimSpace(userID),
		},
		Mode: rebuilddto.ModeAuto,
	})
	ctx = ctxmeta.WithBusinessParams(ctx, &ctxmeta.BusinessParams{
		OrganizationCode: strings.TrimSpace(organizationCode),
		UserID:           strings.TrimSpace(userID),
		BusinessID:       strings.TrimSpace(knowledgeBaseCode),
	})
	result, err := h.rebuildTrigger.Trigger(ctx, opts)
	if err != nil {
		return "", fmt.Errorf("trigger teamshare rebuild: %w", err)
	}
	if result == nil {
		return strings.TrimSpace(opts.ResumeRunID), nil
	}
	return strings.TrimSpace(result.RunID), nil
}

// TeamshareManageableRPC 返回当前用户可管理的 Teamshare 知识库。
func (h *KnowledgeBaseRPCService) TeamshareManageableRPC(
	ctx context.Context,
	req *dto.TeamshareManageableRequest,
) (*dto.TeamshareKnowledgeListResponse, error) {
	if h.teamshareList == nil {
		return nil, jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInternalError, "teamshare manageable handler not initialized", nil)
	}
	items, err := h.teamshareList.TeamshareManageable(ctx, &kbdto.TeamshareManageableInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
	})
	if err != nil {
		h.logger.ErrorContext(ctx, "Failed to list teamshare manageable knowledge bases", "error", err)
		return nil, mapBusinessError(err)
	}

	return dto.NewTeamshareKnowledgeListResponse(items), nil
}

// TeamshareManageableProgressRPC 返回 Teamshare knowledge_code 对应进度。
func (h *KnowledgeBaseRPCService) TeamshareManageableProgressRPC(
	ctx context.Context,
	req *dto.TeamshareManageableProgressRequest,
) (*dto.TeamshareKnowledgeListResponse, error) {
	if h.teamshareShow == nil {
		return nil, jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInternalError, "teamshare manageableProgress handler not initialized", nil)
	}
	items, err := h.teamshareShow.TeamshareManageableProgress(ctx, &kbdto.TeamshareManageableProgressInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		KnowledgeCodes:   append([]string(nil), req.KnowledgeCodes...),
	})
	if err != nil {
		h.logger.ErrorContext(ctx, "Failed to query teamshare manageable progress", "error", err)
		return nil, mapBusinessError(err)
	}

	return dto.NewTeamshareKnowledgeListResponse(items), nil
}

// ListSourceBindingNodesRPC 查询来源绑定选择器节点。
func (h *KnowledgeBaseRPCService) ListSourceBindingNodesRPC(
	ctx context.Context,
	req *dto.ListSourceBindingNodesRequest,
) (*dto.ListSourceBindingNodesResponse, error) {
	result, err := h.nodesCommand.ListSourceBindingNodes(ctx, &kbdto.ListSourceBindingNodesInput{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           req.DataIsolation.UserID,
		SourceType:       req.SourceType,
		Provider:         req.Provider,
		ParentType:       req.ParentType,
		ParentRef:        req.ParentRef,
		Offset:           req.Offset,
		Limit:            req.Limit,
	})
	if err != nil {
		return nil, mapBusinessError(err)
	}

	response := &dto.ListSourceBindingNodesResponse{
		Page:  resolveOffsetPage(req.Offset, req.Limit),
		Total: result.Total,
		List:  make([]dto.SourceBindingNode, 0, len(result.List)),
	}
	for _, node := range result.List {
		response.List = append(response.List, dto.SourceBindingNode{
			NodeType:    node.NodeType,
			NodeRef:     node.NodeRef,
			Name:        node.Name,
			Description: node.Description,
			HasChildren: node.HasChildren,
			Selectable:  node.Selectable,
			Meta:        node.Meta,
		})
	}
	return response, nil
}

// DestroyRPC 删除知识库（RPC 版本）
func (h *KnowledgeBaseRPCService) DestroyRPC(ctx context.Context, req *dto.DestroyKnowledgeBaseRequest) (*map[string]bool, error) {
	if err := h.destroyCommand.Destroy(
		ctx,
		req.Code,
		req.DataIsolation.ResolveOrganizationCode(),
		req.DataIsolation.UserID,
	); err != nil {
		h.logger.ErrorContext(ctx, "Failed to destroy knowledge base", "error", err)
		return nil, mapBusinessError(err)
	}

	return &map[string]bool{"success": true}, nil
}

// RebuildRPC 手动触发知识库重建（异步）。
func (h *KnowledgeBaseRPCService) RebuildRPC(
	ctx context.Context,
	req *dto.RebuildKnowledgeBaseRequest,
) (*dto.RebuildKnowledgeBaseResponse, error) {
	if h.rebuildTrigger == nil {
		return nil, jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInternalError, "knowledge rebuild trigger not initialized", nil)
	}

	scope, err := normalizeRebuildScope(
		req.Scope,
		req.KnowledgeOrganizationCode,
		req.KnowledgeBaseCode,
		req.DocumentCode,
		req.DataIsolation.UserID,
	)
	if err != nil {
		return nil, jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInvalidParams, err.Error(), nil)
	}

	mode, err := normalizeRebuildMode(req.Mode)
	if err != nil {
		return nil, jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInvalidParams, err.Error(), nil)
	}

	opts := rebuilddto.RunOptions{
		Scope:           scope,
		Mode:            mode,
		TargetModel:     strings.TrimSpace(req.TargetModel),
		TargetDimension: req.TargetDimension,
		Concurrency:     req.Concurrency,
		BatchSize:       req.BatchSize,
		Retry:           req.Retry,
	}
	opts.ResumeRunID = generateAsyncRebuildRunID(opts.ResumeRunID)
	ctx = ctxmeta.WithBusinessParams(ctx, buildRebuildBusinessParams(req, scope))
	normalized := apprebuild.NormalizeRunOptions(opts)
	h.logRebuildRPCAccepted(ctx, scope, normalized)
	h.runKnowledgeRebuildInBackground(ctx, req, scope, opts, normalized)

	return &dto.RebuildKnowledgeBaseResponse{
		Status:        asyncTaskStatusAccepted,
		RunID:         normalized.ResumeRunID,
		Scope:         string(scope.Mode),
		RequestedMode: string(normalized.Mode),
		TargetModel:   normalized.TargetModel,
	}, nil
}

const (
	rebuildRPCBaseLogFieldCount       = 8
	asyncTaskStatusAccepted           = "accepted"
	repairSourceBindingsTaskIDPrefix  = "repair-source-bindings-"
	knowledgeRebuildAsyncTaskName     = "knowledge rebuild"
	repairSourceBindingsAsyncTaskName = "repair source bindings"
)

func (h *KnowledgeBaseRPCService) logRebuildRPCAccepted(
	ctx context.Context,
	scope rebuilddto.Scope,
	normalized rebuilddto.RunOptions,
) {
	h.logger.InfoContext(
		ctx,
		"Knowledge rebuild RPC accepted",
		rebuildRPCLogFields(
			scope,
			"status", asyncTaskStatusAccepted,
			"run_id", normalized.ResumeRunID,
			"requested_mode", string(normalized.Mode),
			"target_model", normalized.TargetModel,
			"target_dimension", normalized.TargetDimension,
			"concurrency", normalized.Concurrency,
			"batch_size", normalized.BatchSize,
			"retry", normalized.Retry,
		)...,
	)
}

func (h *KnowledgeBaseRPCService) prepareKnowledgeRebuild(
	ctx context.Context,
	req *dto.RebuildKnowledgeBaseRequest,
	scope rebuilddto.Scope,
) error {
	if h.rebuildPreparer == nil {
		return nil
	}
	fields := rebuildRPCLogFields(scope)
	if runID := asyncTaskRunIDFromContext(ctx); runID != "" {
		fields = rebuildRPCLogFields(scope, "run_id", runID)
	}
	h.logger.InfoContext(ctx, "Knowledge rebuild prepare started", fields...)
	if err := h.rebuildPreparer.PrepareRebuild(
		ctx,
		req.DataIsolation.ResolveOrganizationCode(),
		knowledgeBaseRebuildScopeFromDTO(scope),
	); err != nil {
		h.logger.ErrorContext(ctx, "Failed to prepare knowledge rebuild", appendBackgroundErrorField(fields, err)...)
		return fmt.Errorf("prepare knowledge rebuild: %w", err)
	}
	h.logger.InfoContext(ctx, "Knowledge rebuild prepare finished", fields...)
	return nil
}

func rebuildRPCLogFields(scope rebuilddto.Scope, extra ...any) []any {
	fields := make([]any, 0, rebuildRPCBaseLogFieldCount+len(extra))
	fields = append(
		fields,
		"scope", string(scope.Mode),
		"knowledge_organization_code", scope.OrganizationCode,
		"knowledge_base_code", scope.KnowledgeBaseCode,
		"document_code", scope.DocumentCode,
	)
	return append(fields, extra...)
}

func buildRebuildBusinessParams(req *dto.RebuildKnowledgeBaseRequest, scope rebuilddto.Scope) *ctxmeta.BusinessParams {
	if req == nil {
		return nil
	}

	businessID := scope.KnowledgeBaseCode
	if businessID == "" {
		businessID = scope.DocumentCode
	}

	return &ctxmeta.BusinessParams{
		OrganizationCode: req.DataIsolation.ResolveOrganizationCode(),
		UserID:           strings.TrimSpace(req.DataIsolation.UserID),
		BusinessID:       strings.TrimSpace(businessID),
	}
}

// RepairSourceBindingsRPC 修复历史 teamshare 来源绑定。
func (h *KnowledgeBaseRPCService) RepairSourceBindingsRPC(
	ctx context.Context,
	req *dto.RepairSourceBindingsRequest,
) (*dto.RepairSourceBindingsResponse, error) {
	input := &kbdto.RepairSourceBindingsInput{
		OrganizationCode:  req.DataIsolation.ResolveOrganizationCode(),
		UserID:            req.DataIsolation.UserID,
		OrganizationCodes: append([]string(nil), req.OrganizationCodes...),
		ThirdPlatformType: req.ThirdPlatformType,
		BatchSize:         req.BatchSize,
	}
	taskID := generateRepairSourceBindingsTaskID()
	h.logRepairSourceBindingsAccepted(ctx, input, taskID)
	h.runRepairSourceBindingsInBackground(ctx, input, taskID)

	return &dto.RepairSourceBindingsResponse{
		Status:            asyncTaskStatusAccepted,
		TaskID:            taskID,
		OrganizationCode:  input.OrganizationCode,
		OrganizationCodes: append([]string(nil), input.OrganizationCodes...),
		ThirdPlatformType: input.ThirdPlatformType,
	}, nil
}

func (h *KnowledgeBaseRPCService) runKnowledgeRebuildInBackground(
	ctx context.Context,
	req *dto.RebuildKnowledgeBaseRequest,
	scope rebuilddto.Scope,
	opts rebuilddto.RunOptions,
	normalized rebuilddto.RunOptions,
) {
	bgCtx := ctxmeta.Detach(ctx)
	baseFields := rebuildRPCLogFields(
		scope,
		"run_id", normalized.ResumeRunID,
		"requested_mode", string(normalized.Mode),
		"target_model", normalized.TargetModel,
	)
	go func() {
		defer h.recoverAsyncTask(bgCtx, knowledgeRebuildAsyncTaskName, baseFields...)

		asyncCtx := context.WithValue(bgCtx, asyncTaskRunIDContextKey{}, normalized.ResumeRunID)
		h.logger.InfoContext(asyncCtx, "Knowledge rebuild background task started", baseFields...)
		if err := h.prepareKnowledgeRebuild(asyncCtx, req, scope); err != nil {
			return
		}

		h.logger.InfoContext(asyncCtx, "Knowledge rebuild trigger started", baseFields...)
		triggerResult, err := h.rebuildTrigger.Trigger(asyncCtx, opts)
		if err != nil {
			h.logger.ErrorContext(asyncCtx, "Failed to trigger knowledge rebuild", appendBackgroundErrorField(baseFields, err)...)
			return
		}

		finishFields := rebuildRPCLogFields(
			scope,
			"accepted_run_id", normalized.ResumeRunID,
			"run_id", triggerResult.RunID,
			"status", triggerResult.Status,
		)
		h.logger.InfoContext(asyncCtx, "Knowledge rebuild trigger finished", finishFields...)
		h.logger.InfoContext(asyncCtx, "Knowledge rebuild background task finished", finishFields...)
	}()
}

func (h *KnowledgeBaseRPCService) logRepairSourceBindingsAccepted(
	ctx context.Context,
	input *kbdto.RepairSourceBindingsInput,
	taskID string,
) {
	h.logger.InfoContext(
		ctx,
		"Repair source bindings RPC accepted",
		repairSourceBindingsLogFields(input, taskID, "status", asyncTaskStatusAccepted)...,
	)
}

func (h *KnowledgeBaseRPCService) runRepairSourceBindingsInBackground(
	ctx context.Context,
	input *kbdto.RepairSourceBindingsInput,
	taskID string,
) {
	bgCtx := ctxmeta.Detach(ctx)
	baseFields := repairSourceBindingsLogFields(input, taskID)
	go func() {
		defer h.recoverAsyncTask(bgCtx, repairSourceBindingsAsyncTaskName, baseFields...)

		h.logger.InfoContext(bgCtx, "Repair source bindings background task started", baseFields...)
		result, err := h.repairCommand.RepairSourceBindings(bgCtx, input)
		if err != nil {
			h.logger.ErrorContext(bgCtx, "Repair source bindings background task failed", appendBackgroundErrorField(baseFields, err)...)
			return
		}

		h.logger.InfoContext(
			bgCtx,
			"Repair source bindings background task finished",
			repairSourceBindingsLogFields(
				input,
				taskID,
				"scanned_organizations", result.ScannedOrganizations,
				"scanned_knowledge", result.ScannedKnowledge,
				"candidate_bindings", result.CandidateBindings,
				"added_bindings", result.AddedBindings,
				"materialized_documents", result.MaterializedDocs,
				"reused_documents", result.ReusedDocuments,
				"backfilled_rows", result.BackfilledRows,
				"failed_groups", result.FailedGroups,
			)...,
		)
	}()
}

func repairSourceBindingsLogFields(input *kbdto.RepairSourceBindingsInput, taskID string, extra ...any) []any {
	orgCode := ""
	orgCodes := []string(nil)
	thirdPlatformType := ""
	batchSize := 0
	if input != nil {
		orgCode = strings.TrimSpace(input.OrganizationCode)
		orgCodes = append(orgCodes, input.OrganizationCodes...)
		thirdPlatformType = strings.TrimSpace(input.ThirdPlatformType)
		batchSize = input.BatchSize
	}

	fields := make([]any, 0, 10+len(extra))
	fields = append(
		fields,
		"task_id", taskID,
		"organization_code", orgCode,
		"organization_codes", orgCodes,
		"organization_count", len(orgCodes),
		"third_platform_type", thirdPlatformType,
		"batch_size", batchSize,
	)
	return append(fields, extra...)
}

func (h *KnowledgeBaseRPCService) recoverAsyncTask(ctx context.Context, taskName string, fields ...any) {
	if recovered := recover(); recovered != nil {
		h.logger.ErrorContext(
			ctx,
			fmt.Sprintf("%s background task panicked", taskName),
			append(fields, "panic", recovered)...,
		)
	}
}

func appendBackgroundErrorField(fields []any, err error) []any {
	merged := make([]any, 0, len(fields)+2)
	merged = append(merged, fields...)
	return append(merged, "error", err)
}

func generateAsyncRebuildRunID(existing string) string {
	if trimmed := strings.TrimSpace(existing); trimmed != "" {
		return trimmed
	}
	return fmt.Sprintf("r%d", time.Now().UnixNano())
}

func generateRepairSourceBindingsTaskID() string {
	return fmt.Sprintf("%s%d", repairSourceBindingsTaskIDPrefix, time.Now().UnixNano())
}

type asyncTaskRunIDContextKey struct{}

func asyncTaskRunIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	runID, _ := ctx.Value(asyncTaskRunIDContextKey{}).(string)
	return strings.TrimSpace(runID)
}

// RebuildCleanupRPC 预览或执行一次重建残留清理。
func (h *KnowledgeBaseRPCService) RebuildCleanupRPC(
	ctx context.Context,
	req *dto.RebuildCleanupRequest,
) (*dto.RebuildCleanupResponse, error) {
	if h.rebuildCleaner == nil {
		return nil, jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInternalError, "knowledge rebuild cleanup service not initialized", nil)
	}

	result, err := h.rebuildCleaner.Cleanup(ctx, &rebuilddto.CleanupInput{
		OrganizationCode:    req.DataIsolation.ResolveOrganizationCode(),
		Apply:               req.Apply,
		ForceDeleteNonEmpty: req.ForceDeleteNonEmpty,
	})
	if err != nil {
		h.logger.ErrorContext(ctx, "Failed to cleanup rebuild collections", "error", err)
		return nil, mapBusinessError(err)
	}
	return cleanupResultToRPCResponse(result), nil
}

func cleanupResultToRPCResponse(result *rebuilddto.CleanupResult) *dto.RebuildCleanupResponse {
	if result == nil {
		return &dto.RebuildCleanupResponse{
			SafeToDeleteCollections: make([]dto.RebuildCleanupCollectionAudit, 0),
			KeptCollections:         make([]dto.RebuildCleanupCollectionAudit, 0),
			SkipReason:              map[string]string{},
		}
	}
	response := &dto.RebuildCleanupResponse{
		Apply:                    result.Apply,
		ForceDeleteNonEmpty:      result.ForceDeleteNonEmpty,
		CandidatePattern:         result.CandidatePattern,
		AliasName:                result.AliasName,
		AliasTarget:              result.AliasTarget,
		MetaPhysicalCollection:   result.MetaPhysicalCollection,
		CurrentRunID:             result.CurrentRunID,
		SafeToDeleteCollections:  make([]dto.RebuildCleanupCollectionAudit, 0, len(result.SafeToDeleteCollections)),
		KeptCollections:          make([]dto.RebuildCleanupCollectionAudit, 0, len(result.KeptCollections)),
		SkipReason:               make(map[string]string, len(result.SkipReason)),
		DeletedDualwriteState:    result.DeletedDualwriteState,
		TotalCollections:         result.TotalCollections,
		CandidateCollectionCount: result.CandidateCollectionCount,
		SafeToDeleteCount:        result.SafeToDeleteCount,
		KeptCount:                result.KeptCount,
	}
	maps.Copy(response.SkipReason, result.SkipReason)
	for _, item := range result.SafeToDeleteCollections {
		response.SafeToDeleteCollections = append(response.SafeToDeleteCollections, dto.RebuildCleanupCollectionAudit{
			Name:   item.Name,
			Points: item.Points,
		})
	}
	for _, item := range result.KeptCollections {
		response.KeptCollections = append(response.KeptCollections, dto.RebuildCleanupCollectionAudit{
			Name:   item.Name,
			Points: item.Points,
		})
	}
	if result.DualWriteState != nil {
		response.DualWriteState = &dto.RebuildCleanupDualWriteState{
			RunID:            result.DualWriteState.RunID,
			Enabled:          result.DualWriteState.Enabled,
			Mode:             result.DualWriteState.Mode,
			ActiveCollection: result.DualWriteState.ActiveCollection,
			ShadowCollection: result.DualWriteState.ShadowCollection,
			ActiveModel:      result.DualWriteState.ActiveModel,
			TargetModel:      result.DualWriteState.TargetModel,
		}
	}
	return response
}

func normalizeRebuildScope(
	rawScope string,
	rawOrganizationCode string,
	rawKnowledgeBaseCode string,
	rawDocumentCode string,
	userID string,
) (rebuilddto.Scope, error) {
	scope := strings.ToLower(strings.TrimSpace(rawScope))
	switch scope {
	case "", string(rebuilddto.ScopeModeAll):
		return rebuilddto.Scope{Mode: rebuilddto.ScopeModeAll}, nil
	case string(rebuilddto.ScopeModeOrganization):
		organizationCode := strings.TrimSpace(rawOrganizationCode)
		if organizationCode == "" {
			return rebuilddto.Scope{}, errRebuildScopeOrganizationCodeRequired
		}
		return rebuilddto.Scope{
			Mode:             rebuilddto.ScopeModeOrganization,
			OrganizationCode: organizationCode,
			UserID:           strings.TrimSpace(userID),
		}, nil
	case string(rebuilddto.ScopeModeKnowledgeBase):
		organizationCode := strings.TrimSpace(rawOrganizationCode)
		knowledgeBaseCode := strings.TrimSpace(rawKnowledgeBaseCode)
		if organizationCode == "" || knowledgeBaseCode == "" {
			return rebuilddto.Scope{}, errRebuildScopeKnowledgeBaseFieldsRequired
		}
		return rebuilddto.Scope{
			Mode:              rebuilddto.ScopeModeKnowledgeBase,
			OrganizationCode:  organizationCode,
			KnowledgeBaseCode: knowledgeBaseCode,
			UserID:            strings.TrimSpace(userID),
		}, nil
	case string(rebuilddto.ScopeModeDocument):
		organizationCode := strings.TrimSpace(rawOrganizationCode)
		knowledgeBaseCode := strings.TrimSpace(rawKnowledgeBaseCode)
		documentCode := strings.TrimSpace(rawDocumentCode)
		if organizationCode == "" || knowledgeBaseCode == "" || documentCode == "" {
			return rebuilddto.Scope{}, errRebuildScopeDocumentFieldsRequired
		}
		return rebuilddto.Scope{
			Mode:              rebuilddto.ScopeModeDocument,
			OrganizationCode:  organizationCode,
			KnowledgeBaseCode: knowledgeBaseCode,
			DocumentCode:      documentCode,
			UserID:            strings.TrimSpace(userID),
		}, nil
	default:
		return rebuilddto.Scope{}, fmt.Errorf("%w: %s", errRebuildScopeInvalid, rawScope)
	}
}

func normalizeRebuildMode(rawMode string) (rebuilddto.RunMode, error) {
	mode := rebuilddto.RunMode(strings.ToLower(strings.TrimSpace(rawMode)))
	switch mode {
	case "", rebuilddto.ModeAuto:
		return rebuilddto.ModeAuto, nil
	case rebuilddto.ModeInplace, rebuilddto.ModeBlueGreen:
		return mode, nil
	default:
		return "", fmt.Errorf("%w: %s", errRebuildModeInvalid, rawMode)
	}
}

func knowledgeBaseRebuildScopeFromDTO(scope rebuilddto.Scope) knowledgebaseapp.RebuildScope {
	return knowledgebaseapp.RebuildScope{
		Mode:              knowledgebaseapp.RebuildScopeMode(scope.Mode),
		OrganizationCode:  scope.OrganizationCode,
		KnowledgeBaseCode: scope.KnowledgeBaseCode,
		DocumentCode:      scope.DocumentCode,
		UserID:            scope.UserID,
	}
}

func toSourceBindingInputs(bindings []dto.SourceBindingPayload) []kbdto.SourceBindingInput {
	results := make([]kbdto.SourceBindingInput, 0, len(bindings))
	for _, binding := range bindings {
		targets := make([]kbdto.SourceBindingTargetInput, 0, len(binding.Targets))
		for _, target := range binding.Targets {
			targets = append(targets, kbdto.SourceBindingTargetInput{
				TargetType: normalizeSourceBindingTargetTypePayload(strings.TrimSpace(target.TargetType)),
				TargetRef:  strings.TrimSpace(target.TargetRef),
			})
		}
		results = append(results, kbdto.SourceBindingInput{
			Provider:   strings.TrimSpace(binding.Provider),
			RootType:   strings.TrimSpace(binding.RootType),
			RootRef:    strings.TrimSpace(binding.RootRef),
			SyncMode:   strings.TrimSpace(binding.SyncMode),
			Enabled:    binding.Enabled,
			SyncConfig: map[string]any(binding.SyncConfig),
			Targets:    targets,
		})
	}
	return results
}

func normalizeSourceBindingTargetTypePayload(targetType string) string {
	switch strings.ToLower(strings.TrimSpace(targetType)) {
	case "group", "folder":
		return "folder"
	default:
		return strings.ToLower(strings.TrimSpace(targetType))
	}
}

func (h *KnowledgeBaseRPCService) lookupDocumentCounts(
	ctx context.Context,
	organizationCode string,
	items []*kbdto.KnowledgeBaseDTO,
) map[string]int64 {
	if h == nil || h.documentCounter == nil || len(items) == 0 {
		return map[string]int64{}
	}

	codes := make([]string, 0, len(items))
	for _, item := range items {
		if item == nil || item.Code == "" {
			continue
		}
		codes = append(codes, item.Code)
	}
	if len(codes) == 0 {
		return map[string]int64{}
	}

	counts, err := h.documentCounter.CountByKnowledgeBaseCodes(ctx, organizationCode, codes)
	if err != nil {
		if h.logger != nil {
			h.logger.WarnContext(ctx, "Failed to count knowledge base documents", "organization_code", organizationCode, "error", err)
		}
		return map[string]int64{}
	}
	return counts
}

func (h *KnowledgeBaseRPCService) lookupDocumentCount(ctx context.Context, organizationCode, knowledgeBaseCode string) int64 {
	if knowledgeBaseCode == "" {
		return 0
	}
	return h.lookupDocumentCounts(ctx, organizationCode, []*kbdto.KnowledgeBaseDTO{{Code: knowledgeBaseCode}})[knowledgeBaseCode]
}

func resolveOffsetPage(offset, limit int) int {
	if limit <= 0 {
		return 1
	}
	return max(1, offset/limit+1)
}
