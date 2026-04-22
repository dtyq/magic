package fragdomain

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
)

const createdAtTSKey = "created_at_ts"

var errDuplicateNewFragmentIdentity = errors.New("duplicate new fragment identity")

// FragmentResyncPlan 描述重同步时片段的变化集。
type FragmentResyncPlan struct {
	Changed         []*fragmodel.KnowledgeBaseFragment
	Added           []*fragmodel.KnowledgeBaseFragment
	Deleted         []*fragmodel.KnowledgeBaseFragment
	Unchanged       []*fragmodel.KnowledgeBaseFragment
	RekeyedPointIDs []string
}

// BuildFragmentResyncPlan 根据旧片段和新片段生成增量重同步计划。
func BuildFragmentResyncPlan(
	oldFragments []*fragmodel.KnowledgeBaseFragment,
	newFragments []*fragmodel.KnowledgeBaseFragment,
	forceBackfill bool,
) (FragmentResyncPlan, error) {
	oldByIdentity := make(map[string][]*fragmodel.KnowledgeBaseFragment, len(oldFragments))
	for _, fragment := range oldFragments {
		identityKey := BuildFragmentIdentityKey(fragment)
		oldByIdentity[identityKey] = append(oldByIdentity[identityKey], fragment)
	}

	newByIdentity := make(map[string]*fragmodel.KnowledgeBaseFragment, len(newFragments))
	plan := FragmentResyncPlan{
		Changed:   make([]*fragmodel.KnowledgeBaseFragment, 0),
		Added:     make([]*fragmodel.KnowledgeBaseFragment, 0),
		Deleted:   make([]*fragmodel.KnowledgeBaseFragment, 0),
		Unchanged: make([]*fragmodel.KnowledgeBaseFragment, 0),
	}
	deletedIDs := make(map[int64]struct{})

	for _, nextFragment := range newFragments {
		identityKey := BuildFragmentIdentityKey(nextFragment)
		if _, exists := newByIdentity[identityKey]; exists {
			return FragmentResyncPlan{}, fmt.Errorf("%w: %s", errDuplicateNewFragmentIdentity, identityKey)
		}
		newByIdentity[identityKey] = nextFragment

		currentGroup := oldByIdentity[identityKey]
		if len(currentGroup) == 0 {
			plan.Added = append(plan.Added, nextFragment)
			continue
		}
		currentFragment, redundantFragments := selectExistingFragmentsForResync(currentGroup, nextFragment)
		for _, fragment := range redundantFragments {
			appendDeletedFragment(&plan, deletedIDs, fragment)
		}
		oldByIdentity[identityKey] = []*fragmodel.KnowledgeBaseFragment{currentFragment}

		unchanged, err := FragmentsAreUnchanged(currentFragment, nextFragment)
		if err != nil {
			return FragmentResyncPlan{}, fmt.Errorf("compare fragment %q: %w", identityKey, err)
		}
		if unchanged {
			if forceBackfill {
				plan.Unchanged = append(plan.Unchanged, MergeFragmentForResync(currentFragment, nextFragment))
			}
			continue
		}

		updatedFragment := MergeFragmentForResync(currentFragment, nextFragment)
		plan.Changed = append(plan.Changed, updatedFragment)
		if currentFragment.PointID != "" && currentFragment.PointID != updatedFragment.PointID {
			plan.RekeyedPointIDs = append(plan.RekeyedPointIDs, currentFragment.PointID)
		}
	}

	for identityKey, fragments := range oldByIdentity {
		if _, exists := newByIdentity[identityKey]; exists {
			continue
		}
		for _, fragment := range fragments {
			appendDeletedFragment(&plan, deletedIDs, fragment)
		}
	}

	slices.Sort(plan.RekeyedPointIDs)
	return plan, nil
}

// ApplyMissingPointBackfill 将缺失 point 的 unchanged 片段转入 changed 集合。
func ApplyMissingPointBackfill(
	plan FragmentResyncPlan,
	existingPointIDs map[string]struct{},
) FragmentResyncPlan {
	if len(plan.Unchanged) == 0 {
		return plan
	}
	missing := make([]*fragmodel.KnowledgeBaseFragment, 0, len(plan.Unchanged))
	for _, fragment := range plan.Unchanged {
		if fragment == nil {
			continue
		}
		if strings.TrimSpace(fragment.PointID) == "" {
			missing = append(missing, fragment)
			continue
		}
		if _, exists := existingPointIDs[fragment.PointID]; exists {
			continue
		}
		missing = append(missing, fragment)
	}
	plan.Changed = append(plan.Changed, missing...)
	return plan
}

// BuildFragmentIdentityKey 生成片段身份键。
func BuildFragmentIdentityKey(fragment *fragmodel.KnowledgeBaseFragment) string {
	if fragment == nil {
		return buildChunkIdentityKey("", 0)
	}

	contentHash := strings.TrimSpace(fragment.ContentHash)
	if contentHash == "" {
		contentHash = buildContentHash(fragment.Content)
	}
	return buildChunkIdentityKey(contentHash, fragment.ChunkIndex)
}

