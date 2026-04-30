package rebuild

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	"magic/internal/constants"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/infrastructure/logging"
)

const (
	knowledgeAliasName          = constants.KnowledgeBaseCollectionName
	cleanupCandidatePatternHint = "all collections except magic_knowledge / magic_knowledge_active / magic_knowledge_shadow"
)

var (
	// ErrCleanupCollectionMetaReaderRequired 表示缺少 collection meta 读取依赖。
	ErrCleanupCollectionMetaReaderRequired = errors.New("cleanup collection meta reader is required")
	// ErrCleanupCoordinatorRequired 表示缺少 cleanup 协调器依赖。
	ErrCleanupCoordinatorRequired = errors.New("cleanup coordinator is required")
	// ErrCleanupCollectionRepositoryRequired 表示缺少集合仓储依赖。
	ErrCleanupCollectionRepositoryRequired = errors.New("cleanup collection repository is required")
	// ErrOfficialOrganizationMemberRequired 表示当前组织不允许执行运维操作。
	ErrOfficialOrganizationMemberRequired = errors.New("official organization member is required")
)

type cleanupCollectionMetaReader interface {
	GetCollectionMeta(context.Context) (sharedroute.CollectionMeta, error)
}

type cleanupCoordinator interface {
	GetCurrentRun(context.Context) (string, error)
	GetDualWriteState(context.Context) (*domainrebuild.VectorDualWriteState, error)
	ClearDualWriteState(context.Context, string) error
}

type cleanupCollectionRepository interface {
	GetAliasTarget(context.Context, string) (string, bool, error)
	ListCollections(context.Context) ([]string, error)
	GetCollectionInfo(context.Context, string) (*fragmodel.VectorCollectionInfo, error)
	DeleteCollection(context.Context, string) error
}

type officialOrganizationMemberChecker interface {
	IsOfficialOrganizationMember(ctx context.Context, organizationCode string) (bool, error)
}

// CleanupService 提供重建残留集合的收敛能力。
type CleanupService struct {
	metaReader      cleanupCollectionMetaReader
	coordinator     cleanupCoordinator
	collections     cleanupCollectionRepository
	officialChecker officialOrganizationMemberChecker
	logger          *logging.SugaredLogger
}

// NewCleanupService 创建残留集合清理服务。
func NewCleanupService(
	metaReader cleanupCollectionMetaReader,
	coordinator cleanupCoordinator,
	collections cleanupCollectionRepository,
	officialChecker officialOrganizationMemberChecker,
	logger *logging.SugaredLogger,
) *CleanupService {
	return &CleanupService{
		metaReader:      metaReader,
		coordinator:     coordinator,
		collections:     collections,
		officialChecker: officialChecker,
		logger:          logger,
	}
}

// Cleanup 生成并可选执行一次重建残留集合清理。
func (s *CleanupService) Cleanup(ctx context.Context, input *rebuilddto.CleanupInput) (*rebuilddto.CleanupResult, error) {
	if s == nil || s.metaReader == nil {
		return nil, ErrCleanupCollectionMetaReaderRequired
	}
	if s.coordinator == nil {
		return nil, ErrCleanupCoordinatorRequired
	}
	if s.collections == nil {
		return nil, ErrCleanupCollectionRepositoryRequired
	}

	if err := s.ensureOfficialOrganizationMember(ctx, input); err != nil {
		return nil, err
	}

	report, err := s.buildCleanupReport(ctx, input)
	if err != nil {
		return nil, err
	}
	if input != nil && input.Apply {
		if err := s.applyCleanup(ctx, report); err != nil {
			return nil, err
		}
	}
	return report, nil
}

func (s *CleanupService) ensureOfficialOrganizationMember(ctx context.Context, input *rebuilddto.CleanupInput) error {
	if s == nil || s.officialChecker == nil {
		return nil
	}
	if input == nil || strings.TrimSpace(input.OrganizationCode) == "" {
		return nil
	}
	ok, err := s.officialChecker.IsOfficialOrganizationMember(ctx, input.OrganizationCode)
	if err != nil {
		return fmt.Errorf("check official organization membership: %w", err)
	}
	if !ok {
		return ErrOfficialOrganizationMemberRequired
	}
	return nil
}

