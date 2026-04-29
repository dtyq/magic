package fragapp

import (
	"testing"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	kbaccess "magic/internal/domain/knowledge/access/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/tokenizer"
)

// AppServiceForTestOptions 聚合片段应用服务测试依赖。
type AppServiceForTestOptions struct {
	FragmentService           any
	KBService                 any
	DocumentService           any
	ManualFragmentCoordinator any
	ParseService              any
	ProjectFileContentPort    documentdomain.ProjectFileContentAccessor
	ThirdPlatformDocumentPort thirdPlatformPreviewResolver
	ThirdPlatformProviders    *thirdplatformprovider.Registry
	PreviewSplitter           documentsplitter.PreviewSplitter
	KnowledgeBaseBindingRepo  fragmentAppKnowledgeBaseBindingReader
	SuperMagicAgentAccess     fragmentAppSuperMagicAgentAccessChecker
	TeamshareTempCodeMapper   fragmentAppTeamshareTempCodeMapper
	PermissionReader          kbaccess.PermissionReader
	DefaultEmbeddingModel     string
	Logger                    *logging.SugaredLogger
}

// NewFragmentAppServiceForTest 构造仅用于测试的片段应用服务。
func NewFragmentAppServiceForTest(tb testing.TB, opts AppServiceForTestOptions) *FragmentAppService {
	tb.Helper()

	var fs fragmentAppFragmentService
	if opts.FragmentService != nil {
		var ok bool
		fs, ok = opts.FragmentService.(fragmentAppFragmentService)
		if !ok {
			tb.Fatalf("fragmentService does not implement fragmentAppFragmentService: %T", opts.FragmentService)
			return nil
		}
	}
	var kbs fragmentAppKnowledgeBaseReader
	if opts.KBService != nil {
		var ok bool
		kbs, ok = opts.KBService.(fragmentAppKnowledgeBaseReader)
		if !ok {
			tb.Fatalf("kbService does not implement fragmentAppKnowledgeBaseReader: %T", opts.KBService)
			return nil
		}
	}
	var ds fragmentAppDocumentReader
	if opts.DocumentService != nil {
		var ok bool
		ds, ok = opts.DocumentService.(fragmentAppDocumentReader)
		if !ok {
			tb.Fatalf("documentService does not implement fragmentAppDocumentReader: %T", opts.DocumentService)
			return nil
		}
	}
	var coordinator fragmentManualCoordinator
	if opts.ManualFragmentCoordinator != nil {
		var ok bool
		coordinator, ok = opts.ManualFragmentCoordinator.(fragmentManualCoordinator)
		if !ok {
			tb.Fatalf("manualFragmentCoordinator does not implement fragmentManualCoordinator: %T", opts.ManualFragmentCoordinator)
			return nil
		}
	}
	var ps fragmentAppParseService
	if opts.ParseService != nil {
		var ok bool
		ps, ok = opts.ParseService.(fragmentAppParseService)
		if !ok {
			tb.Fatalf("parseService does not implement fragmentAppParseService: %T", opts.ParseService)
			return nil
		}
	}
	service := &FragmentAppService{
		fragmentService:           fs,
		kbService:                 kbs,
		documentService:           ds,
		manualFragmentCoordinator: coordinator,
		parseService:              ps,
		projectFileContentPort:    opts.ProjectFileContentPort,
		thirdPlatformDocumentPort: opts.ThirdPlatformDocumentPort,
		thirdPlatformProviders:    opts.ThirdPlatformProviders,
		previewSplitter:           opts.PreviewSplitter,
		knowledgeBaseBindingRepo:  opts.KnowledgeBaseBindingRepo,
		superMagicAgentAccess:     opts.SuperMagicAgentAccess,
		teamshareTempCodeMapper:   opts.TeamshareTempCodeMapper,
		permissionReader:          opts.PermissionReader,
		tokenizer:                 tokenizer.NewService(),
		defaultEmbeddingModel:     opts.DefaultEmbeddingModel,
		logger:                    opts.Logger,
	}
	service.legacyThirdPlatformCompat = NewLegacyThirdPlatformFragmentCompat(ds, opts.ThirdPlatformProviders)
	return service
}