// FragmentsAreUnchanged 判断两个片段是否可视为同一同步结果。
func FragmentsAreUnchanged(currentFragment, nextFragment *fragmodel.KnowledgeBaseFragment) (bool, error) {
	if currentFragment == nil || nextFragment == nil {
		return false, nil
	}
	if currentFragment.PointID != nextFragment.PointID {
		return false, nil
	}
	if currentFragment.SyncStatus != sharedentity.SyncStatusSynced {
		return false, nil
	}

	currentFingerprint, err := BuildFragmentSyncFingerprint(currentFragment)
	if err != nil {
		return false, err
	}
	nextFingerprint, err := BuildFragmentSyncFingerprint(nextFragment)
	if err != nil {
		return false, err
	}
	return currentFingerprint == nextFingerprint, nil
}

// MergeFragmentForResync 合并旧片段与新片段，生成待更新的持久化实体。
func MergeFragmentForResync(currentFragment, nextFragment *fragmodel.KnowledgeBaseFragment) *fragmodel.KnowledgeBaseFragment {
	updated := *currentFragment
	updated.OrganizationCode = nextFragment.OrganizationCode
	updated.KnowledgeCode = nextFragment.KnowledgeCode
	updated.DocumentCode = nextFragment.DocumentCode
	updated.DocumentName = nextFragment.DocumentName
	updated.DocumentType = nextFragment.DocumentType
	updated.Content = nextFragment.Content
	updated.Metadata = fragmetadata.CloneMetadata(nextFragment.Metadata)
	updated.SyncStatus = sharedentity.SyncStatusPending
	updated.SyncStatusMessage = ""
	updated.PointID = nextFragment.PointID
	updated.Vector = nil
	updated.WordCount = nextFragment.WordCount
	updated.ChunkIndex = nextFragment.ChunkIndex
	updated.ContentHash = nextFragment.ContentHash
	updated.SplitVersion = nextFragment.SplitVersion
	updated.SectionPath = nextFragment.SectionPath
	updated.SectionTitle = nextFragment.SectionTitle
	updated.SectionLevel = nextFragment.SectionLevel
	updated.UpdatedUID = nextFragment.UpdatedUID
	return &updated
}

// BuildFragmentSyncFingerprint 构建片段同步指纹，用于判断是否需要重新向量化。
func BuildFragmentSyncFingerprint(fragment *fragmodel.KnowledgeBaseFragment) (string, error) {
	if fragment == nil {
		return "", nil
	}

	cloned := *fragment
	cloned.Metadata = fragmetadata.CloneMetadata(fragment.Metadata)
	payload := fragmetadata.BuildFragmentPayload(&cloned)
	payloadMetadata := map[string]any{}
	if payload != nil {
		payloadMetadata = fragmetadata.CloneMetadata(payload.Metadata)
	}
	delete(payloadMetadata, createdAtTSKey)
	delete(payloadMetadata, fragmetadata.MetadataFallbackFlagsKey)

	fingerprint := struct {
		Content      string         `json:"content"`
		SectionPath  string         `json:"section_path"`
		SectionTitle string         `json:"section_title"`
		DocumentName string         `json:"document_name"`
		DocumentType int            `json:"document_type"`
		SplitVersion string         `json:"split_version"`
		Metadata     map[string]any `json:"metadata"`
	}{
		Content:      cloned.Content,
		SectionPath:  cloned.SectionPath,
		SectionTitle: cloned.SectionTitle,
		DocumentName: cloned.DocumentName,
		DocumentType: cloned.DocumentType,
		SplitVersion: cloned.SplitVersion,
		Metadata:     payloadMetadata,
	}

	data, err := json.Marshal(fingerprint)
	if err != nil {
		return "", fmt.Errorf("marshal fingerprint: %w", err)
	}
	return string(data), nil
}

func selectExistingFragmentsForResync(
	existing []*fragmodel.KnowledgeBaseFragment,
	nextFragment *fragmodel.KnowledgeBaseFragment,
) (*fragmodel.KnowledgeBaseFragment, []*fragmodel.KnowledgeBaseFragment) {
	if len(existing) == 0 {
		return nil, nil
	}

	candidates := slices.Clone(existing)
	slices.SortStableFunc(candidates, func(left, right *fragmodel.KnowledgeBaseFragment) int {
		if order := preferBool(left.PointID == nextFragment.PointID, right.PointID == nextFragment.PointID); order != 0 {
			return order
		}
		if order := preferBool(left.SyncStatus == sharedentity.SyncStatusSynced, right.SyncStatus == sharedentity.SyncStatusSynced); order != 0 {
			return order
		}
		if order := right.UpdatedAt.Compare(left.UpdatedAt); order != 0 {
			return order
		}
		switch {
		case left.ID > right.ID:
			return -1
		case left.ID < right.ID:
			return 1
		default:
			return 0
		}
	})

	return candidates[0], candidates[1:]
}

func appendDeletedFragment(plan *FragmentResyncPlan, deletedIDs map[int64]struct{}, fragment *fragmodel.KnowledgeBaseFragment) {
	if plan == nil || fragment == nil {
		return
	}
	if fragment.ID != 0 {
		if _, exists := deletedIDs[fragment.ID]; exists {
			return
		}
		deletedIDs[fragment.ID] = struct{}{}
	}
	plan.Deleted = append(plan.Deleted, fragment)
}

func preferBool(left, right bool) int {
	switch {
	case left == right:
		return 0
	case left:
		return -1
	default:
		return 1
	}
}

func buildChunkIdentityKey(contentHash string, chunkIndex int) string {
	return fmt.Sprintf("%s:%d", strings.TrimSpace(contentHash), chunkIndex)
}

func buildContentHash(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}
