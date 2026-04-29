package fragapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

func isDocumentNotFoundError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, shared.ErrDocumentNotFound) {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), shared.ErrDocumentNotFound.Error())
}

func (s *FragmentAppService) buildManualWriteLifecycle(
	ctx context.Context,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	input *fragdto.CreateFragmentInput,
) (*fragdomain.ManualWriteLifecycleResult, error) {
	result, err := fragdomain.BuildManualWriteLifecycle(ctx, fragdomain.ManualWriteLifecycleInput{
		KnowledgeBase: kb,
		Fragment: fragdomain.ManualFragmentInput{
			KnowledgeCode:    input.KnowledgeCode,
			DocumentCode:     input.DocumentCode,
			Content:          input.Content,
			Metadata:         input.Metadata,
			BusinessID:       input.BusinessID,
			UserID:           input.UserID,
			OrganizationCode: input.OrganizationCode,
		},
	}, fragdomain.ManualWriteLifecyclePorts{
		LoadDocumentByCode:              s.loadManualWriteDocumentByCode,
		FindDocumentByLegacyThirdFile:   s.findManualWriteLegacyDocument,
		BuildLegacyThirdPlatformDocSpec: s.buildManualWriteLegacyDocumentSpec,
	})
	if err != nil {
		return nil, fmt.Errorf("build manual write lifecycle: %w", err)
	}
	return result, nil
}

func (s *FragmentAppService) loadManualWriteDocumentByCode(
	ctx context.Context,
	knowledgeCode string,
	documentCode string,
) (*fragmodel.KnowledgeBaseDocument, error) {
	if s == nil || s.documentService == nil {
		return nil, fragdomain.ErrManualWriteDocumentLoaderNil
	}

	doc, err := s.documentService.ShowByCodeAndKnowledgeBase(ctx, documentCode, knowledgeCode)
	switch {
	case err == nil && doc != nil:
		return fragDocumentFromDomain(doc), nil
	case err == nil || isDocumentNotFoundError(err):
		return nil, fragdomain.ErrManualWriteDocumentMissing
	default:
		return nil, fmt.Errorf("find document by code: %w", err)
	}
}

func (s *FragmentAppService) findManualWriteLegacyDocument(
	ctx context.Context,
	knowledgeCode string,
	thirdPlatformType string,
	thirdFileID string,
) (*fragmodel.KnowledgeBaseDocument, error) {
	if s == nil || s.legacyThirdPlatformCompat == nil {
		return nil, fragdomain.ErrManualWriteLegacyDocumentLoaderNil
	}
	return s.legacyThirdPlatformCompat.FindDocumentByThirdFile(ctx, knowledgeCode, thirdPlatformType, thirdFileID)
}

func (s *FragmentAppService) buildManualWriteLegacyDocumentSpec(
	ctx context.Context,
	input fragdomain.LegacyThirdPlatformDocumentSeed,
) (*fragdomain.LegacyThirdPlatformDocumentSpec, error) {
	if s == nil || s.legacyThirdPlatformCompat == nil {
		return nil, fragdomain.ErrManualWriteLegacyDocumentSpecBuilderNil
	}
	return s.legacyThirdPlatformCompat.BuildLegacyThirdPlatformDocumentSpec(ctx, input)
}

// LegacyThirdPlatformFragmentCompat 收口旧第三方 fragment 初始化兼容端口适配。
type LegacyThirdPlatformFragmentCompat struct {
	documentService fragmentAppDocumentReader
	providers       *thirdplatformprovider.Registry
}

// NewLegacyThirdPlatformFragmentCompat 创建旧第三方 fragment 兼容适配器。
func NewLegacyThirdPlatformFragmentCompat(
	documentService fragmentAppDocumentReader,
	providers *thirdplatformprovider.Registry,
) *LegacyThirdPlatformFragmentCompat {
	return &LegacyThirdPlatformFragmentCompat{
		documentService: documentService,
		providers:       providers,
	}
}

// FindDocumentByThirdFile 读取旧第三方 fragment 对应的 document 映射。
func (c *LegacyThirdPlatformFragmentCompat) FindDocumentByThirdFile(
	ctx context.Context,
	knowledgeBaseCode string,
	platformType string,
	thirdFileID string,
) (*fragmodel.KnowledgeBaseDocument, error) {
	if c == nil || c.documentService == nil {
		return nil, fragdomain.ErrManualWriteLegacyDocumentLoaderNil
	}

	doc, err := c.documentService.FindByKnowledgeBaseAndThirdFile(
		ctx,
		strings.TrimSpace(knowledgeBaseCode),
		strings.TrimSpace(platformType),
		strings.TrimSpace(thirdFileID),
	)
	switch {
	case err == nil && doc != nil:
		return fragDocumentFromDomain(doc), nil
	case err == nil || isDocumentNotFoundError(err):
		return nil, fragdomain.ErrManualWriteDocumentMissing
	default:
		return nil, fmt.Errorf("find document mapping by third file: %w", err)
	}
}

// BuildLegacyThirdPlatformDocumentSpec 构造旧第三方 fragment 的初始文档规格。
func (c *LegacyThirdPlatformFragmentCompat) BuildLegacyThirdPlatformDocumentSpec(
	ctx context.Context,
	input fragdomain.LegacyThirdPlatformDocumentSeed,
) (*fragdomain.LegacyThirdPlatformDocumentSpec, error) {
	if c == nil {
		return nil, fragdomain.ErrManualWriteLegacyDocumentSpecBuilderNil
	}
	provider, err := c.providers.Provider(input.ThirdPlatformType)
	if err != nil {
		return nil, fmt.Errorf("resolve third-platform provider: %w", err)
	}

	spec, err := provider.BuildInitialDocument(ctx, thirdplatformprovider.BuildInitialDocumentInput{
		OrganizationCode:  input.OrganizationCode,
		UserID:            input.UserID,
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		ThirdFileID:       input.ThirdFileID,
		Metadata:          input.Metadata,
	})
	if err != nil {
		return nil, fmt.Errorf("build initial third-platform document: %w", err)
	}

	return &fragdomain.LegacyThirdPlatformDocumentSpec{
		Name:              spec.Name,
		DocType:           spec.DocType,
		DocumentFile:      fragDocumentFileFromDomain(spec.DocumentFile),
		ThirdPlatformType: strings.TrimSpace(input.ThirdPlatformType),
		ThirdFileID:       strings.TrimSpace(input.ThirdFileID),
		UserID:            strings.TrimSpace(input.UserID),
		OrganizationCode:  strings.TrimSpace(input.OrganizationCode),
	}, nil
}
