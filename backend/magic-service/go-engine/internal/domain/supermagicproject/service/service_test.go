package supermagicproject_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	projectrepository "magic/internal/domain/supermagicproject/repository"
	supermagicproject "magic/internal/domain/supermagicproject/service"
)

var errRepositoryBoom = errors.New("boom")

func TestDomainServiceListWorkspaceIDsByProjectIDs(t *testing.T) {
	t.Parallel()

	repo := &repositoryStub{
		mappings: []projectrepository.ProjectWorkspaceMapping{
			{ProjectID: 11, WorkspaceID: 101},
			{ProjectID: 22, WorkspaceID: 202},
		},
	}
	svc := supermagicproject.NewDomainService(repo)

	got, err := svc.ListWorkspaceIDsByProjectIDs(context.Background(), "ORG-1", []int64{0, 11, 22, 11, -3})
	if err != nil {
		t.Fatalf("ListWorkspaceIDsByProjectIDs() error = %v", err)
	}

	want := map[int64]int64{
		11: 101,
		22: 202,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("ListWorkspaceIDsByProjectIDs() = %#v, want %#v", got, want)
	}
	if !reflect.DeepEqual(repo.lastProjectIDs, []int64{11, 22}) {
		t.Fatalf("repository projectIDs = %#v, want %#v", repo.lastProjectIDs, []int64{11, 22})
	}
}

func TestDomainServiceListWorkspaceIDsByProjectIDsEmptyInput(t *testing.T) {
	t.Parallel()

	repo := &repositoryStub{}
	svc := supermagicproject.NewDomainService(repo)

	got, err := svc.ListWorkspaceIDsByProjectIDs(context.Background(), "ORG-1", []int64{0, -1})
	if err != nil {
		t.Fatalf("ListWorkspaceIDsByProjectIDs() error = %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty result, got %#v", got)
	}
	if repo.called {
		t.Fatal("expected repository not called for empty normalized project IDs")
	}
}

func TestDomainServiceListWorkspaceIDsByProjectIDsFiltersInvalidMappings(t *testing.T) {
	t.Parallel()

	repo := &repositoryStub{
		mappings: []projectrepository.ProjectWorkspaceMapping{
			{ProjectID: 11, WorkspaceID: 101},
			{ProjectID: 22, WorkspaceID: 0},
			{ProjectID: 0, WorkspaceID: 303},
		},
	}
	svc := supermagicproject.NewDomainService(repo)

	got, err := svc.ListWorkspaceIDsByProjectIDs(context.Background(), "ORG-1", []int64{11, 22})
	if err != nil {
		t.Fatalf("ListWorkspaceIDsByProjectIDs() error = %v", err)
	}
	want := map[int64]int64{11: 101}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("ListWorkspaceIDsByProjectIDs() = %#v, want %#v", got, want)
	}
}

func TestDomainServiceListWorkspaceIDsByProjectIDsPropagatesError(t *testing.T) {
	t.Parallel()

	repo := &repositoryStub{err: errRepositoryBoom}
	svc := supermagicproject.NewDomainService(repo)

	if _, err := svc.ListWorkspaceIDsByProjectIDs(context.Background(), "ORG-1", []int64{11}); err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestDomainServiceListSharedProjectIDsByProjectIDs(t *testing.T) {
	t.Parallel()

	repo := &repositoryStub{
		sharedProjectIDs: []int64{11, 22, 22, 0, -1},
	}
	svc := supermagicproject.NewDomainService(repo)

	got, err := svc.ListSharedProjectIDsByProjectIDs(context.Background(), "ORG-1", "USER-1", []int64{0, 11, 22, 11, -3})
	if err != nil {
		t.Fatalf("ListSharedProjectIDsByProjectIDs() error = %v", err)
	}

	want := map[int64]struct{}{
		11: {},
		22: {},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("ListSharedProjectIDsByProjectIDs() = %#v, want %#v", got, want)
	}
	if !reflect.DeepEqual(repo.lastProjectIDs, []int64{11, 22}) {
		t.Fatalf("repository projectIDs = %#v, want %#v", repo.lastProjectIDs, []int64{11, 22})
	}
	if repo.lastUserID != "USER-1" {
		t.Fatalf("repository userID = %q, want %q", repo.lastUserID, "USER-1")
	}
}

func TestDomainServiceListSharedProjectIDsByProjectIDsEmptyInput(t *testing.T) {
	t.Parallel()

	repo := &repositoryStub{}
	svc := supermagicproject.NewDomainService(repo)

	got, err := svc.ListSharedProjectIDsByProjectIDs(context.Background(), "ORG-1", "USER-1", []int64{0, -1})
	if err != nil {
		t.Fatalf("ListSharedProjectIDsByProjectIDs() error = %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty result, got %#v", got)
	}
	if repo.called {
		t.Fatal("expected repository not called for empty normalized project IDs")
	}
}

func TestDomainServiceListSharedProjectIDsByProjectIDsEmptyUserID(t *testing.T) {
	t.Parallel()

	repo := &repositoryStub{}
	svc := supermagicproject.NewDomainService(repo)

	got, err := svc.ListSharedProjectIDsByProjectIDs(context.Background(), "ORG-1", " ", []int64{11})
	if err != nil {
		t.Fatalf("ListSharedProjectIDsByProjectIDs() error = %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty result, got %#v", got)
	}
	if repo.called {
		t.Fatal("expected repository not called for empty user id")
	}
}

func TestDomainServiceListSharedProjectIDsByProjectIDsPropagatesError(t *testing.T) {
	t.Parallel()

	repo := &repositoryStub{err: errRepositoryBoom}
	svc := supermagicproject.NewDomainService(repo)

	if _, err := svc.ListSharedProjectIDsByProjectIDs(context.Background(), "ORG-1", "USER-1", []int64{11}); err == nil {
		t.Fatal("expected error, got nil")
	}
}

type repositoryStub struct {
	mappings         []projectrepository.ProjectWorkspaceMapping
	sharedProjectIDs []int64
	err              error
	lastProjectIDs   []int64
	lastUserID       string
	called           bool
}

func (s *repositoryStub) ListWorkspaceMappings(
	_ context.Context,
	_ string,
	projectIDs []int64,
) ([]projectrepository.ProjectWorkspaceMapping, error) {
	s.called = true
	s.lastProjectIDs = append([]int64(nil), projectIDs...)
	if s.err != nil {
		return nil, s.err
	}
	return append([]projectrepository.ProjectWorkspaceMapping(nil), s.mappings...), nil
}

func (s *repositoryStub) ListSharedProjectIDs(
	_ context.Context,
	_ string,
	userID string,
	projectIDs []int64,
) ([]int64, error) {
	s.called = true
	s.lastUserID = userID
	s.lastProjectIDs = append([]int64(nil), projectIDs...)
	if s.err != nil {
		return nil, s.err
	}
	return append([]int64(nil), s.sharedProjectIDs...), nil
}
