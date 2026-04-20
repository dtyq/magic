package document_test

import (
	"context"
	"errors"
	"testing"

	document "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
)

const (
	testThirdFileLifecycleOrgCode      = "ORG1"
	testThirdFileLifecyclePlatformType = "teamshare"
	testThirdFileLifecycleFileID       = "FILE-1"
)

type thirdFilePlannerStub struct {
	plan      document.ThirdFileDocumentPlan
	err       error
	callCount int
	lastInput document.ThirdFileDocumentPlanInput
}

func (s *thirdFilePlannerStub) ResolveThirdFileDocumentPlan(
	_ context.Context,
	input document.ThirdFileDocumentPlanInput,
) (document.ThirdFileDocumentPlan, error) {
	s.callCount++
	s.lastInput = input
	if s.err != nil {
		return document.ThirdFileDocumentPlan{}, s.err
	}
	return s.plan, nil
}

type thirdFileProviderGuardStub struct {
	err       error
	callCount int
	lastType  string
}

func (s *thirdFileProviderGuardStub) EnsureThirdFileProvider(platformType string) error {
	s.callCount++
	s.lastType = platformType
	return s.err
}

type thirdFileSourceSnapshotResolverStub struct {
	snapshot  *document.ResolvedSourceSnapshot
	err       error
	callCount int
	lastInput *document.ThirdFileRevectorizeInput
	lastSeed  *document.ThirdFileRevectorizeSeed
}

func (s *thirdFileSourceSnapshotResolverStub) ResolveThirdFileSourceSnapshot(
	_ context.Context,
	input *document.ThirdFileRevectorizeInput,
	seed *document.ThirdFileRevectorizeSeed,
) (*document.ResolvedSourceSnapshot, error) {
	s.callCount++
	s.lastInput = input
	s.lastSeed = seed
	if s.err != nil {
		return nil, s.err
	}
	return s.snapshot, nil
}

func TestThirdFileRevectorizeLifecycleServicePlanBuildsRequests(t *testing.T) {
	t.Parallel()

	seed := &document.ThirdFileRevectorizeSeed{
		SourceCacheKey: "teamshare:ORG1:teamshare:FILE-1",
		SeedDocument: &document.KnowledgeBaseDocument{
			KnowledgeBaseCode: "KB-1",
			Code:              "DOC-SEED",
			UpdatedUID:        "seed-user",
		},
	}
	planner := &thirdFilePlannerStub{
		plan: document.ThirdFileDocumentPlan{
			Documents: []*document.KnowledgeBaseDocument{
				{KnowledgeBaseCode: "KB-1", Code: "DOC-1", UpdatedUID: "doc-user"},
				nil,
				{KnowledgeBaseCode: "KB-2", Code: "DOC-2"},
			},
			Seed: seed,
		},
	}
	providerGuard := &thirdFileProviderGuardStub{}
	snapshotResolver := &thirdFileSourceSnapshotResolverStub{
		snapshot: &document.ResolvedSourceSnapshot{
			Content:            "new content",
			ContentHash:        "hash-1",
			DocType:            int(document.DocTypeFile),
			DocumentFile:       map[string]any{"name": "spec.md"},
			Source:             "resolve",
			FetchedAtUnixMilli: 123,
		},
	}
	svc := document.NewThirdFileRevectorizeLifecycleService(planner, providerGuard, snapshotResolver)

	plan, err := svc.Plan(context.Background(), document.ThirdFileRevectorizeLifecycleInput{
		Task: &document.ThirdFileRevectorizeInput{
			OrganizationCode:  " ORG1 ",
			UserID:            " U1 ",
			ThirdPlatformType: " TeamShare ",
			ThirdFileID:       " FILE-1 ",
		},
		Async: false,
	})
	if err != nil {
		t.Fatalf("Plan returned error: %v", err)
	}
	assertThirdFileLifecyclePlannerInput(t, planner)
	assertThirdFileLifecycleProviderGuard(t, providerGuard)
	assertThirdFileLifecycleSnapshotResolver(t, snapshotResolver, seed)
	assertThirdFileLifecycleTask(t, plan.Task)
	assertThirdFileLifecycleRequests(t, plan.Requests)
}

