package kbapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	sharedroute "magic/internal/domain/knowledge/shared/route"
)

var (
	errKnowledgeBaseAppServiceRequired           = errors.New("knowledge base app service is not initialized")
	errSwitchEmbeddingModelMetaInputRequired     = errors.New("switch embedding model meta input is required")
	errSwitchEmbeddingModelMetaModelRequired     = errors.New("target_model is required")
	errSwitchEmbeddingModelMetaDomainUnsupported = errors.New("knowledge base domain service does not support embedding model meta switch")
)

// SwitchEmbeddingModelMetaCommandApp 承接知识库共享 collection 元数据直接切换命令流。
type SwitchEmbeddingModelMetaCommandApp struct {
	*KnowledgeBaseAppService
}

type embeddingModelMetaSwitcher interface {
	SwitchEmbeddingModelMeta(ctx context.Context, targetModel string, targetDimension int64) (sharedroute.CollectionMeta, error)
}

// SwitchEmbeddingModelMetaCommandApp 返回知识库共享 collection 元数据直接切换命令应用服务。
func (s *KnowledgeBaseAppService) SwitchEmbeddingModelMetaCommandApp() *SwitchEmbeddingModelMetaCommandApp {
	return &SwitchEmbeddingModelMetaCommandApp{KnowledgeBaseAppService: s}
}

// SwitchEmbeddingModelMeta 兼容旧接线，内部转发给直接切换命令 app。
func (s *KnowledgeBaseAppService) SwitchEmbeddingModelMeta(
	ctx context.Context,
	input *kbdto.SwitchEmbeddingModelMetaInput,
) (*kbdto.SwitchEmbeddingModelMetaResult, error) {
	return s.SwitchEmbeddingModelMetaCommandApp().SwitchEmbeddingModelMeta(ctx, input)
}

// SwitchEmbeddingModelMeta 直接切换共享知识库 collection 元数据，不触发 rebuild。
func (a *SwitchEmbeddingModelMetaCommandApp) SwitchEmbeddingModelMeta(
	ctx context.Context,
	input *kbdto.SwitchEmbeddingModelMetaInput,
) (*kbdto.SwitchEmbeddingModelMetaResult, error) {
	if a == nil || a.KnowledgeBaseAppService == nil {
		return nil, errKnowledgeBaseAppServiceRequired
	}
	if input == nil {
		return nil, errSwitchEmbeddingModelMetaInputRequired
	}
	if strings.TrimSpace(input.TargetModel) == "" {
		return nil, errSwitchEmbeddingModelMetaModelRequired
	}
	if input.TargetDimension <= 0 {
		return nil, fmt.Errorf("%w: %d", knowledgebasedomain.ErrInvalidEmbeddingDimension, input.TargetDimension)
	}

	if a.embeddingModelMetaSwitcher == nil {
		return nil, errSwitchEmbeddingModelMetaDomainUnsupported
	}

	meta, err := a.embeddingModelMetaSwitcher.SwitchEmbeddingModelMeta(ctx, input.TargetModel, input.TargetDimension)
	if err != nil {
		return nil, fmt.Errorf("switch embedding model meta: %w", err)
	}
	return &kbdto.SwitchEmbeddingModelMetaResult{
		CollectionName:         meta.CollectionName,
		PhysicalCollectionName: meta.PhysicalCollectionName,
		Model:                  meta.Model,
		VectorDimension:        meta.VectorDimension,
		SparseBackend:          meta.SparseBackend,
	}, nil
}
