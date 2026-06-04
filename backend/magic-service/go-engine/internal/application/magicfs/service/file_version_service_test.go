package service_test

import (
	"context"
	"errors"
	"testing"

	magicfsapp "magic/internal/application/magicfs/service"
)

func TestFileVersionServiceGetFileVersion(t *testing.T) {
	t.Parallel()

	authorizer := &fileAccessAuthorizerStub{}
	repository := &fileVersionRepositoryStub{version: 7}
	svc := magicfsapp.NewFileVersionService(repository, authorizer)

	version, err := svc.GetFileVersion(context.Background(), map[string][]string{
		"Authorization": {"Bearer token"},
	}, "42")
	if err != nil {
		t.Fatalf("GetFileVersion returned error: %v", err)
	}
	if version != 7 {
		t.Fatalf("expected version 7, got %d", version)
	}
	if authorizer.fileID != "42" {
		t.Fatalf("expected authorizer file id 42, got %q", authorizer.fileID)
	}
	if repository.fileID != 42 {
		t.Fatalf("expected repository file id 42, got %d", repository.fileID)
	}
}

func TestFileVersionServiceGetFileVersionAuthErrorSkipsRepository(t *testing.T) {
	t.Parallel()

	expectedErr := &magicfsapp.BusinessError{Code: 2154, Message: "user.account_error"}
	repository := &fileVersionRepositoryStub{}
	svc := magicfsapp.NewFileVersionService(repository, &fileAccessAuthorizerStub{err: expectedErr})

	_, err := svc.GetFileVersion(context.Background(), nil, "42")
	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected auth error, got %v", err)
	}
	if repository.called {
		t.Fatal("repository should not be called when authorization fails")
	}
}

func TestFileVersionServiceGetFileVersionInvalidIDAfterAuthorization(t *testing.T) {
	t.Parallel()

	repository := &fileVersionRepositoryStub{}
	svc := magicfsapp.NewFileVersionService(repository, &fileAccessAuthorizerStub{})

	_, err := svc.GetFileVersion(context.Background(), nil, "invalid")
	if !errors.Is(err, magicfsapp.ErrFileNotFound) {
		t.Fatalf("expected file not found, got %v", err)
	}
	if repository.called {
		t.Fatal("repository should not be called for invalid file id")
	}
}

type fileVersionRepositoryStub struct {
	called  bool
	fileID  int64
	version int64
	err     error
}

func (s *fileVersionRepositoryStub) GetMetadataVersion(ctx context.Context, fileID int64) (int64, error) {
	s.called = true
	s.fileID = fileID
	return s.version, s.err
}

type fileAccessAuthorizerStub struct {
	fileID string
	err    error
}

func (s *fileAccessAuthorizerStub) AuthorizeFileViewer(ctx context.Context, headers map[string][]string, fileID string) error {
	s.fileID = fileID
	return s.err
}