func TestThirdFileRevectorizeLifecycleServicePlanReturnsDependencyAndInputErrors(t *testing.T) {
	t.Parallel()

	validTask := &document.ThirdFileRevectorizeInput{
		OrganizationCode:  testThirdFileLifecycleOrgCode,
		ThirdPlatformType: testThirdFileLifecyclePlatformType,
		ThirdFileID:       testThirdFileLifecycleFileID,
	}

	if _, err := (*document.ThirdFileRevectorizeLifecycleService)(nil).Plan(context.Background(), document.ThirdFileRevectorizeLifecycleInput{
		Task: validTask,
	}); !errors.Is(err, document.ErrThirdFileRevectorizeLifecyclePlannerNil) {
		t.Fatalf("expected planner nil error, got %v", err)
	}

	if _, err := document.NewThirdFileRevectorizeLifecycleService(&thirdFilePlannerStub{}, nil, &thirdFileSourceSnapshotResolverStub{}).Plan(
		context.Background(),
		document.ThirdFileRevectorizeLifecycleInput{Task: validTask},
	); !errors.Is(err, document.ErrThirdFileRevectorizeLifecycleProviderGuardNil) {
		t.Fatalf("expected provider guard nil error, got %v", err)
	}

	if _, err := document.NewThirdFileRevectorizeLifecycleService(&thirdFilePlannerStub{}, &thirdFileProviderGuardStub{}, nil).Plan(
		context.Background(),
		document.ThirdFileRevectorizeLifecycleInput{Task: validTask},
	); !errors.Is(err, document.ErrThirdFileRevectorizeLifecycleSnapshotResolverNil) {
		t.Fatalf("expected snapshot resolver nil error, got %v", err)
	}

	if _, err := document.NewThirdFileRevectorizeLifecycleService(&thirdFilePlannerStub{}, &thirdFileProviderGuardStub{}, &thirdFileSourceSnapshotResolverStub{}).Plan(
		context.Background(),
		document.ThirdFileRevectorizeLifecycleInput{Task: &document.ThirdFileRevectorizeInput{OrganizationCode: "ORG1"}},
	); !errors.Is(err, shared.ErrDocumentNotFound) {
		t.Fatalf("expected document not found, got %v", err)
	}
}

func TestThirdFileRevectorizeLifecycleServicePlanStopsAfterProviderError(t *testing.T) {
	t.Parallel()

	providerErr := shared.ErrUnsupportedThirdPlatformType
	planner := &thirdFilePlannerStub{
		plan: document.ThirdFileDocumentPlan{
			Documents: []*document.KnowledgeBaseDocument{{KnowledgeBaseCode: "KB-1", Code: "DOC-1"}},
			Seed: &document.ThirdFileRevectorizeSeed{
				SourceCacheKey: "teamshare:ORG1:teamshare:FILE-1",
				SeedDocument:   &document.KnowledgeBaseDocument{KnowledgeBaseCode: "KB-1", Code: "DOC-1"},
			},
		},
	}
	snapshotResolver := &thirdFileSourceSnapshotResolverStub{
		snapshot: &document.ResolvedSourceSnapshot{Content: "ignored"},
	}
	svc := document.NewThirdFileRevectorizeLifecycleService(
		planner,
		&thirdFileProviderGuardStub{err: providerErr},
		snapshotResolver,
	)

	_, err := svc.Plan(context.Background(), document.ThirdFileRevectorizeLifecycleInput{
		Task: &document.ThirdFileRevectorizeInput{
			OrganizationCode:  testThirdFileLifecycleOrgCode,
			ThirdPlatformType: "unknown",
			ThirdFileID:       testThirdFileLifecycleFileID,
		},
		Async: true,
	})
	if !errors.Is(err, providerErr) {
		t.Fatalf("expected provider error, got %v", err)
	}
	if snapshotResolver.callCount != 0 {
		t.Fatalf("expected snapshot resolver not to run, got %d", snapshotResolver.callCount)
	}
}

