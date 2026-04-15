package rebuild_test

import (
	"context"
	"errors"
	"testing"

	rebuildapp "magic/internal/application/knowledge/rebuild"
	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	"magic/internal/infrastructure/logging"
)

type cleanupMetaReaderStub struct {
	meta domainrebuild.CollectionMeta
	err  error
}

func (s cleanupMetaReaderStub) GetCollectionMeta(context.Context) (domainrebuild.CollectionMeta, error) {
	if s.err != nil {
		return domainrebuild.CollectionMeta{}, s.err
	}
	return s.meta, nil
}

type cleanupCoordinatorStub struct {
	currentRunID        string
	dualWriteState      *domainrebuild.VectorDualWriteState
	err                 error
	clearedDualWriteRun string
}

func (s *cleanupCoordinatorStub) GetCurrentRun(context.Context) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	return s.currentRunID, nil
}

func (s *cleanupCoordinatorStub) GetDualWriteState(context.Context) (*domainrebuild.VectorDualWriteState, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.dualWriteState, nil
}

func (s *cleanupCoordinatorStub) ClearDualWriteState(_ context.Context, runID string) error {
	if s.err != nil {
		return s.err
	}
	s.clearedDualWriteRun = runID
	return nil
}

type cleanupCollectionRepoStub struct {
	aliasTarget map[string]string
	info        map[string]*fragmodel.VectorCollectionInfo
	deleted     []string
	err         error
}

func (s *cleanupCollectionRepoStub) GetAliasTarget(_ context.Context, alias string) (string, bool, error) {
	if s.err != nil {
		return "", false, s.err
	}
	target, ok := s.aliasTarget[alias]
	return target, ok, nil
}

func (s *cleanupCollectionRepoStub) ListCollections(context.Context) ([]string, error) {
	if s.err != nil {
		return nil, s.err
	}
	names := make([]string, 0, len(s.info))
	for name := range s.info {
		names = append(names, name)
	}
	return names, nil
}

func (s *cleanupCollectionRepoStub) GetCollectionInfo(_ context.Context, name string) (*fragmodel.VectorCollectionInfo, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.info[name], nil
}

func (s *cleanupCollectionRepoStub) DeleteCollection(_ context.Context, name string) error {
	if s.err != nil {
		return s.err
	}
	s.deleted = append(s.deleted, name)
	delete(s.info, name)
	return nil
}

type cleanupOfficialCheckerStub struct {
	official bool
	err      error
}

func (s cleanupOfficialCheckerStub) IsOfficialOrganizationMember(context.Context, string) (bool, error) {
	if s.err != nil {
		return false, s.err
	}
	return s.official, nil
}

func TestCleanupServiceDryRunReport(t *testing.T) {
	t.Parallel()

	service := rebuildapp.NewCleanupService(
		cleanupMetaReaderStub{meta: domainrebuild.CollectionMeta{PhysicalCollectionName: "magic_knowledge_active"}},
		&cleanupCoordinatorStub{
			dualWriteState: &domainrebuild.VectorDualWriteState{RunID: "run-stale", Enabled: false},
		},
		&cleanupCollectionRepoStub{
			aliasTarget: map[string]string{
				"magic_knowledge": "magic_knowledge_active",
			},
			info: map[string]*fragmodel.VectorCollectionInfo{
				"magic_knowledge":           {Name: "magic_knowledge", Points: 10},
				"magic_knowledge_shadow_r1": {Name: "magic_knowledge_shadow_r1", Points: 0},
				"magic_knowledge_shadow_r2": {Name: "magic_knowledge_shadow_r2", Points: 2},
				"magic_knowledge_r_r1":      {Name: "magic_knowledge_r_r1", Points: 0},
				"magic_knowledge_active":    {Name: "magic_knowledge_active", Points: 3},
				"other_collection":          {Name: "other_collection", Points: 1},
			},
		},
		cleanupOfficialCheckerStub{official: true},
		logging.New(),
	)

	result, err := service.Cleanup(context.Background(), &rebuilddto.CleanupInput{
		OrganizationCode: "ORG-1",
		Apply:            false,
	})
	if err != nil {
		t.Fatalf("Cleanup() error = %v", err)
	}
	if result.Apply {
		t.Fatal("expected dry-run apply=false")
	}
	if result.ForceDeleteNonEmpty {
		t.Fatal("expected force_delete_non_empty=false")
	}
	if result.TotalCollections != 6 {
		t.Fatalf("expected total_collections=6, got %d", result.TotalCollections)
	}
	if result.CandidateCollectionCount != 4 {
		t.Fatalf("expected candidate_collection_count=4, got %d", result.CandidateCollectionCount)
	}
	if result.SafeToDeleteCount != 2 || len(result.SafeToDeleteCollections) != 2 {
		t.Fatalf("unexpected safe collection count/result: %+v", result)
	}
	if result.KeptCount != 2 || len(result.KeptCollections) != 2 {
		t.Fatalf("unexpected kept collection count/result: %+v", result)
	}
	if _, ok := result.SkipReason["magic_knowledge_shadow_r2"]; !ok {
		t.Fatalf("expected skip reason for non-empty collection, got %+v", result.SkipReason)
	}
	if _, ok := result.SkipReason["other_collection"]; !ok {
		t.Fatalf("expected non-whitelist collection kept in report, got %+v", result.SkipReason)
	}
	if result.DeletedDualwriteState {
		t.Fatal("dry-run should not delete dualwrite state")
	}
}

