package revectorize_test

import (
	"context"
	"errors"
	"testing"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	revectorize "magic/internal/application/knowledge/shared/revectorize"
)

var errPersistFailed = errors.New("persist failed")

func TestRedisProgressStoreCompleteDocumentDedupesAndIgnoresStaleSession(t *testing.T) {
	t.Parallel()

	store := newRedisStoreForTest(t)
	ctx := context.Background()

	progress, err := store.StartSession(ctx, "KB-1", "SESSION-1", []string{"DOC-1", "DOC-2"})
	if err != nil {
		t.Fatalf("StartSession returned error: %v", err)
	}
	if progress.ExpectedNum != 2 || progress.CompletedNum != 0 {
		t.Fatalf("unexpected initial progress: %#v", progress)
	}

	staleCalled := false
	advanced, err := store.AdvanceDocument(ctx, "KB-1", "SESSION-OLD", "DOC-1", func(*revectorize.SessionProgress) error {
		staleCalled = true
		return nil
	})
	if err != nil {
		t.Fatalf("AdvanceDocument stale session returned error: %v", err)
	}
	if advanced || staleCalled {
		t.Fatalf("expected stale session to be ignored, got advanced=%v called=%v", advanced, staleCalled)
	}

	var firstProgress *revectorize.SessionProgress
	advanced, err = store.AdvanceDocument(ctx, "KB-1", "SESSION-1", "DOC-1", func(progress *revectorize.SessionProgress) error {
		firstProgress = progress
		return nil
	})
	if err != nil {
		t.Fatalf("AdvanceDocument first call returned error: %v", err)
	}
	if !advanced || firstProgress == nil || firstProgress.CompletedNum != 1 {
		t.Fatalf("unexpected first completion result: advanced=%v progress=%#v", advanced, firstProgress)
	}

	duplicateCalled := false
	advanced, err = store.AdvanceDocument(ctx, "KB-1", "SESSION-1", "DOC-1", func(*revectorize.SessionProgress) error {
		duplicateCalled = true
		return nil
	})
	if err != nil {
		t.Fatalf("AdvanceDocument duplicate returned error: %v", err)
	}
	if advanced || duplicateCalled {
		t.Fatalf("expected duplicate completion ignored, got advanced=%v called=%v", advanced, duplicateCalled)
	}
}

func TestRedisProgressStoreStartSessionOverridesPreviousSessionState(t *testing.T) {
	t.Parallel()

	store := newRedisStoreForTest(t)
	ctx := context.Background()

	if _, err := store.StartSession(ctx, "KB-1", "SESSION-1", []string{"DOC-1", "DOC-2"}); err != nil {
		t.Fatalf("StartSession SESSION-1 returned error: %v", err)
	}
	if _, err := store.AdvanceDocument(ctx, "KB-1", "SESSION-1", "DOC-1", func(*revectorize.SessionProgress) error {
		return nil
	}); err != nil {
		t.Fatalf("AdvanceDocument SESSION-1 returned error: %v", err)
	}

	progress, err := store.StartSession(ctx, "KB-1", "SESSION-2", []string{"DOC-3"})
	if err != nil {
		t.Fatalf("StartSession SESSION-2 returned error: %v", err)
	}
	if progress.SessionID != "SESSION-2" || progress.ExpectedNum != 1 || progress.CompletedNum != 0 {
		t.Fatalf("unexpected overridden progress: %#v", progress)
	}

	advanced, err := store.AdvanceDocument(ctx, "KB-1", "SESSION-1", "DOC-2", func(*revectorize.SessionProgress) error {
		return nil
	})
	if err != nil {
		t.Fatalf("AdvanceDocument stale session returned error: %v", err)
	}
	if advanced {
		t.Fatal("expected old session completion to be ignored after new session starts")
	}

	var currentProgress *revectorize.SessionProgress
	advanced, err = store.AdvanceDocument(ctx, "KB-1", "SESSION-2", "DOC-3", func(progress *revectorize.SessionProgress) error {
		currentProgress = progress
		return nil
	})
	if err != nil {
		t.Fatalf("AdvanceDocument current session returned error: %v", err)
	}
	if !advanced || currentProgress == nil || currentProgress.CompletedNum != 1 {
		t.Fatalf("unexpected current session completion result: advanced=%v progress=%#v", advanced, currentProgress)
	}
}

func TestRedisProgressStoreAdvanceDocumentDoesNotCommitWhenPersistFails(t *testing.T) {
	t.Parallel()

	store := newRedisStoreForTest(t)
	ctx := context.Background()

	if _, err := store.StartSession(ctx, "KB-1", "SESSION-1", []string{"DOC-1"}); err != nil {
		t.Fatalf("StartSession returned error: %v", err)
	}

	advanced, err := store.AdvanceDocument(ctx, "KB-1", "SESSION-1", "DOC-1", func(*revectorize.SessionProgress) error {
		return errPersistFailed
	})
	if err == nil || advanced {
		t.Fatalf("expected persist failure without commit, got advanced=%v err=%v", advanced, err)
	}

	var retryProgress *revectorize.SessionProgress
	advanced, err = store.AdvanceDocument(ctx, "KB-1", "SESSION-1", "DOC-1", func(progress *revectorize.SessionProgress) error {
		retryProgress = progress
		return nil
	})
	if err != nil {
		t.Fatalf("AdvanceDocument retry returned error: %v", err)
	}
	if !advanced || retryProgress == nil || retryProgress.CompletedNum != 1 {
		t.Fatalf("expected retry to commit progress, got advanced=%v progress=%#v", advanced, retryProgress)
	}
}

func newRedisStoreForTest(t *testing.T) *revectorize.RedisProgressStore {
	t.Helper()

	server, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	t.Cleanup(server.Close)

	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		_ = client.Close()
	})
	return revectorize.NewRedisProgressStore(client)
}