func assertThirdFileLifecyclePlannerInput(t *testing.T, planner *thirdFilePlannerStub) {
	t.Helper()

	if planner.callCount != 1 {
		t.Fatalf("expected planner to run once, got %d", planner.callCount)
	}
	if planner.lastInput.OrganizationCode != testThirdFileLifecycleOrgCode {
		t.Fatalf("unexpected planner org code: %#v", planner.lastInput)
	}
	if planner.lastInput.ThirdPlatformType != testThirdFileLifecyclePlatformType {
		t.Fatalf("unexpected planner platform type: %#v", planner.lastInput)
	}
	if planner.lastInput.ThirdFileID != testThirdFileLifecycleFileID {
		t.Fatalf("unexpected planner file id: %#v", planner.lastInput)
	}
}

func assertThirdFileLifecycleProviderGuard(t *testing.T, providerGuard *thirdFileProviderGuardStub) {
	t.Helper()

	if providerGuard.callCount != 1 {
		t.Fatalf("expected provider guard to run once, got %d", providerGuard.callCount)
	}
	if providerGuard.lastType != testThirdFileLifecyclePlatformType {
		t.Fatalf("unexpected provider guard type: %#v", providerGuard)
	}
}

func assertThirdFileLifecycleSnapshotResolver(
	t *testing.T,
	snapshotResolver *thirdFileSourceSnapshotResolverStub,
	seed *document.ThirdFileRevectorizeSeed,
) {
	t.Helper()

	if snapshotResolver.callCount != 1 {
		t.Fatalf("expected snapshot resolver to run once, got %d", snapshotResolver.callCount)
	}
	if snapshotResolver.lastInput == nil {
		t.Fatal("expected snapshot resolver input")
	}
	if snapshotResolver.lastInput.OrganizationCode != testThirdFileLifecycleOrgCode {
		t.Fatalf("unexpected snapshot resolver input: %#v", snapshotResolver.lastInput)
	}
	if snapshotResolver.lastSeed != seed {
		t.Fatalf("unexpected snapshot resolver seed: %#v", snapshotResolver.lastSeed)
	}
}

func assertThirdFileLifecycleTask(t *testing.T, task *document.ThirdFileRevectorizeInput) {
	t.Helper()

	if task == nil {
		t.Fatal("expected normalized task")
	}
	if task.OrganizationCode != testThirdFileLifecycleOrgCode {
		t.Fatalf("unexpected task org code: %#v", task)
	}
	if task.UserID != "U1" {
		t.Fatalf("unexpected task user id: %#v", task)
	}
	if task.ThirdPlatformType != testThirdFileLifecyclePlatformType || task.ThirdFileID != testThirdFileLifecycleFileID {
		t.Fatalf("unexpected normalized task: %#v", task)
	}
}

func assertThirdFileLifecycleRequests(t *testing.T, requests []*document.SyncDocumentInput) {
	t.Helper()

	if len(requests) != 2 {
		t.Fatalf("expected 2 requests, got %#v", requests)
	}
	if requests[0].Async {
		t.Fatalf("expected sync request to keep async=false, got %#v", requests[0])
	}
	if requests[0].BusinessParams == nil || requests[0].BusinessParams.UserID != "U1" {
		t.Fatalf("unexpected first request business params: %#v", requests[0])
	}
	if requests[0].SourceOverride == nil || requests[0].SourceOverride.Content != "new content" {
		t.Fatalf("expected source override on first request, got %#v", requests[0].SourceOverride)
	}
	if requests[1].KnowledgeBaseCode != "KB-2" || requests[1].Code != "DOC-2" || requests[1].Async {
		t.Fatalf("unexpected second request: %#v", requests[1])
	}
}
