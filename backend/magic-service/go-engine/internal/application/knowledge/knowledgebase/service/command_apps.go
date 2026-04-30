package kbapp

import (
	"context"

	pagehelper "magic/internal/application/knowledge/helper/page"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	revectorizeshared "magic/internal/application/knowledge/shared/revectorize"
)

// KnowledgeBaseCreateApp 承接知识库创建命令流。
type KnowledgeBaseCreateApp struct {
	*KnowledgeBaseAppService
}

// KnowledgeBaseUpdateApp 承接知识库更新命令流。
type KnowledgeBaseUpdateApp struct {
	*KnowledgeBaseAppService
}

// KnowledgeBaseDestroyApp 承接知识库销毁命令流。
type KnowledgeBaseDestroyApp struct {
	*KnowledgeBaseAppService
}

// SourceBindingNodesApp 承接来源绑定节点查询命令流。
type SourceBindingNodesApp struct {
	*KnowledgeBaseAppService
}

// SourceBindingRepairApp 承接来源绑定修复命令流。
type SourceBindingRepairApp struct {
	*KnowledgeBaseAppService
}

// RebuildPrepareApp 承接重建前准备命令流。
type RebuildPrepareApp struct {
	*KnowledgeBaseAppService
}

// CreateCommandApp 返回知识库创建命令应用服务。
func (s *KnowledgeBaseAppService) CreateCommandApp() *KnowledgeBaseCreateApp {
	return &KnowledgeBaseCreateApp{KnowledgeBaseAppService: s}
}

// UpdateCommandApp 返回知识库更新命令应用服务。
func (s *KnowledgeBaseAppService) UpdateCommandApp() *KnowledgeBaseUpdateApp {
	return &KnowledgeBaseUpdateApp{KnowledgeBaseAppService: s}
}

// DestroyCommandApp 返回知识库销毁命令应用服务。
func (s *KnowledgeBaseAppService) DestroyCommandApp() *KnowledgeBaseDestroyApp {
	return &KnowledgeBaseDestroyApp{KnowledgeBaseAppService: s}
}

// SourceBindingNodesCommandApp 返回来源绑定节点命令应用服务。
func (s *KnowledgeBaseAppService) SourceBindingNodesCommandApp() *SourceBindingNodesApp {
	return &SourceBindingNodesApp{KnowledgeBaseAppService: s}
}

// SourceBindingRepairCommandApp 返回来源绑定修复命令应用服务。
func (s *KnowledgeBaseAppService) SourceBindingRepairCommandApp() *SourceBindingRepairApp {
	return &SourceBindingRepairApp{KnowledgeBaseAppService: s}
}

// RebuildPrepareCommandApp 返回重建准备命令应用服务。
func (s *KnowledgeBaseAppService) RebuildPrepareCommandApp() *RebuildPrepareApp {
	return &RebuildPrepareApp{KnowledgeBaseAppService: s}
}

// Create 兼容旧接线，内部转发给创建命令 app。
func (s *KnowledgeBaseAppService) Create(
	ctx context.Context,
	input *kbdto.CreateKnowledgeBaseInput,
) (*kbdto.KnowledgeBaseDTO, error) {
	return s.CreateCommandApp().Create(ctx, input)
}

// Update 兼容旧接线，内部转发给更新命令 app。
func (s *KnowledgeBaseAppService) Update(
	ctx context.Context,
	input *kbdto.UpdateKnowledgeBaseInput,
) (*kbdto.KnowledgeBaseDTO, error) {
	return s.UpdateCommandApp().Update(ctx, input)
}

// Destroy 兼容旧接线，内部转发给销毁命令 app。
func (s *KnowledgeBaseAppService) Destroy(
	ctx context.Context,
	code string,
	orgCode string,
	userID string,
) error {
	return s.DestroyCommandApp().Destroy(ctx, code, orgCode, userID)
}

// ListSourceBindingNodes 兼容旧接线，内部转发给来源绑定节点命令 app。
func (s *KnowledgeBaseAppService) ListSourceBindingNodes(
	ctx context.Context,
	input *kbdto.ListSourceBindingNodesInput,
) (*kbdto.ListSourceBindingNodesResult, error) {
	return s.SourceBindingNodesCommandApp().ListSourceBindingNodes(ctx, input)
}

// RepairSourceBindings 兼容旧接线，内部转发给来源绑定修复命令 app。
func (s *KnowledgeBaseAppService) RepairSourceBindings(
	ctx context.Context,
	input *kbdto.RepairSourceBindingsInput,
) (*kbdto.RepairSourceBindingsResult, error) {
	return s.SourceBindingRepairCommandApp().RepairSourceBindings(ctx, input)
}

// PrepareRebuild 兼容旧接线，内部转发给重建准备命令 app。
func (s *KnowledgeBaseAppService) PrepareRebuild(
	ctx context.Context,
	operatorOrganizationCode string,
	scope RebuildScope,
) error {
	return s.RebuildPrepareCommandApp().PrepareRebuild(ctx, operatorOrganizationCode, scope)
}

// SaveProcess 兼容旧接线，内部转发给进度更新查询 app。
func (s *KnowledgeBaseAppService) SaveProcess(
	ctx context.Context,
	input *kbdto.SaveProcessKnowledgeBaseInput,
) (*kbdto.KnowledgeBaseDTO, error) {
	return s.SaveProcessQueryApp().SaveProcess(ctx, input)
}

// SaveRevectorizeProgress 为知识库级重向量化用例提供进度持久化入口。
func (s *KnowledgeBaseAppService) SaveRevectorizeProgress(
	ctx context.Context,
	input *revectorizeshared.SaveProcessInput,
) error {
	if input == nil {
		return nil
	}
	_, err := s.SaveProcess(ctx, &kbdto.SaveProcessKnowledgeBaseInput{
		OrganizationCode: input.OrganizationCode,
		UserID:           input.UserID,
		Code:             input.Code,
		ExpectedNum:      input.ExpectedNum,
		CompletedNum:     input.CompletedNum,
	})
	return err
}

// Show 兼容旧接线，内部转发给详情查询 app。
func (s *KnowledgeBaseAppService) Show(
	ctx context.Context,
	code, orgCode, userID string,
) (*kbdto.KnowledgeBaseDTO, error) {
	return s.ShowQueryApp().Show(ctx, code, orgCode, userID)
}

// List 兼容旧接线，内部转发给列表查询 app。
func (s *KnowledgeBaseAppService) List(
	ctx context.Context,
	input *kbdto.ListKnowledgeBaseInput,
) (*pagehelper.Result, error) {
	return s.ListQueryApp().List(ctx, input)
}
