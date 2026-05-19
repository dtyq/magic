package fragdomain

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"strings"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

var (
	// ErrManualWriteDocumentLoaderNil 表示手工写入生命周期缺少按文档编码加载文档的端口。
	ErrManualWriteDocumentLoaderNil = errors.New("manual write document loader is nil")
	// ErrManualWriteLegacyDocumentLoaderNil 表示手工写入生命周期缺少按第三方文件加载映射文档的端口。
	ErrManualWriteLegacyDocumentLoaderNil = errors.New("manual write legacy document loader is nil")
	// ErrManualWriteLegacyDocumentSpecBuilderNil 表示手工写入生命周期缺少历史第三方文档构造端口。
	ErrManualWriteLegacyDocumentSpecBuilderNil = errors.New("manual write legacy document spec builder is nil")
	// ErrManualWriteLegacyDocumentSpecRequired 表示历史第三方文档构造端口未返回有效结果。
	ErrManualWriteLegacyDocumentSpecRequired = errors.New("manual write legacy document spec is required")
	// ErrManualWriteDocumentMissing 表示文档查询端口确认目标文档不存在。
	ErrManualWriteDocumentMissing = errors.New("manual write document missing")
)

// ManualWriteLifecycleInput 描述一次手工 fragment 写入生命周期输入。
type ManualWriteLifecycleInput struct {
	KnowledgeBase *sharedsnapshot.KnowledgeBaseRuntimeSnapshot
	Fragment      ManualFragmentInput
}

// LegacyThirdPlatformDocumentSeed 描述历史第三方文档初始化所需上下文。
type LegacyThirdPlatformDocumentSeed struct {
	KnowledgeBaseCode string
	ThirdPlatformType string
	ThirdFileID       string
	UserID            string
	OrganizationCode  string
	Metadata          map[string]any
}

// ManualWriteLifecyclePorts 定义手工写入生命周期依赖的文档端口。
type ManualWriteLifecyclePorts struct {
	LoadDocumentByCode              func(context.Context, string, string) (*fragmodel.KnowledgeBaseDocument, error)
	FindDocumentByLegacyThirdFile   func(context.Context, string, string, string) (*fragmodel.KnowledgeBaseDocument, error)
	BuildLegacyThirdPlatformDocSpec func(context.Context, LegacyThirdPlatformDocumentSeed) (*LegacyThirdPlatformDocumentSpec, error)
}

// ManualWriteLifecycleResult 描述生命周期输出。
type ManualWriteLifecycleResult struct {
	DocumentPlan CreateFragmentDocumentPlan
	Document     *fragmodel.KnowledgeBaseDocument
	Fragment     *fragmodel.KnowledgeBaseFragment
}

// BuildManualWriteLifecycle 构造手工 fragment 写入生命周期结果。
func BuildManualWriteLifecycle(
	ctx context.Context,
	input ManualWriteLifecycleInput,
	ports ManualWriteLifecyclePorts,
) (*ManualWriteLifecycleResult, error) {
	if input.KnowledgeBase == nil {
		return nil, shared.ErrKnowledgeBaseNotFound
	}

	plan, err := ResolveCreateFragmentDocumentPlan(CreateFragmentDocumentPlanInput{
		KnowledgeBase:    input.KnowledgeBase,
		KnowledgeCode:    input.Fragment.KnowledgeCode,
		DocumentCode:     input.Fragment.DocumentCode,
		Metadata:         input.Fragment.Metadata,
		UserID:           input.Fragment.UserID,
		OrganizationCode: input.Fragment.OrganizationCode,
	})
	if err != nil {
		return nil, fmt.Errorf("resolve create fragment document plan: %w", err)
	}

	doc, err := resolveManualWriteLifecycleDocument(ctx, input, plan, ports)
	if err != nil {
		return nil, err
	}

	return &ManualWriteLifecycleResult{
		DocumentPlan: plan,
		Document:     doc,
		Fragment:     BuildManualFragment(doc, input.Fragment),
	}, nil
}

