package docapp

import (
	"context"
	"fmt"
	"time"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/projectfile"
)

const (
	sourceResolveCacheTTL = 2 * time.Minute
)

type cachedResolvedSource struct {
	ResolvedAt   time.Time
	Content      string
	ContentHash  string
	DocType      int
	DocumentFile map[string]any
	Source       string
}

func (s *DocumentAppService) loadCachedResolvedSource(cacheKey string) (*cachedResolvedSource, bool) {
	if s == nil || cacheKey == "" {
		return nil, false
	}
	raw, ok := s.sourceResolveCache.Load(cacheKey)
	if !ok {
		return nil, false
	}
	cached, ok := raw.(*cachedResolvedSource)
	if !ok || cached == nil {
		s.sourceResolveCache.Delete(cacheKey)
		return nil, false
	}
	if time.Since(cached.ResolvedAt) > sourceResolveCacheTTL {
		s.sourceResolveCache.Delete(cacheKey)
		return nil, false
	}
	return cached, true
}

func (s *DocumentAppService) storeResolvedSource(cacheKey string, cached *cachedResolvedSource) {
	if s == nil || cacheKey == "" || cached == nil {
		return
	}
	s.sourceResolveCache.Store(cacheKey, cached)
}

func (s *DocumentAppService) resolveProjectFileSourceOverride(
	ctx context.Context,
	projectFileID int64,
) (*projectfile.ResolveResult, *documentdomain.SourceOverride, error) {
	if s == nil || projectFileID <= 0 {
		return nil, nil, nil
	}

	resolved, override, err := documentdomain.ResolveProjectFileSourceOverride(
		ctx,
		s.projectFilePort,
		projectFileID,
		time.Now(),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("resolve project file source override: %w", err)
	}
	if override != nil {
		s.prepareProjectFileResolvedSource(resolved)
	}
	return resolved, override, nil
}

func (s *DocumentAppService) prepareProjectFileResolvedSource(
	resolved *projectfile.ResolveResult,
) *documentdomain.SourceOverride {
	if s == nil || resolved == nil {
		return nil
	}

	plan := documentdomain.BuildProjectResolvedSourcePlan(resolved, time.Now())
	if plan.SourceOverride == nil || plan.Snapshot == nil {
		return nil
	}

	s.storeResolvedSource(plan.CacheKey, newCachedResolvedSource(plan.Snapshot))
	return plan.SourceOverride
}

func cachedResolvedSourceToSnapshot(cached *cachedResolvedSource) *documentdomain.ResolvedSourceSnapshot {
	if cached == nil {
		return nil
	}
	return documentdomain.BuildResolvedSourceSnapshot(documentdomain.SourceSnapshotInput{
		Content:            cached.Content,
		DocType:            cached.DocType,
		DocumentFile:       cached.DocumentFile,
		Source:             cached.Source,
		ContentHash:        cached.ContentHash,
		FetchedAtUnixMilli: cached.ResolvedAt.UnixMilli(),
		Now:                cached.ResolvedAt,
	})
}

func newCachedResolvedSource(snapshot *documentdomain.ResolvedSourceSnapshot) *cachedResolvedSource {
	if snapshot == nil {
		return nil
	}
	return &cachedResolvedSource{
		ResolvedAt:   time.Now(),
		Content:      snapshot.Content,
		ContentHash:  snapshot.ContentHash,
		DocType:      snapshot.DocType,
		DocumentFile: snapshot.DocumentFile,
		Source:       snapshot.Source,
	}
}
