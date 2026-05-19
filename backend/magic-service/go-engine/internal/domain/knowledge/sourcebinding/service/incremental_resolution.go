package sourcebinding

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"strings"
	"time"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
)

var errIncrementalResolutionServiceRequired = errors.New("incremental resolution service dependencies are required")

var errIncrementalResolutionLengthMismatch = errors.New("incremental resolution returned mismatched source item count")

var errIncrementalResolutionNilSourceItem = errors.New("incremental resolution returned nil source item")

// IncrementalSourceItemRepository 定义增量 binding 解析所需的来源项批量写能力。
type IncrementalSourceItemRepository interface {
	UpsertSourceItems(ctx context.Context, items []sourcebindingentity.SourceItem) ([]*sourcebindingentity.SourceItem, error)
}

// IncrementalResolveInput 表示一次 binding 增量解析请求。
type IncrementalResolveInput struct {
	OrganizationCode    string
	KnowledgeBaseUserID string
	KnowledgeBaseOwner  string
	FallbackUserID      string
	Bindings            []sourcebindingentity.Binding
	MaxDocuments        int
}

// IncrementalResolvedItem 表示单个来源项与文档物料的增量解析结果。
type IncrementalResolvedItem struct {
	ResolvedUserID string
	ResolveReason  string
	SourceItem     *sourcebindingentity.SourceItem
	Document       ResolvedDocument
}

// IncrementalResolvedBinding 表示单个 binding 的完整增量解析结果。
type IncrementalResolvedBinding struct {
	Binding       sourcebindingentity.Binding
	ResolvedItems []IncrementalResolvedItem
}

type pendingIncrementalResolvedBinding struct {
	binding        sourcebindingentity.Binding
	resolvedUserID string
	documents      []ResolvedDocument
}

type pendingIncrementalSourceItem struct {
	bindingIndex  int
	documentIndex int
	item          sourcebindingentity.SourceItem
}

// IncrementalResolutionService 收敛 binding 增量更新前的来源项解析与批量写入。
type IncrementalResolutionService struct {
	repo     IncrementalSourceItemRepository
	resolver DocumentResolver
	now      func() time.Time
}

// NewIncrementalResolutionService 创建增量解析领域服务。
func NewIncrementalResolutionService(
	repo IncrementalSourceItemRepository,
	resolver DocumentResolver,
	now func() time.Time,
) *IncrementalResolutionService {
	if now == nil {
		now = time.Now
	}
	return &IncrementalResolutionService{
		repo:     repo,
		resolver: resolver,
		now:      now,
	}
}

// Resolve 解析 binding 对应的文档物料，并批量 upsert 来源项。
func (s *IncrementalResolutionService) Resolve(
	ctx context.Context,
	input IncrementalResolveInput,
) ([]IncrementalResolvedBinding, error) {
	if s == nil || s.repo == nil || s.resolver == nil {
		return nil, errIncrementalResolutionServiceRequired
	}

	pendingBindings, pendingItems, err := s.resolvePendingBindings(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("resolve pending bindings: %w", err)
	}
	if len(pendingItems) == 0 {
		return buildResolvedBindingsWithoutItems(pendingBindings), nil
	}

	sourceItems, err := s.repo.UpsertSourceItems(ctx, collectPendingSourceItems(pendingItems))
	if err != nil {
		return nil, fmt.Errorf("upsert source items: %w", err)
	}
	if len(sourceItems) != len(pendingItems) {
		return nil, fmt.Errorf(
			"%w: got %d want %d",
			errIncrementalResolutionLengthMismatch,
			len(sourceItems),
			len(pendingItems),
		)
	}

	resolvedBindings := buildResolvedBindingsWithoutItems(pendingBindings)
	for idx, sourceItem := range sourceItems {
		if sourceItem == nil {
			return nil, fmt.Errorf("%w: index=%d", errIncrementalResolutionNilSourceItem, idx)
		}
		pending := pendingItems[idx]
		resolvedBindings[pending.bindingIndex].ResolvedItems = append(
			resolvedBindings[pending.bindingIndex].ResolvedItems,
			IncrementalResolvedItem{
				ResolvedUserID: pendingBindings[pending.bindingIndex].resolvedUserID,
				ResolveReason:  pendingBindings[pending.bindingIndex].documents[pending.documentIndex].ResolveReason,
				SourceItem:     cloneIncrementalSourceItem(sourceItem),
				Document:       cloneResolvedDocument(pendingBindings[pending.bindingIndex].documents[pending.documentIndex]),
			},
		)
	}

	return resolvedBindings, nil
}