func TestCleanupServiceForceDeleteNonEmpty(t *testing.T) {
	t.Parallel()

	service := rebuildapp.NewCleanupService(
		cleanupMetaReaderStub{meta: domainrebuild.CollectionMeta{PhysicalCollectionName: "magic_knowledge_active"}},
		&cleanupCoordinatorStub{},
		&cleanupCollectionRepoStub{
			info: map[string]*fragmodel.VectorCollectionInfo{
				"cleanup_probe_non_empty": {Name: "cleanup_probe_non_empty", Points: 3},
			},
		},
		cleanupOfficialCheckerStub{official: true},
		logging.New(),
	)

	result, err := service.Cleanup(context.Background(), &rebuilddto.CleanupInput{
		OrganizationCode:    "ORG-1",
		ForceDeleteNonEmpty: true,
	})
	if err != nil {
		t.Fatalf("Cleanup() error = %v", err)
	}
	if !result.ForceDeleteNonEmpty {
		t.Fatal("expected force_delete_non_empty=true")
	}
	if result.SafeToDeleteCount != 1 || len(result.SafeToDeleteCollections) != 1 {
		t.Fatalf("expected non-empty collection to be deletable, got %+v", result)
	}
	if result.KeptCount != 0 || len(result.SkipReason) != 0 {
		t.Fatalf("expected no kept collections when force deleting non-empty, got %+v", result)
	}
}

func TestCleanupServiceApplyDeletesAndClearsDualWriteState(t *testing.T) {
	t.Parallel()

	coordinator := &cleanupCoordinatorStub{
		dualWriteState: &domainrebuild.VectorDualWriteState{RunID: "run-stale", Enabled: false},
	}
	collections := &cleanupCollectionRepoStub{
		info: map[string]*fragmodel.VectorCollectionInfo{
			"KNOWLEDGE-force-delete--1": {Name: "KNOWLEDGE-force-delete--1", Points: 5},
			"cleanup_probe_non_empty":   {Name: "cleanup_probe_non_empty", Points: 5},
		},
	}
	service := rebuildapp.NewCleanupService(
		cleanupMetaReaderStub{},
		coordinator,
		collections,
		cleanupOfficialCheckerStub{official: true},
		logging.New(),
	)

	result, err := service.Cleanup(context.Background(), &rebuilddto.CleanupInput{
		OrganizationCode:    "ORG-1",
		Apply:               true,
		ForceDeleteNonEmpty: true,
	})
	if err != nil {
		t.Fatalf("Cleanup() error = %v", err)
	}
	if len(collections.deleted) != 1 || collections.deleted[0] != "KNOWLEDGE-force-delete--1" {
		t.Fatalf("expected only KNOWLEDGE-prefixed collection deleted, got %#v", collections.deleted)
	}
	if _, ok := result.SkipReason["cleanup_probe_non_empty"]; !ok {
		t.Fatalf("expected non-KNOWLEDGE collection kept during apply, got %+v", result.SkipReason)
	}
	if !result.DeletedDualwriteState {
		t.Fatalf("expected dualwrite state deleted, got %+v", result)
	}
	if coordinator.clearedDualWriteRun != "run-stale" {
		t.Fatalf("expected cleared dualwrite run run-stale, got %q", coordinator.clearedDualWriteRun)
	}
}

func TestCleanupServiceRequiresOfficialOrganization(t *testing.T) {
	t.Parallel()

	service := rebuildapp.NewCleanupService(
		cleanupMetaReaderStub{},
		&cleanupCoordinatorStub{},
		&cleanupCollectionRepoStub{},
		cleanupOfficialCheckerStub{official: false},
		logging.New(),
	)

	_, err := service.Cleanup(context.Background(), &rebuilddto.CleanupInput{
		OrganizationCode: "ORG-1",
	})
	if err == nil || !errors.Is(err, rebuildapp.ErrOfficialOrganizationMemberRequired) {
		t.Fatalf("expected official organization error, got %v", err)
	}
}
