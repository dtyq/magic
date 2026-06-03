package service_test

import (
	"context"
	"errors"
	"testing"

	socketioapp "magic/internal/application/socketio"
	opsdto "magic/internal/interfaces/rpc/jsonrpc/ops/dto"
	opssvc "magic/internal/interfaces/rpc/jsonrpc/ops/service"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

func TestSocketIORedisCleanupRPCRequiresOfficialOrganization(t *testing.T) {
	t.Parallel()

	cleaner := &recordingCleaner{}
	svc := opssvc.NewOpsRPCService(cleaner, &recordingOfficialChecker{allowed: false}, nil)

	_, err := svc.SocketIORedisCleanupRPC(context.Background(), &opsdto.SocketIORedisCleanupRequest{
		DataIsolation: opsdto.DataIsolation{OrganizationCode: "org"},
		Prefix:        socketioapp.RedisV2Prefix,
	})

	assertBusinessErrorCode(t, err, jsonrpc.ErrCodePermissionDenied)
	if cleaner.calls != 0 {
		t.Fatalf("expected permission failure to skip cleaner, calls=%d", cleaner.calls)
	}
}

func TestSocketIORedisCleanupRPCRequiresOrganizationCode(t *testing.T) {
	t.Parallel()

	cleaner := &recordingCleaner{}
	svc := opssvc.NewOpsRPCService(cleaner, &recordingOfficialChecker{allowed: true}, nil)

	_, err := svc.SocketIORedisCleanupRPC(context.Background(), &opsdto.SocketIORedisCleanupRequest{
		Prefix: socketioapp.RedisV2Prefix,
	})

	assertBusinessErrorCode(t, err, jsonrpc.ErrCodeInvalidParams)
	if cleaner.calls != 0 {
		t.Fatalf("expected invalid request to skip cleaner, calls=%d", cleaner.calls)
	}
}

func TestSocketIORedisCleanupRPCReturnsCleanupResult(t *testing.T) {
	t.Parallel()

	cleaner := &recordingCleaner{
		result: &socketioapp.RedisCleanupResult{
			JobID:      "job-1",
			Status:     socketioapp.RedisCleanupStatusDone,
			Prefix:     socketioapp.RedisV2Prefix,
			Pattern:    socketioapp.RedisV2Prefix + ":*",
			Cursor:     0,
			Count:      500,
			Apply:      true,
			Done:       true,
			Matched:    3,
			Deleted:    3,
			Pages:      2,
			SampleKeys: []string{"a", "b"},
			Owner:      "pod-a",
		},
	}
	svc := opssvc.NewOpsRPCService(cleaner, &recordingOfficialChecker{allowed: true}, nil)

	resp, err := svc.SocketIORedisCleanupRPC(context.Background(), &opsdto.SocketIORedisCleanupRequest{
		DataIsolation: opsdto.DataIsolation{OrganizationCode: "org"},
		Prefix:        socketioapp.RedisV2Prefix,
		Cursor:        10,
		Count:         500,
		Apply:         true,
		SampleLimit:   2,
	})
	if err != nil {
		t.Fatalf("expected cleanup success, got %v", err)
	}
	if cleaner.calls != 1 {
		t.Fatalf("expected one cleaner call, got %d", cleaner.calls)
	}
	if cleaner.lastInput.Prefix != socketioapp.RedisV2Prefix || !cleaner.lastInput.Apply {
		t.Fatalf("unexpected cleaner input: %#v", cleaner.lastInput)
	}
	if resp.JobID != "job-1" || resp.Status != "done" || resp.Deleted != 3 ||
		resp.Matched != 3 || resp.Pages != 2 || !resp.Done || len(resp.SampleKeys) != 2 {
		t.Fatalf("unexpected response: %#v", resp)
	}
}

func TestSocketIORedisCleanupRPCMapsPrefixErrors(t *testing.T) {
	t.Parallel()

	for name, cleanupErr := range map[string]error{
		"prefix_denied": socketioapp.ErrRedisCleanupPrefixDenied,
		"apply_denied":  socketioapp.ErrRedisCleanupApplyDenied,
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			cleaner := &recordingCleaner{
				err: cleanupErr,
			}
			svc := opssvc.NewOpsRPCService(cleaner, &recordingOfficialChecker{allowed: true}, nil)

			_, err := svc.SocketIORedisCleanupRPC(context.Background(), &opsdto.SocketIORedisCleanupRequest{
				DataIsolation: opsdto.DataIsolation{OrganizationCode: "org"},
				Prefix:        "magicChat:SocketIo:RedisAdapter:unknown",
			})

			assertBusinessErrorCode(t, err, jsonrpc.ErrCodeInvalidParams)
		})
	}
}

type recordingCleaner struct {
	calls     int
	lastInput socketioapp.RedisCleanupInput
	result    *socketioapp.RedisCleanupResult
	err       error
}

func (c *recordingCleaner) Cleanup(
	_ context.Context,
	input *socketioapp.RedisCleanupInput,
) (*socketioapp.RedisCleanupResult, error) {
	c.calls++
	if input != nil {
		c.lastInput = *input
	}
	if c.err != nil {
		return nil, c.err
	}
	return c.result, nil
}

type recordingOfficialChecker struct {
	allowed bool
	err     error
}

func (c *recordingOfficialChecker) IsOfficialOrganizationMember(
	context.Context,
	string,
) (bool, error) {
	if c.err != nil {
		return false, c.err
	}
	return c.allowed, nil
}

func assertBusinessErrorCode(t *testing.T, err error, expected int) {
	t.Helper()

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) {
		t.Fatalf("expected BusinessError, got %T: %v", err, err)
	}
	if bizErr.Code != expected {
		t.Fatalf("expected error code=%d, got %d: %v", expected, bizErr.Code, err)
	}
}