func (s *IncrementalResolutionService) resolvePendingBindings(
	ctx context.Context,
	input IncrementalResolveInput,
) ([]pendingIncrementalResolvedBinding, []pendingIncrementalSourceItem, error) {
	pendingBindings := make([]pendingIncrementalResolvedBinding, 0, len(input.Bindings))
	pendingItems := make([]pendingIncrementalSourceItem, 0)
	remaining := normalizeMaterializationDocumentLimit(input.MaxDocuments)
	for _, rawBinding := range input.Bindings {
		binding := sourcebindingentity.NormalizeBinding(rawBinding)
		pending := pendingIncrementalResolvedBinding{binding: binding}
		if binding.Enabled && remaining > 0 {
			resolvedUserID, documents, err := s.resolveBindingDocumentsWithUser(ctx, input, binding, remaining)
			if err != nil {
				return nil, nil, fmt.Errorf("resolve source binding documents: %w", err)
			}
			pending.resolvedUserID = resolvedUserID
			pending.documents = documents
			for docIdx, document := range documents {
				pendingItems = append(pendingItems, pendingIncrementalSourceItem{
					bindingIndex:  len(pendingBindings),
					documentIndex: docIdx,
					item:          buildIncrementalSourceItem(input.OrganizationCode, binding, document, s.now()),
				})
			}
			remaining -= len(documents)
		}
		pendingBindings = append(pendingBindings, pending)
	}
	return pendingBindings, pendingItems, nil
}

func (s *IncrementalResolutionService) resolveBindingDocumentsWithUser(
	ctx context.Context,
	input IncrementalResolveInput,
	binding sourcebindingentity.Binding,
	maxDocuments int,
) (string, []ResolvedDocument, error) {
	candidates := incrementalCandidateUserIDs(
		binding,
		input.KnowledgeBaseUserID,
		input.KnowledgeBaseOwner,
		input.FallbackUserID,
	)
	for idx, candidateUserID := range candidates {
		items, err := s.resolver.ResolveBindingDocuments(
			ctx,
			binding,
			input.OrganizationCode,
			candidateUserID,
			maxDocuments,
		)
		if err == nil {
			return candidateUserID, items, nil
		}
		if binding.Provider != sourcebindingentity.ProviderTeamshare ||
			idx == len(candidates)-1 ||
			!ShouldRetryResolve(err) {
			return candidateUserID, nil, fmt.Errorf("resolve documents with user %s: %w", candidateUserID, err)
		}
	}
	return "", nil, nil
}

func incrementalCandidateUserIDs(
	binding sourcebindingentity.Binding,
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

func buildIncrementalSourceItem(
	organizationCode string,
	binding sourcebindingentity.Binding,
	document ResolvedDocument,
	resolvedAt time.Time,
) sourcebindingentity.SourceItem {
	return sourcebindingentity.SourceItem{
		OrganizationCode: strings.TrimSpace(organizationCode),
		Provider:         binding.Provider,
		RootType:         binding.RootType,
		RootRef:          binding.RootRef,
		GroupRef:         document.GroupRef,
		ItemType:         sourcebindingentity.RootTypeFile,
		ItemRef:          document.ItemRef,
		DisplayName:      document.Name,
		Extension:        document.Extension,
		SnapshotMeta:     cloneObjectMap(document.SnapshotMeta),
		LastResolvedAt:   &resolvedAt,
	}
}

func collectPendingSourceItems(pendingItems []pendingIncrementalSourceItem) []sourcebindingentity.SourceItem {
	items := make([]sourcebindingentity.SourceItem, 0, len(pendingItems))
	for _, pending := range pendingItems {
		items = append(items, pending.item)
	}
	return items
}

func buildResolvedBindingsWithoutItems(
	pendingBindings []pendingIncrementalResolvedBinding,
) []IncrementalResolvedBinding {
	resolved := make([]IncrementalResolvedBinding, 0, len(pendingBindings))
	for _, pending := range pendingBindings {
		resolved = append(resolved, IncrementalResolvedBinding{
			Binding:       pending.binding,
			ResolvedItems: make([]IncrementalResolvedItem, 0, len(pending.documents)),
		})
	}
	return resolved
}

func cloneIncrementalSourceItem(item *sourcebindingentity.SourceItem) *sourcebindingentity.SourceItem {
	if item == nil {
		return nil
	}
	cloned := *item
	cloned.SnapshotMeta = cloneObjectMap(item.SnapshotMeta)
	if item.LastResolvedAt != nil {
		resolvedAt := *item.LastResolvedAt
		cloned.LastResolvedAt = &resolvedAt
	}
	return &cloned
}

func cloneResolvedDocument(document ResolvedDocument) ResolvedDocument {
	cloned := document
	cloned.SnapshotMeta = cloneObjectMap(document.SnapshotMeta)
	return cloned
}

func cloneObjectMap(input map[string]any) map[string]any {
	if len(input) == 0 {
		return nil
	}
	return maps.Clone(input)
}
