package document

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/ctxmeta"
)

var (
	// ErrSyncLifecycleDocumentRequired 表示同步生命周期缺少文档实体。
	ErrSyncLifecycleDocumentRequired = errors.New("sync lifecycle document is required")
	// ErrSyncLifecycleKnowledgeBaseRequired 表示同步生命周期缺少运行时知识库快照。
	ErrSyncLifecycleKnowledgeBaseRequired = errors.New("sync lifecycle knowledge base is required")
	// ErrSyncLifecycleContentOperatorNil 表示同步生命周期缺少内容处理端口。
	ErrSyncLifecycleContentOperatorNil = errors.New("sync lifecycle content operator is nil")
	// ErrSyncLifecycleFragmentOperatorNil 表示同步生命周期缺少片段处理端口。
	ErrSyncLifecycleFragmentOperatorNil = errors.New("sync lifecycle fragment operator is nil")
	// ErrSyncLifecycleDocumentStoreNil 表示同步生命周期缺少文档状态持久化端口。
	ErrSyncLifecycleDocumentStoreNil = errors.New("sync lifecycle document store is nil")
)

// SyncDocumentFileExtensionStage 描述文档扩展名解析阶段。
type SyncDocumentFileExtensionStage string

const (
	// SyncDocumentFileExtensionStagePersist 表示 source override 持久化阶段。
	SyncDocumentFileExtensionStagePersist SyncDocumentFileExtensionStage = "persist"
	// SyncDocumentFileExtensionStageSync 表示同步执行前的扩展名补齐阶段。
	SyncDocumentFileExtensionStageSync SyncDocumentFileExtensionStage = "sync"
)

// SyncLifecycleDocumentStore 定义同步生命周期需要的文档状态持久化能力。
type SyncLifecycleDocumentStore interface {
	Update(ctx context.Context, doc *KnowledgeBaseDocument) error
	MarkSyncing(ctx context.Context, doc *KnowledgeBaseDocument) error
	MarkSynced(ctx context.Context, doc *KnowledgeBaseDocument, wordCount int) error
	MarkSyncFailed(ctx context.Context, doc *KnowledgeBaseDocument, message string) error
}

// SyncLifecycleContentOperator 定义同步生命周期需要的内容解析能力。
type SyncLifecycleContentOperator interface {
	ResolveDocumentFileExtension(
		ctx context.Context,
		doc *KnowledgeBaseDocument,
		stage SyncDocumentFileExtensionStage,
	) string
	PreflightSource(ctx context.Context, doc *KnowledgeBaseDocument, override *SourceOverride) error
	ParseContent(
		ctx context.Context,
		doc *KnowledgeBaseDocument,
		businessParams *ctxmeta.BusinessParams,
		override *SourceOverride,
	) (SyncContentResult, error)
}

// SyncBuildFragmentsInput 描述切片构建输入。
type SyncBuildFragmentsInput struct {
	Document      *KnowledgeBaseDocument
	KnowledgeBase *sharedsnapshot.KnowledgeBaseRuntimeSnapshot
	Parsed        *ParsedDocument
}

// SyncFragmentBatch 表示一次同步链路构建出的全部片段。
type SyncFragmentBatch struct {
	Value any
	Count int
}

// SyncFragmentsInput 描述片段同步输入。
type SyncFragmentsInput struct {
	Document       *KnowledgeBaseDocument
	Mode           string
	FragmentBatch  SyncFragmentBatch
	BusinessParams *ctxmeta.BusinessParams
}

// SyncLifecycleFragmentOperator 定义同步生命周期需要的切片和向量同步能力。
type SyncLifecycleFragmentOperator interface {
	BuildFragments(ctx context.Context, input SyncBuildFragmentsInput) (SyncFragmentBatch, error)
	SyncFragments(ctx context.Context, input SyncFragmentsInput) error
}

// SyncLifecycleInput 描述一次文档同步生命周期所需的上下文。
type SyncLifecycleInput struct {
	Document       *KnowledgeBaseDocument
	KnowledgeBase  *sharedsnapshot.KnowledgeBaseRuntimeSnapshot
	Mode           string
	BusinessParams *ctxmeta.BusinessParams
	SourceOverride *SourceOverride
}

// SyncLifecycleService 负责收敛文档同步生命周期主流程。
type SyncLifecycleService struct {
	documentStore    SyncLifecycleDocumentStore
	contentOperator  SyncLifecycleContentOperator
	fragmentOperator SyncLifecycleFragmentOperator
	now              func() time.Time
}

// NewSyncLifecycleService 创建文档同步生命周期服务。
func NewSyncLifecycleService(
	documentStore SyncLifecycleDocumentStore,
	contentOperator SyncLifecycleContentOperator,
	fragmentOperator SyncLifecycleFragmentOperator,
) *SyncLifecycleService {
	return &SyncLifecycleService{
		documentStore:    documentStore,
		contentOperator:  contentOperator,
		fragmentOperator: fragmentOperator,
		now:              time.Now,
	}
}