func resolveManualWriteLifecycleDocument(
	ctx context.Context,
	input ManualWriteLifecycleInput,
	plan CreateFragmentDocumentPlan,
	ports ManualWriteLifecyclePorts,
) (*fragmodel.KnowledgeBaseDocument, error) {
	switch plan.Strategy {
	case CreateFragmentDocumentByCode:
		return resolveManualWriteDocumentByCode(ctx, plan, input.Fragment.KnowledgeCode, ports)
	case CreateFragmentDocumentByLegacyThirdFile:
		return resolveManualWriteLegacyThirdPlatformDocument(ctx, input, plan, ports)
	default:
		return nil, shared.ErrFragmentDocumentCodeRequired
	}
}

func resolveManualWriteDocumentByCode(
	ctx context.Context,
	plan CreateFragmentDocumentPlan,
	knowledgeCode string,
	ports ManualWriteLifecyclePorts,
) (*fragmodel.KnowledgeBaseDocument, error) {
	if ports.LoadDocumentByCode == nil {
		return nil, ErrManualWriteDocumentLoaderNil
	}

	doc, err := ports.LoadDocumentByCode(ctx, strings.TrimSpace(knowledgeCode), strings.TrimSpace(plan.DocumentCode))
	switch {
	case err == nil && doc != nil:
		return doc, nil
	case err == nil || errors.Is(err, ErrManualWriteDocumentMissing):
		if plan.ManualFallbackDoc == nil {
			return nil, shared.ErrDocumentNotFound
		}
		return plan.ManualFallbackDoc, nil
	default:
		return nil, fmt.Errorf("load document by code: %w", err)
	}
}

func resolveManualWriteLegacyThirdPlatformDocument(
	ctx context.Context,
	input ManualWriteLifecycleInput,
	plan CreateFragmentDocumentPlan,
	ports ManualWriteLifecyclePorts,
) (*fragmodel.KnowledgeBaseDocument, error) {
	if strings.TrimSpace(plan.ThirdFileID) == "" {
		return nil, shared.ErrFragmentDocumentCodeRequired
	}
	if ports.FindDocumentByLegacyThirdFile == nil {
		return nil, ErrManualWriteLegacyDocumentLoaderNil
	}

	doc, err := ports.FindDocumentByLegacyThirdFile(
		ctx,
		strings.TrimSpace(input.Fragment.KnowledgeCode),
		strings.TrimSpace(plan.ThirdPlatformType),
		strings.TrimSpace(plan.ThirdFileID),
	)
	switch {
	case err == nil && doc != nil:
		return doc, nil
	case err != nil && !errors.Is(err, ErrManualWriteDocumentMissing):
		return nil, fmt.Errorf("load legacy third-platform document mapping: %w", err)
	}

	if ports.BuildLegacyThirdPlatformDocSpec == nil {
		return nil, ErrManualWriteLegacyDocumentSpecBuilderNil
	}

	spec, err := ports.BuildLegacyThirdPlatformDocSpec(ctx, LegacyThirdPlatformDocumentSeed{
		KnowledgeBaseCode: strings.TrimSpace(input.Fragment.KnowledgeCode),
		ThirdPlatformType: strings.TrimSpace(plan.ThirdPlatformType),
		ThirdFileID:       strings.TrimSpace(plan.ThirdFileID),
		UserID:            strings.TrimSpace(input.Fragment.UserID),
		OrganizationCode:  strings.TrimSpace(input.Fragment.OrganizationCode),
		Metadata:          maps.Clone(input.Fragment.Metadata),
	})
	if err != nil {
		return nil, fmt.Errorf("build legacy third-platform document spec: %w", err)
	}
	if spec == nil {
		return nil, ErrManualWriteLegacyDocumentSpecRequired
	}

	return BuildLegacyThirdPlatformDocument(input.KnowledgeBase, *spec), nil
}
