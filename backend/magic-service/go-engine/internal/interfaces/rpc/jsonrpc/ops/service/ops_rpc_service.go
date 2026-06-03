// Package service provides operational JSON-RPC handlers.
package service

import (
	"context"
	"errors"
	"time"

	socketioapp "magic/internal/application/socketio"
	"magic/internal/constants"
	"magic/internal/infrastructure/logging"
	opsdto "magic/internal/interfaces/rpc/jsonrpc/ops/dto"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

type socketIORedisCleaner interface {
	Cleanup(ctx context.Context, input *socketioapp.RedisCleanupInput) (*socketioapp.RedisCleanupResult, error)
}

// OfficialOrganizationMemberChecker checks whether the caller belongs to the official organization.
type OfficialOrganizationMemberChecker interface {
	IsOfficialOrganizationMember(ctx context.Context, organizationCode string) (bool, error)
}

// OpsRPCService exposes operational RPC handlers.
type OpsRPCService struct {
	socketIORedisCleaner socketIORedisCleaner
	officialChecker      OfficialOrganizationMemberChecker
	logger               *logging.SugaredLogger
}

// NewOpsRPCService creates an operational RPC service.
func NewOpsRPCService(
	socketIORedisCleaner socketIORedisCleaner,
	officialChecker OfficialOrganizationMemberChecker,
	logger *logging.SugaredLogger,
) *OpsRPCService {
	return &OpsRPCService{
		socketIORedisCleaner: socketIORedisCleaner,
		officialChecker:      officialChecker,
		logger:               logger,
	}
}

// Handlers returns all ops RPC handlers exposed by the service.
func (s *OpsRPCService) Handlers() map[string]jsonrpc.ServerHandler {
	if s == nil {
		return nil
	}
	return map[string]jsonrpc.ServerHandler{
		constants.MethodSocketIORedisCleanup: jsonrpc.WrapTyped(s.SocketIORedisCleanupRPC),
	}
}

// SocketIORedisCleanupRPC starts or observes the async Socket.IO Redis cleanup job.
func (s *OpsRPCService) SocketIORedisCleanupRPC(
	ctx context.Context,
	req *opsdto.SocketIORedisCleanupRequest,
) (*opsdto.SocketIORedisCleanupResponse, error) {
	if req == nil {
		return nil, jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInvalidParams, "request is required", nil)
	}
	if s.socketIORedisCleaner == nil {
		return nil, jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInternalError, "socketio redis cleaner not initialized", nil)
	}
	if err := s.ensureOfficialOrganizationMember(ctx, req); err != nil {
		return nil, err
	}

	result, err := s.socketIORedisCleaner.Cleanup(ctx, &socketioapp.RedisCleanupInput{
		Prefix:      req.Prefix,
		Cursor:      req.Cursor,
		Count:       req.Count,
		Apply:       req.Apply,
		SampleLimit: req.SampleLimit,
	})
	if err != nil {
		if s.logger != nil {
			s.logger.ErrorContext(ctx, "Failed to cleanup socketio redis keys", "prefix", req.Prefix, "error", err)
		}
		return nil, mapSocketIORedisCleanupError(err)
	}
	return socketIORedisCleanupResultToRPCResponse(result), nil
}

func (s *OpsRPCService) ensureOfficialOrganizationMember(
	ctx context.Context,
	req *opsdto.SocketIORedisCleanupRequest,
) error {
	organizationCode := req.DataIsolation.ResolveOrganizationCode()
	if organizationCode == "" {
		return jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInvalidParams, "data_isolation.organization_code is required", nil)
	}
	if s.officialChecker == nil {
		return jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInternalError, "official organization checker not initialized", nil)
	}
	ok, err := s.officialChecker.IsOfficialOrganizationMember(ctx, organizationCode)
	if err != nil {
		if s.logger != nil {
			s.logger.ErrorContext(ctx, "Failed to check official organization member", "organization_code", organizationCode, "error", err)
		}
		return jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInternalError, err.Error(), nil)
	}
	if !ok {
		return jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodePermissionDenied, "official organization member is required", nil)
	}
	return nil
}

func mapSocketIORedisCleanupError(err error) error {
	if errors.Is(err, socketioapp.ErrRedisCleanupPrefixRequired) ||
		errors.Is(err, socketioapp.ErrRedisCleanupPrefixDenied) ||
		errors.Is(err, socketioapp.ErrRedisCleanupApplyDenied) {
		return jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInvalidParams, err.Error(), nil)
	}
	return jsonrpc.NewBusinessErrorWithMessage(jsonrpc.ErrCodeInternalError, err.Error(), nil)
}

func socketIORedisCleanupResultToRPCResponse(
	result *socketioapp.RedisCleanupResult,
) *opsdto.SocketIORedisCleanupResponse {
	if result == nil {
		return &opsdto.SocketIORedisCleanupResponse{SampleKeys: []string{}}
	}
	return &opsdto.SocketIORedisCleanupResponse{
		JobID:          result.JobID,
		Status:         string(result.Status),
		Prefix:         result.Prefix,
		Pattern:        result.Pattern,
		Apply:          result.Apply,
		Count:          result.Count,
		Cursor:         result.Cursor,
		Matched:        result.Matched,
		Deleted:        result.Deleted,
		Pages:          result.Pages,
		SampleKeys:     append([]string(nil), result.SampleKeys...),
		Owner:          result.Owner,
		HeartbeatAt:    formatCleanupTime(result.HeartbeatAt),
		LastProgressAt: formatCleanupTime(result.LastProgressAt),
		StartedAt:      formatCleanupTime(result.StartedAt),
		UpdatedAt:      formatCleanupTime(result.UpdatedAt),
		FinishedAt:     formatCleanupTime(result.FinishedAt),
		Error:          result.Error,
		Done:           result.Done,
	}
}

func formatCleanupTime(value *time.Time) string {
	if value == nil || value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339Nano)
}
