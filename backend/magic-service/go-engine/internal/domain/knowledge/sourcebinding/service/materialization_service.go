package sourcebinding

import (
	"context"
	"fmt"
	"maps"
	"strings"
	"time"
)

const materializationCandidateUserCapacity = 4

// ResolvedDocument 表示 binding 解析后可落库的文档物料。
type ResolvedDocument struct {
	Name          string
	DocumentFile  any
	DocumentType  int
	ItemRef       string
	GroupRef      string
	Extension     string
	ResolveReason string
	AutoAdded     bool
	SnapshotMeta  map[string]any
}

// CreateManagedDocumentInput 描述创建托管文档的最小输入。
type CreateManagedDocumentInput struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	SourceBindingID   int64
	SourceItemID      int64
	Name              string
	DocType           int
	DocumentFile      any
	ThirdPlatformType string
	ThirdFileID       string
	AutoAdded         bool
	AutoSync          bool
}

// ManagedDocument 表示创建出的托管文档结果。
type ManagedDocument struct {
	Code string
}

// SyncRequest 表示需要触发的文档同步请求。
type SyncRequest struct {
	OrganizationCode  string
	KnowledgeBaseCode string
	Code              string
	UserID            string
}

// MaterializationInput 表示一次来源绑定文档物化的领域输入。
type MaterializationInput struct {
	KnowledgeBaseCode   string
	OrganizationCode    string
	KnowledgeBaseUserID string
	KnowledgeBaseOwner  string
	FallbackUserID      string
	Bindings            []Binding
	ScheduleSync        bool
}

// DocumentResolver 定义 binding -> 文档物料的解析能力。
type DocumentResolver interface {
	ResolveBindingDocuments(
		ctx context.Context,
		binding Binding,
		organizationCode string,
		userID string,
	) ([]ResolvedDocument, error)
}

// SourceItemRepository 定义物化过程需要的来源项持久化能力。
type SourceItemRepository interface {
	UpsertSourceItem(ctx context.Context, item SourceItem) (*SourceItem, error)
	ReplaceBindingItems(ctx context.Context, bindingID int64, items []BindingItem) error
}

// ManagedDocumentManager 定义物化过程需要的托管文档编排能力。
type ManagedDocumentManager interface {
	CreateManagedDocument(ctx context.Context, input CreateManagedDocumentInput) (*ManagedDocument, error)
	DestroyManagedDocument(
		ctx context.Context,
		code string,
		knowledgeBaseCode string,
	) error
	ScheduleManagedDocumentSync(ctx context.Context, input SyncRequest)
}

// MaterializationService 收敛 source binding 文档物化生命周期。
type MaterializationService struct {
	repo            SourceItemRepository
	resolver        DocumentResolver
	documentManager ManagedDocumentManager
	now             func() time.Time
}

// NewMaterializationService 创建来源绑定物化领域服务。
func NewMaterializationService(
	repo SourceItemRepository,
	resolver DocumentResolver,
	documentManager ManagedDocumentManager,
	now func() time.Time,
) *MaterializationService {
	if now == nil {
		now = time.Now
	}
	return &MaterializationService{
		repo:            repo,
		resolver:        resolver,
		documentManager: documentManager,
		now:             now,
	}
}

// Preflight 仅校验 binding 当前是否能解析出文档物料。
func (s *MaterializationService) Preflight(ctx context.Context, input MaterializationInput) error {
	for _, binding := range input.Bindings {
		if !binding.Enabled {
			continue
		}
		if _, _, err := s.resolveBindingDocumentsWithUser(ctx, input, binding); err != nil {
			return fmt.Errorf("resolve source binding documents: %w", err)
		}
	}
	return nil
}

// Materialize 执行 binding -> source item -> managed document 的完整物化流程。
func (s *MaterializationService) Materialize(ctx context.Context, input MaterializationInput) (int, error) {
	createdDocuments := make([]*ManagedDocument, 0)
	pendingSyncs := make([]SyncRequest, 0)

	for _, binding := range input.Bindings {
		if !binding.Enabled {
			continue
		}

		bindingCreated, bindingSyncs, err := s.materializeBinding(ctx, input, binding)
		if err != nil {
			return 0, s.rollbackMaterializedDocuments(
				ctx,
				input.KnowledgeBaseCode,
				createdDocuments,
				err,
			)
		}

		createdDocuments = append(createdDocuments, bindingCreated...)
		pendingSyncs = append(pendingSyncs, bindingSyncs...)
	}

	if input.ScheduleSync {
		for _, request := range pendingSyncs {
			s.documentManager.ScheduleManagedDocumentSync(ctx, request)
		}
	}

	return len(createdDocuments), nil
}

func (s *MaterializationService) materializeBinding(
	ctx context.Context,
	input MaterializationInput,
	binding Binding,
) ([]*ManagedDocument, []SyncRequest, error) {
	resolvedUserID, items, err := s.resolveBindingDocumentsWithUser(ctx, input, binding)
	if err != nil {
		return nil, nil, fmt.Errorf("resolve source binding documents: %w", err)
	}

	createdDocuments := make([]*ManagedDocument, 0, len(items))
	pendingSyncs := make([]SyncRequest, 0, len(items))
	bindingItems := make([]BindingItem, 0, len(items))

	for _, item := range items {
		createdDocument, bindingItem, syncRequest, itemErr := s.materializeResolvedDocument(
			ctx,
			input,
			binding,
			resolvedUserID,
			item,
		)
		if itemErr != nil {
			return createdDocuments, pendingSyncs, itemErr
		}

		bindingItems = append(bindingItems, bindingItem)
		createdDocuments = append(createdDocuments, createdDocument)
		pendingSyncs = append(pendingSyncs, syncRequest)
	}

	if err := s.repo.ReplaceBindingItems(ctx, binding.ID, bindingItems); err != nil {
		return createdDocuments, pendingSyncs, fmt.Errorf("replace source binding items: %w", err)
	}
	return createdDocuments, pendingSyncs, nil
}