// Sync 执行一次文档同步生命周期。
func (s *SyncLifecycleService) Sync(ctx context.Context, input SyncLifecycleInput) error {
	if err := s.validateInput(input); err != nil {
		return err
	}

	override := NormalizeSourceOverride(input.SourceOverride, s.currentTime())
	if err := s.prepareSource(ctx, input.Document, override); err != nil {
		return err
	}

	if err := s.documentStore.MarkSyncing(ctx, input.Document); err != nil {
		return fmt.Errorf("failed to mark document syncing: %w", err)
	}

	contentResult, err := s.contentOperator.ParseContent(ctx, input.Document, input.BusinessParams, override)
	if err != nil {
		return s.failSync(ctx, input.Document, SyncFailureParsing, err)
	}
	MergeParsedDocumentMeta(input.Document, contentResult.Parsed)

	fragmentBatch, err := s.fragmentOperator.BuildFragments(ctx, SyncBuildFragmentsInput{
		Document:      input.Document,
		KnowledgeBase: input.KnowledgeBase,
		Parsed:        contentResult.Parsed,
	})
	if err != nil {
		return s.failSync(ctx, input.Document, SyncFailureSplitFragments, err)
	}

	if err := s.fragmentOperator.SyncFragments(ctx, SyncFragmentsInput{
		Document:       input.Document,
		Mode:           ResolveSyncMode(input.Mode),
		FragmentBatch:  fragmentBatch,
		BusinessParams: input.BusinessParams,
	}); err != nil {
		return s.failSync(ctx, input.Document, SyncFailureSyncVector, err)
	}

	if err := s.documentStore.MarkSynced(ctx, input.Document, CountSyncContentWordCount(contentResult.Content)); err != nil {
		return fmt.Errorf("failed to mark document synced: %w", err)
	}
	return nil
}

func (s *SyncLifecycleService) validateInput(input SyncLifecycleInput) error {
	switch {
	case s == nil || s.documentStore == nil:
		return ErrSyncLifecycleDocumentStoreNil
	case s.contentOperator == nil:
		return ErrSyncLifecycleContentOperatorNil
	case s.fragmentOperator == nil:
		return ErrSyncLifecycleFragmentOperatorNil
	case input.Document == nil:
		return ErrSyncLifecycleDocumentRequired
	case input.KnowledgeBase == nil:
		return ErrSyncLifecycleKnowledgeBaseRequired
	case strings.TrimSpace(input.KnowledgeBase.Model) == "":
		return fmt.Errorf(
			"%w: rebuild target model or collection meta model is required",
			shared.ErrEmbeddingModelRequired,
		)
	default:
		return nil
	}
}

func (s *SyncLifecycleService) prepareSource(
	ctx context.Context,
	doc *KnowledgeBaseDocument,
	override *SourceOverride,
) error {
	if err := s.persistSourceOverride(ctx, doc, override); err != nil {
		return err
	}
	if err := s.contentOperator.PreflightSource(ctx, doc, override); err != nil {
		return fmt.Errorf("preflight document source: %w", err)
	}
	ApplyResolvedDocumentFileExtension(
		doc,
		s.contentOperator.ResolveDocumentFileExtension(ctx, doc, SyncDocumentFileExtensionStageSync),
	)
	return nil
}

func (s *SyncLifecycleService) persistSourceOverride(
	ctx context.Context,
	doc *KnowledgeBaseDocument,
	override *SourceOverride,
) error {
	if override == nil {
		return nil
	}

	changed := ApplySourceOverrideForSync(
		doc,
		override,
		s.contentOperator.ResolveDocumentFileExtension(ctx, doc, SyncDocumentFileExtensionStagePersist),
	)
	if !changed {
		return nil
	}
	if err := s.documentStore.Update(ctx, doc); err != nil {
		return fmt.Errorf("failed to update document source override: %w", err)
	}
	return nil
}

func (s *SyncLifecycleService) failSync(
	ctx context.Context,
	doc *KnowledgeBaseDocument,
	fallbackReason string,
	err error,
) error {
	reason, cause := unwrapSyncStageError(err, fallbackReason)
	if cause == nil {
		cause = err
	}

	failureErr := NewSyncStageError(reason, cause)
	if markErr := s.documentStore.MarkSyncFailed(ctx, doc, BuildSyncFailureMessage(reason, cause)); markErr != nil {
		return errors.Join(failureErr, fmt.Errorf("failed to mark document sync failed: %w", markErr))
	}
	return failureErr
}

func (s *SyncLifecycleService) currentTime() time.Time {
	if s != nil && s.now != nil {
		return s.now()
	}
	return time.Now()
}
