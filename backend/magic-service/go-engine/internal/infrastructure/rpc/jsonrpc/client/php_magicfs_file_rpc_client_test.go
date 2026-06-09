package client_test

import (
	"context"
	"errors"
	"testing"

	"magic/internal/domain/magicfs"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
)

const rpcSuccessMessage = "success"

func TestPHPMagicFSFileRPCClientAuthorizeFileViewerNoClient(t *testing.T) {
	t.Parallel()

	c := ipcclient.NewPHPMagicFSFileRPCClient(nil, nil)
	err := c.AuthorizeFileViewer(context.Background(), nil, "42")
	if !errors.Is(err, ipcclient.ErrNoClientConnected) {
		t.Fatalf("expected ErrNoClientConnected, got %v", err)
	}
}

func TestPHPMagicFSFileRPCClientAuthorizeFileViewerSuccess(t *testing.T) {
	t.Parallel()

	c := ipcclient.NewPHPMagicFSFileRPCClient(nil, nil)
	c.SetConnectedHookForTest(func() bool { return true })
	c.SetAuthorizeHookForTest(func(ctx context.Context, params map[string]any) (int, string, error) {
		if params["file_id"] != "42" {
			t.Fatalf("expected file_id 42, got %v", params["file_id"])
		}
		return 0, rpcSuccessMessage, nil
	})

	if err := c.AuthorizeFileViewer(context.Background(), nil, "42"); err != nil {
		t.Fatalf("AuthorizeFileViewer returned error: %v", err)
	}
}

func TestPHPMagicFSFileRPCClientAuthorizeFileViewerBusinessError(t *testing.T) {
	t.Parallel()

	c := ipcclient.NewPHPMagicFSFileRPCClient(nil, nil)
	c.SetConnectedHookForTest(func() bool { return true })
	c.SetAuthorizeHookForTest(func(ctx context.Context, params map[string]any) (int, string, error) {
		return 2154, "user.account_error", nil
	})

	err := c.AuthorizeFileViewer(context.Background(), nil, "42")
	var businessError *magicfs.BusinessError
	if !errors.As(err, &businessError) {
		t.Fatalf("expected BusinessError, got %v", err)
	}
	if businessError.Code != 2154 || businessError.Message != "user.account_error" {
		t.Fatalf("unexpected business error: %+v", businessError)
	}
}