func (s *MaterializationService) materializeResolvedDocument(
	ctx context.Context,
	input MaterializationInput,
	binding Binding,
	resolvedUserID string,
	item ResolvedDocument,
) (*ManagedDocument, BindingItem, SyncRequest, error) {
	resolvedAt := s.now()
	sourceItem, err := s.repo.UpsertSourceItem(ctx, SourceItem{
		OrganizationCode: strings.TrimSpace(input.OrganizationCode),
		Provider:         binding.Provider,
		RootType:         binding.RootType,
		RootRef:          binding.RootRef,
		GroupRef:         item.GroupRef,
		ItemType:         RootTypeFile,
		ItemRef:          item.ItemRef,
		DisplayName:      item.Name,
		Extension:        item.Extension,
		SnapshotMeta:     cloneMaterializationMap(item.SnapshotMeta),
		LastResolvedAt:   &resolvedAt,
	})
	if err != nil {
		return nil, BindingItem{}, SyncRequest{}, fmt.Errorf("upsert source item: %w", err)
	}

	createdDocument, err := s.documentManager.CreateManagedDocument(ctx, CreateManagedDocumentInput{
		OrganizationCode:  input.OrganizationCode,
		UserID:            resolvedUserID,
		KnowledgeBaseCode: input.KnowledgeBaseCode,
		SourceBindingID:   binding.ID,
		SourceItemID:      sourceItem.ID,
		Name:              item.Name,
		DocType:           item.DocumentType,
		DocumentFile:      item.DocumentFile,
		ThirdPlatformType: materializedThirdPlatformType(binding.Provider),
		ThirdFileID:       strings.TrimSpace(sourceItem.ItemRef),
		AutoAdded:         item.AutoAdded,
		AutoSync:          false,
	})
	if err != nil {
		return nil, BindingItem{}, SyncRequest{}, fmt.Errorf("failed to create knowledge base document: %w", err)
	}

	return createdDocument, BindingItem{
			BindingID:      binding.ID,
			SourceItemID:   sourceItem.ID,
			ResolveReason:  item.ResolveReason,
			LastResolvedAt: &resolvedAt,
		}, SyncRequest{
			OrganizationCode:  input.OrganizationCode,
			KnowledgeBaseCode: input.KnowledgeBaseCode,
			Code:              createdDocument.Code,
			UserID:            resolvedUserID,
		}, nil
}

// ShouldRetryResolve 判断当前错误是否应尝试切换候选操作者重试。
func ShouldRetryResolve(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "没有文件权限") || strings.Contains(message, "申请文件权限")
}

func (s *MaterializationService) resolveBindingDocumentsWithUser(
	ctx context.Context,
	input MaterializationInput,
	binding Binding,
) (string, []ResolvedDocument, error) {
	candidateUserIDs := materializeBindingCandidateUserIDs(binding, input.KnowledgeBaseUserID, input.KnowledgeBaseOwner, input.FallbackUserID)
	for idx, candidateUserID := range candidateUserIDs {
		items, err := s.resolver.ResolveBindingDocuments(ctx, binding, input.OrganizationCode, candidateUserID)
		if err == nil {
			return candidateUserID, items, nil
		}
		if binding.Provider != ProviderTeamshare || idx == len(candidateUserIDs)-1 || !ShouldRetryResolve(err) {
			return candidateUserID, nil, fmt.Errorf("resolve documents with user %s: %w", candidateUserID, err)
		}
	}
	return "", nil, nil
}

func materializeBindingCandidateUserIDs(
	binding Binding,
	knowledgeBaseUserID string,
	knowledgeBaseOwner string,
	fallbackUserID string,
) []string {
	candidates := make([]string, 0, materializationCandidateUserCapacity)
	seen := make(map[string]struct{}, materializationCandidateUserCapacity)
	appendCandidate := func(userID string) {
		userID = strings.TrimSpace(userID)
		if userID == "" {
			return
		}
		if _, exists := seen[userID]; exists {
			return
		}
		seen[userID] = struct{}{}
		candidates = append(candidates, userID)
	}

	appendCandidate(BindingUserID(binding))
	appendCandidate(knowledgeBaseUserID)
	appendCandidate(knowledgeBaseOwner)
	appendCandidate(fallbackUserID)

	if len(candidates) == 0 {
		return []string{""}
	}
	return candidates
}

func (s *MaterializationService) rollbackMaterializedDocuments(
	ctx context.Context,
	knowledgeBaseCode string,
	docs []*ManagedDocument,
	cause error,
) error {
	for idx := len(docs) - 1; idx >= 0; idx-- {
		doc := docs[idx]
		if doc == nil || strings.TrimSpace(doc.Code) == "" {
			continue
		}
		_ = s.documentManager.DestroyManagedDocument(ctx, doc.Code, knowledgeBaseCode)
	}
	return cause
}

func cloneMaterializationMap(input map[string]any) map[string]any {
	if len(input) == 0 {
		return map[string]any{}
	}
	output := make(map[string]any, len(input))
	maps.Copy(output, input)
	return output
}

func materializedThirdPlatformType(provider string) string {
	switch strings.TrimSpace(provider) {
	case "", ProviderLocalUpload, ProviderProject:
		return ""
	default:
		return strings.ToLower(strings.TrimSpace(provider))
	}
}
