// Package kbapp 提供知识库应用服务测试辅助。
package kbapp

import (
	"context"
	"fmt"
	"testing"

	confighelper "magic/internal/application/knowledge/helper/config"
	kbdto "magic/internal/application/knowledge/knowledgebase/dto"
	"magic/internal/domain/knowledge/knowledgebase/service"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/infrastructure/logging"
)

// EntityToDTOForTest 供测试执行 DTO 转换。
func EntityToDTOForTest(svc *KnowledgeBaseAppService, kb *knowledgebase.KnowledgeBase) *kbdto.KnowledgeBaseDTO {
	return svc.entityToDTO(kb)
}

// EntityToDTOWithContextForTest 供测试执行带上下文的 DTO 转换。
func EntityToDTOWithContextForTest(ctx context.Context, svc *KnowledgeBaseAppService, kb *knowledgebase.KnowledgeBase) (*kbdto.KnowledgeBaseDTO, error) {
	return svc.entityToDTOWithContext(ctx, kb)
}

// PopulateFragmentCountsForTest 供测试补充片段统计。
func PopulateFragmentCountsForTest(ctx context.Context, svc *KnowledgeBaseAppService, dto *kbdto.KnowledgeBaseDTO) {
	svc.populateFragmentCounts(ctx, dto)
}

// NormalizeVectorDBForTest 供测试归一化向量库配置。
func NormalizeVectorDBForTest(vectorDB string) string {
	return normalizeVectorDB(vectorDB)
}

// EnsureKnowledgeBaseCodeForTest 供测试生成知识库编码。
func EnsureKnowledgeBaseCodeForTest(code string) string {
	return ensureKnowledgeBaseCode(code)
}

// InputToEntityForTest 供测试执行输入到实体的转换。
func InputToEntityForTest(svc *KnowledgeBaseAppService, input *kbdto.CreateKnowledgeBaseInput) *knowledgebase.KnowledgeBase {
	if input == nil {
		return nil
	}
	return knowledgebase.BuildKnowledgeBaseForCreate(&knowledgebase.CreateInput{
		Code:             input.Code,
		Name:             input.Name,
		Description:      input.Description,
		Type:             input.Type,
		Model:            input.Model,
		VectorDB:         input.VectorDB,
		BusinessID:       input.BusinessID,
		OrganizationCode: input.OrganizationCode,
		UserID:           input.UserID,
		Icon:             input.Icon,
		SourceType:       input.SourceType,
		RetrieveConfig:   confighelper.RetrieveConfigDTOToEntity(input.RetrieveConfig),
		FragmentConfig:   confighelper.FragmentConfigDTOToEntity(input.FragmentConfig),
		EmbeddingConfig:  confighelper.EmbeddingConfigDTOToEntity(input.EmbeddingConfig),
	})
}

// ValidateAndNormalizeSourceBindingsForTest 供测试执行来源绑定归一化与语义校验。
func ValidateAndNormalizeSourceBindingsForTest(
	knowledgeBaseType knowledgebase.Type,
	sourceType *int,
	bindings []kbdto.SourceBindingInput,
) ([]sourcebindingdomain.Binding, error) {
	return validateAndNormalizeSourceBindings(knowledgeBaseType, sourceType, bindings)
}

// NormalizedCreateCommandForTest 表示创建命令归一化后的最小测试视图。
type NormalizedCreateCommandForTest struct {
	KnowledgeBaseType knowledgebase.Type
	SourceType        *int
	AgentCodes        []string
	SourceBindings    []sourcebindingdomain.Binding
}

