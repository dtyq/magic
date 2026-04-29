package docapp

import (
	"context"

	sourcebindingrepository "magic/internal/domain/knowledge/sourcebinding/repository"
)

func (s *DocumentAppService) acquireSourceCallbackLock(
	ctx context.Context,
	key sourcebindingrepository.SourceCallbackSingleflightKey,
) (func(), bool) {
	if s == nil || s.sourceCallbackSingleflight == nil {
		return func() {}, true
	}
	token, acquired, err := s.sourceCallbackSingleflight.AcquireSourceCallbackLock(ctx, key)
	if err != nil {
		if s.logger != nil {
			s.logger.WarnContext(
				ctx,
				"Acquire source callback lock failed, continue without lock",
				"provider", key.Provider,
				"organization_code", key.OrganizationCode,
				"file_id", key.FileID,
				"error", err,
			)
		}
		return func() {}, true
	}
	if !acquired {
		if s.logger != nil {
			s.logger.InfoContext(
				ctx,
				"Skip duplicate source callback because lock is held",
				"provider", key.Provider,
				"organization_code", key.OrganizationCode,
				"file_id", key.FileID,
			)
		}
		return func() {}, false
	}
	return func() {
		if err := s.sourceCallbackSingleflight.ReleaseSourceCallbackLock(ctx, key, token); err != nil && s.logger != nil {
			s.logger.WarnContext(
				ctx,
				"Release source callback lock failed",
				"provider", key.Provider,
				"organization_code", key.OrganizationCode,
				"file_id", key.FileID,
				"error", err,
			)
		}
	}, true
}
