package docapp

import (
	"context"
	"fmt"
	"strings"
	"time"

	documentdomain "magic/internal/domain/knowledge/document/service"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/projectfile"
)

const (
	sourceResolveCacheTTL              = 2 * time.Minute
	sourceResolveCacheSweepInterval    = time.Minute
	sourceResolveCacheThirdFilePrefix  = "third_file:"
	sourceResolveCacheVersionDelimiter = ":v:"
)

type cachedResolvedSource struct {
	ResolvedAt     time.Time
	Content        string
	ContentHash    string
	DocType        int
	DocumentFile   map[string]any
	ParsedDocument *parseddocument.ParsedDocument
	Source         string
}

func (s *DocumentAppService) loadCachedResolvedSource(cacheKey string) (*cachedResolvedSource, bool) {
	if s == nil || !isVersionedThirdFileSourceCacheKey(cacheKey) {
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
	if s == nil || !isVersionedThirdFileSourceCacheKey(cacheKey) || cached == nil {
		return
	}
	s.sweepExpiredResolvedSources(time.Now())
	s.sourceResolveCache.Store(cacheKey, cached)
}

func (s *DocumentAppService) resolveThirdFileSourceCacheKey(
	ctx context.Context,
	sourceKey string,
	syncInput *documentdomain.SyncDocumentInput,
) (string, bool) {
	sourceKey = strings.TrimSpace(sourceKey)
	if s == nil || sourceKey == "" {
		return "", false
	}
	if syncInput == nil ||
		documentdomain.NormalizeRevectorizeSource(syncInput.RevectorizeSource) != documentdomain.RevectorizeSourceThirdFileBroadcast {
		// sourceResolveCache 只允许保存带 Redis version 的 third-file fan-out 大对象。
		// 单文档手动、start-vector、document_update 单文档阶段都没有跨文档复用诉求，
		// 直接绕过本地缓存，避免 2 分钟进程缓存把旧内容带进重同步。
		return "", false
	}
	if syncInput.SkipThirdFileSourceCache {
		s.logThirdFileSourceCacheBypass(ctx, sourceKey, syncInput, "producer_requested_skip", nil)
		return "", false
	}
	if s.thirdFileSourceVersionStore == nil {
		s.logThirdFileSourceCacheBypass(ctx, sourceKey, syncInput, "version_store_missing", nil)
		return "", false
	}
	version, found, err := s.thirdFileSourceVersionStore.Get(ctx, sourceKey)
	if err != nil {
		s.logThirdFileSourceCacheBypass(ctx, sourceKey, syncInput, "version_read_failed", err)
		return "", false
	}
	version = strings.TrimSpace(version)
	if !found || version == "" {
		// Redis version 是跨 pod 判断“这批 fan-out 应该用哪份本地大对象缓存”的唯一依据。
		// 读不到 version 时直接绕过本地 cache，宁可重复拉最新内容，也不能复用旧进程缓存。
		s.logThirdFileSourceCacheBypass(ctx, sourceKey, syncInput, "version_missing", nil)
		return "", false
	}
	if requested := strings.TrimSpace(syncInput.ThirdFileSourceCacheVersion); requested != "" && requested != version {
		s.logThirdFileSourceCacheVersionMismatch(ctx, sourceKey, requested, version, syncInput)
	}
	return buildVersionedThirdFileSourceCacheKey(sourceKey, version), true
}

func buildVersionedThirdFileSourceCacheKey(sourceKey, version string) string {
	sourceKey = strings.TrimSpace(sourceKey)
	version = strings.TrimSpace(version)
	if sourceKey == "" || version == "" {
		return ""
	}
	return sourceKey + sourceResolveCacheVersionDelimiter + version
}

func isVersionedThirdFileSourceCacheKey(cacheKey string) bool {
	cacheKey = strings.TrimSpace(cacheKey)
	// sourceResolveCache 只能存 third-file fan-out 的 versioned key。
	// 未带 Redis version 的裸 key 一律拒绝，避免以后新增路径时误复用进程内旧源内容。
	return strings.HasPrefix(cacheKey, sourceResolveCacheThirdFilePrefix) &&
		strings.Contains(cacheKey, sourceResolveCacheVersionDelimiter)
}

func (s *DocumentAppService) sweepExpiredResolvedSources(now time.Time) {
	if s == nil {
		return
	}
	s.sourceResolveCacheSweepMu.Lock()
	defer s.sourceResolveCacheSweepMu.Unlock()
	if !s.sourceResolveCacheSweptAt.IsZero() && now.Sub(s.sourceResolveCacheSweptAt) < sourceResolveCacheSweepInterval {
		return
	}
	s.sourceResolveCacheSweptAt = now
	s.sourceResolveCache.Range(func(key, value any) bool {
		cached, ok := value.(*cachedResolvedSource)
		if !ok || cached == nil || now.Sub(cached.ResolvedAt) > sourceResolveCacheTTL {
			s.sourceResolveCache.Delete(key)
		}
		return true
	})
}

func (s *DocumentAppService) logThirdFileSourceCacheBypass(
	ctx context.Context,
	sourceKey string,
	input *documentdomain.SyncDocumentInput,
	reason string,
	err error,
) {
	if s == nil || s.logger == nil || input == nil {
		return
	}
	fields := []any{
		"source_cache_key", sourceKey,
		"knowledge_base_code", input.KnowledgeBaseCode,
		"document_code", input.Code,
		"revectorize_source", input.RevectorizeSource,
		"skip_reason", reason,
	}
	if err != nil {
		fields = append(fields, "error", err)
	}
	s.logger.KnowledgeWarnContext(ctx, "Bypass third-file source cache", fields...)
}

func (s *DocumentAppService) logThirdFileSourceCacheVersionMismatch(
	ctx context.Context,
	sourceKey string,
	requestedVersion string,
	currentVersion string,
	input *documentdomain.SyncDocumentInput,
) {
	if s == nil || s.logger == nil || input == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Use current Redis third-file source cache version instead of task payload version",
		"source_cache_key", sourceKey,
		"task_source_cache_version", requestedVersion,
		"redis_source_cache_version", currentVersion,
		"knowledge_base_code", input.KnowledgeBaseCode,
		"document_code", input.Code,
		"revectorize_source", input.RevectorizeSource,
	)
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
	// project-file notify 已经通过 SourceOverride 把稳定源内容传给同步任务。
	// 这里不再写入 sourceResolveCache；没有 Redis version 治理的裸 project key 容易被后续误用。
	return resolved, override, nil
}

func cachedResolvedSourceToSnapshot(cached *cachedResolvedSource) *documentdomain.ResolvedSourceSnapshot {
	if cached == nil {
		return nil
	}
	return documentdomain.BuildResolvedSourceSnapshot(documentdomain.SourceSnapshotInput{
		Content:      cached.Content,
		DocType:      cached.DocType,
		DocumentFile: cached.DocumentFile,
		// 从 cache 里拿出来的是底稿，先 clone 一份给当前请求用，
		// 避免后面的重同步链路继续加工 ParsedDocument 时把 cache 一起改脏。
		ParsedDocument:     parseddocument.CloneParsedDocument(cached.ParsedDocument),
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
		DocumentFile: documentdomain.CloneDocumentFilePayload(snapshot.DocumentFile),
		// 写进 cache 之前先断开引用，避免调用方后面继续改 snapshot 里的 ParsedDocument，
		// 把 cache 里的底稿也一起改脏。
		ParsedDocument: parseddocument.CloneParsedDocument(snapshot.ParsedDocument),
		Source:         snapshot.Source,
	}
}