// NormalizeCreateCommandForTest 供测试执行创建命令归一化。
func NormalizeCreateCommandForTest(
	ctx context.Context,
	svc *KnowledgeBaseAppService,
	input *kbdto.CreateKnowledgeBaseInput,
) (*NormalizedCreateCommandForTest, error) {
	command, err := svc.CreateCommandApp().normalizeCreateCommand(ctx, input)
	if err != nil {
		return nil, err
	}
	if command == nil {
		return &NormalizedCreateCommandForTest{}, nil
	}
	return &NormalizedCreateCommandForTest{
		KnowledgeBaseType: command.knowledgeBaseType,
		SourceType:        cloneIntPtr(command.sourceType),
		AgentCodes:        append([]string(nil), command.agentCodes...),
		SourceBindings:    append([]sourcebindingdomain.Binding(nil), command.sourceBindings...),
	}, nil
}

// NormalizedUpdateCommandForTest 表示更新命令归一化后的最小测试视图。
type NormalizedUpdateCommandForTest struct {
	CurrentKnowledgeBaseType knowledgebase.Type
	KnowledgeBaseType        knowledgebase.Type
	SourceType               *int
	AgentCodes               []string
	SourceBindings           []sourcebindingdomain.Binding
	ReplaceSource            bool
	ReplaceAgentBinding      bool
}

// NormalizeUpdateCommandForTest 供测试执行更新命令归一化。
func NormalizeUpdateCommandForTest(
	ctx context.Context,
	svc *KnowledgeBaseAppService,
	input *kbdto.UpdateKnowledgeBaseInput,
	kb *knowledgebase.KnowledgeBase,
) (*NormalizedUpdateCommandForTest, error) {
	command, err := svc.UpdateCommandApp().normalizeUpdateCommand(ctx, input, kb)
	if err != nil {
		return nil, err
	}
	if command == nil {
		return &NormalizedUpdateCommandForTest{}, nil
	}
	return &NormalizedUpdateCommandForTest{
		CurrentKnowledgeBaseType: command.currentKnowledgeBaseType,
		KnowledgeBaseType:        command.knowledgeBaseType,
		SourceType:               cloneIntPtr(command.sourceType),
		AgentCodes:               append([]string(nil), command.agentCodes...),
		SourceBindings:           append([]sourcebindingdomain.Binding(nil), command.sourceBindings...),
		ReplaceSource:            command.replaceSource,
		ReplaceAgentBinding:      command.replaceAgentBinding,
	}, nil
}

// NewKnowledgeBaseAppServiceForTest 构造仅用于测试的知识库应用服务。
func NewKnowledgeBaseAppServiceForTest(
	tb testing.TB,
	domainService any,
	documentManager any,
	fragmentCounter fragmentCountProvider,
	logger *logging.SugaredLogger,
	defaultEmbeddingModel string,
) *KnowledgeBaseAppService {
	tb.Helper()

	var ds knowledgeBaseDomainService
	if domainService != nil {
		var ok bool
		ds, ok = domainService.(knowledgeBaseDomainService)
		if !ok {
			tb.Fatalf("domainService does not implement knowledgeBaseDomainService: %T", domainService)
			return nil
		}
	}
	svc := &KnowledgeBaseAppService{
		domainService:         ds,
		ownerGrantPort:        noopKnowledgeBaseOwnerGrantPort{},
		permissionReader:      noopKnowledgeBasePermissionReader{},
		officialOrgChecker:    noopKnowledgeBasePermissionReader{},
		fragmentCounter:       fragmentCounter,
		logger:                logger,
		defaultEmbeddingModel: defaultEmbeddingModel,
	}
	if documentManager == nil {
		return svc
	}
	if flow, ok := documentManager.(*KnowledgeBaseDocumentFlowApp); ok {
		svc.documentFlow = flow
		return svc
	}
	manager, ok := documentManager.(knowledgeBaseTestDocumentManager)
	if !ok {
		tb.Fatalf("documentManager does not implement knowledgeBaseTestDocumentManager: %T", documentManager)
		return nil
	}
	svc.documentFlow = &KnowledgeBaseDocumentFlowApp{
		support:          svc,
		managedDocuments: legacyKnowledgeBaseManagedDocumentStore{manager: manager},
	}
	return svc
}