func (s *CleanupService) buildCleanupReport(ctx context.Context, input *rebuilddto.CleanupInput) (*rebuilddto.CleanupResult, error) {
	meta, err := s.metaReader.GetCollectionMeta(ctx)
	if err != nil {
		return nil, fmt.Errorf("load collection meta: %w", err)
	}
	aliasTarget, aliasExists, err := s.collections.GetAliasTarget(ctx, knowledgeAliasName)
	if err != nil {
		return nil, fmt.Errorf("load alias target: %w", err)
	}
	if !aliasExists {
		aliasTarget = ""
	}
	currentRunID, err := s.coordinator.GetCurrentRun(ctx)
	if err != nil {
		return nil, fmt.Errorf("load current run: %w", err)
	}
	dualWriteState, err := s.coordinator.GetDualWriteState(ctx)
	if err != nil {
		return nil, fmt.Errorf("load dual write state: %w", err)
	}

	report := &rebuilddto.CleanupResult{
		Apply:                   input != nil && input.Apply,
		ForceDeleteNonEmpty:     input != nil && input.ForceDeleteNonEmpty,
		CandidatePattern:        cleanupCandidatePatternHint,
		AliasName:               knowledgeAliasName,
		AliasTarget:             strings.TrimSpace(aliasTarget),
		MetaPhysicalCollection:  strings.TrimSpace(meta.PhysicalCollectionName),
		CurrentRunID:            strings.TrimSpace(currentRunID),
		DualWriteState:          dualWriteState,
		SafeToDeleteCollections: make([]rebuilddto.CleanupCollectionAudit, 0),
		KeptCollections:         make([]rebuilddto.CleanupCollectionAudit, 0),
		SkipReason:              make(map[string]string),
	}

	names, err := s.collections.ListCollections(ctx)
	if err != nil {
		return nil, fmt.Errorf("list collections: %w", err)
	}
	slices.Sort(names)
	report.TotalCollections = len(names)

	for _, name := range names {
		if !domainrebuild.IsCleanupCandidate(name) {
			continue
		}
		report.CandidateCollectionCount++
		audit, err := s.loadCollectionAudit(ctx, name)
		if err != nil {
			return nil, err
		}
		safe, reason := domainrebuild.DecideCleanupAction(
			audit.Name,
			audit.Points,
			report.AliasTarget,
			report.MetaPhysicalCollection,
			report.ForceDeleteNonEmpty,
		)
		if safe && report.Apply && !domainrebuild.CanApplyDeleteCollection(audit.Name) {
			safe = false
			reason = "apply only deletes collections prefixed with KNOWLEDGE"
		}
		if safe {
			report.SafeToDeleteCollections = append(report.SafeToDeleteCollections, audit)
			continue
		}
		report.KeptCollections = append(report.KeptCollections, audit)
		report.SkipReason[audit.Name] = reason
	}
	report.SafeToDeleteCount = len(report.SafeToDeleteCollections)
	report.KeptCount = len(report.KeptCollections)
	return report, nil
}

func (s *CleanupService) loadCollectionAudit(ctx context.Context, name string) (rebuilddto.CleanupCollectionAudit, error) {
	info, err := s.collections.GetCollectionInfo(ctx, name)
	if err != nil {
		return rebuilddto.CleanupCollectionAudit{}, fmt.Errorf("load collection info for %s: %w", name, err)
	}
	points := int64(0)
	if info != nil {
		points = info.Points
	}
	return rebuilddto.CleanupCollectionAudit{
		Name:   name,
		Points: points,
	}, nil
}

func (s *CleanupService) applyCleanup(ctx context.Context, report *rebuilddto.CleanupResult) error {
	if report == nil {
		return nil
	}
	for _, candidate := range report.SafeToDeleteCollections {
		if err := s.collections.DeleteCollection(ctx, candidate.Name); err != nil {
			return fmt.Errorf("delete collection %s: %w", candidate.Name, err)
		}
		if s.logger != nil {
			s.logger.InfoContext(ctx, "Deleted rebuild cleanup collection", "collection", candidate.Name)
		}
	}
	if domainrebuild.ShouldDeleteDualWriteState(report.CurrentRunID, report.DualWriteState) {
		if err := s.coordinator.ClearDualWriteState(ctx, report.DualWriteState.RunID); err != nil {
			return fmt.Errorf("clear stale dualwrite state: %w", err)
		}
		report.DeletedDualwriteState = true
	}
	return nil
}