// BuildSimilaritySearchOptionsForTest 供测试构造相似度搜索参数。
func BuildSimilaritySearchOptionsForTest(input *fragdto.SimilarityInput) *fragretrieval.SimilaritySearchOptions {
	return buildSimilaritySearchOptions(input)
}

// BuildPreviewRequestKeyForTest 供测试构造预览缓存键。
func BuildPreviewRequestKeyForTest(input *fragdto.PreviewFragmentInput) string {
	return buildPreviewRequestKey(input)
}

// SetKnowledgeBasePermissionReaderForTest 供测试覆盖知识库权限读取依赖。
func (s *FragmentAppService) SetKnowledgeBasePermissionReaderForTest(reader kbaccess.PermissionReader) {
	if s == nil {
		return
	}
	s.permissionReader = reader
}

// BuildPreviewSegmentConfigForTest 供测试构造预览切片配置。
func BuildPreviewSegmentConfigForTest(cfg *confighelper.FragmentConfigDTO) fragdomain.PreviewSegmentConfig {
	return fragdomain.BuildPreviewSegmentConfig(confighelper.FragmentConfigDTOToEntity(cfg))
}

// NormalizePreviewDocumentFileForTest 供测试归一化预览文件。
func NormalizePreviewDocumentFileForTest(file *docfilehelper.DocumentFileDTO) *fragmodel.DocumentFile {
	return fragdomain.NormalizePreviewDocumentFile(previewDomainFileFromDTO(file))
}

// IsThirdPlatformPreviewDocumentForTest 供测试判断第三方文件。
func IsThirdPlatformPreviewDocumentForTest(file *fragmodel.DocumentFile) bool {
	return fragdomain.IsThirdPlatformPreviewDocument(file)
}

// BuildPreviewDocumentFilePayloadForTest 供测试构造预览文件载荷。
func BuildPreviewDocumentFilePayloadForTest(file *fragmodel.DocumentFile) map[string]any {
	return fragdomain.BuildPreviewDocumentFilePayload(file)
}

// ApplyResolvedPreviewDocumentFileForTest 供测试回填预览文件解析结果。
func ApplyResolvedPreviewDocumentFileForTest(file *fragmodel.DocumentFile, result map[string]any) {
	fragdomain.ApplyResolvedPreviewDocumentFile(file, result)
}

// FragmentEntityToDTOForTest 供测试执行 DTO 转换。
func FragmentEntityToDTOForTest(svc *FragmentAppService, fragment *fragmodel.KnowledgeBaseFragment) *fragdto.FragmentDTO {
	return svc.entityToDTO(fragment)
}

// ValidateFragmentScopeForTest 供测试校验片段归属范围。
func ValidateFragmentScopeForTest(fragment *fragmodel.KnowledgeBaseFragment, organizationCode, knowledgeCode, documentCode string) error {
	return validateFragmentScope(fragment, organizationCode, knowledgeCode, documentCode)
}

// BuildSimilarityDisplayContentForTest 供测试构造相似度展示文案。
func BuildSimilarityDisplayContentForTest(content string, metadata map[string]any) (string, int) {
	return buildSimilarityDisplayContent(content, metadata)
}

// KnowledgeBaseSnapshotFromDomainForTest 供测试验证知识库快照隔离。
func KnowledgeBaseSnapshotFromDomainForTest(kb *kbentity.KnowledgeBase) *sharedsnapshot.KnowledgeBaseRuntimeSnapshot {
	return knowledgeBaseSnapshotFromDomain(kb)
}

// FragDocumentFromDomainForTest 供测试验证文档快照隔离。
func FragDocumentFromDomainForTest(doc *docentity.KnowledgeBaseDocument) *fragmodel.KnowledgeBaseDocument {
	return fragDocumentFromDomain(doc)
}

// BuildRuntimeMetadataFieldFilterForTest 供测试验证 runtime metadata 过滤归一化。
func BuildRuntimeMetadataFieldFilterForTest(key string, value any) (shared.FieldFilter, bool) {
	return buildRuntimeMetadataFieldFilter(key, value)
}