type knowledgeBaseTestDocumentManager interface {
	CreateManagedDocument(ctx context.Context, input *CreateManagedDocumentInput) (*ManagedDocument, error)
	DestroyManagedDocument(ctx context.Context, code, knowledgeBaseCode string) error
	DestroyKnowledgeBaseDocuments(ctx context.Context, knowledgeBaseCode, organizationCode string) error
	ScheduleManagedDocumentSync(ctx context.Context, input *SyncDocumentInput)
	ListManagedDocumentsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) ([]*ManagedDocument, error)
}

type legacyKnowledgeBaseManagedDocumentStore struct {
	manager knowledgeBaseTestDocumentManager
}

func (s legacyKnowledgeBaseManagedDocumentStore) CreateManagedDocument(
	ctx context.Context,
	input *CreateManagedDocumentInput,
) (*ManagedDocument, error) {
	result, err := s.manager.CreateManagedDocument(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("legacy create managed document: %w", err)
	}
	return result, nil
}

func (s legacyKnowledgeBaseManagedDocumentStore) DestroyManagedDocument(
	ctx context.Context,
	code string,
	knowledgeBaseCode string,
) error {
	if err := s.manager.DestroyManagedDocument(ctx, code, knowledgeBaseCode); err != nil {
		return fmt.Errorf("legacy destroy managed document: %w", err)
	}
	return nil
}

func (s legacyKnowledgeBaseManagedDocumentStore) DestroyKnowledgeBaseDocuments(
	ctx context.Context,
	knowledgeBaseCode string,
	organizationCode string,
) error {
	if err := s.manager.DestroyKnowledgeBaseDocuments(ctx, knowledgeBaseCode, organizationCode); err != nil {
		return fmt.Errorf("legacy destroy knowledge base documents: %w", err)
	}
	return nil
}

func (s legacyKnowledgeBaseManagedDocumentStore) ScheduleManagedDocumentSync(ctx context.Context, input *SyncDocumentInput) {
	s.manager.ScheduleManagedDocumentSync(ctx, input)
}

func (s legacyKnowledgeBaseManagedDocumentStore) ListManagedDocumentsByKnowledgeBase(
	ctx context.Context,
	knowledgeBaseCode string,
) ([]*ManagedDocument, error) {
	results, err := s.manager.ListManagedDocumentsByKnowledgeBase(ctx, knowledgeBaseCode)
	if err != nil {
		return nil, fmt.Errorf("legacy list managed documents by knowledge base: %w", err)
	}
	return results, nil
}

func cloneIntPtr(value *int) *int {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}

// DefaultKnowledgeBaseVectorDBForTest 返回默认向量库配置。
func DefaultKnowledgeBaseVectorDBForTest() string {
	return defaultKnowledgeBaseVectorDB
}

// KnowledgeBaseCodePrefixForTest 返回知识库编码前缀。
func KnowledgeBaseCodePrefixForTest() string {
	return knowledgeBaseCodePrefix
}

type noopKnowledgeBaseOwnerGrantPort struct{}

type noopKnowledgeBasePermissionReader struct{}

func (noopKnowledgeBasePermissionReader) ListOperations(
	_ context.Context,
	_ string,
	_ string,
	knowledgeBaseCodes []string,
) (map[string]string, error) {
	result := make(map[string]string, len(knowledgeBaseCodes))
	for _, code := range knowledgeBaseCodes {
		result[code] = "owner"
	}
	return result, nil
}

func (noopKnowledgeBasePermissionReader) IsOfficialOrganizationMember(
	_ context.Context,
	_ string,
) (bool, error) {
	return true, nil
}

func (noopKnowledgeBaseOwnerGrantPort) GrantKnowledgeBaseOwner(
	context.Context,
	string,
	string,
	string,
	string,
) error {
	return nil
}

func (noopKnowledgeBaseOwnerGrantPort) DeleteKnowledgeBasePermissions(
	context.Context,
	string,
	string,
	string,
) error {
	return nil
}
