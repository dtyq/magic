package fragdomain

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"maps"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
)

// DocumentFragmentAssembleInput 描述基于既有 chunk 组装持久化片段的输入。
type DocumentFragmentAssembleInput struct {
	Doc          *fragmodel.KnowledgeBaseDocument
	Chunks       []TokenChunk
	SplitVersion string
}

// AssembleDocumentFragments 基于既有 chunk 组装持久化片段。
func AssembleDocumentFragments(input DocumentFragmentAssembleInput) ([]*fragmodel.KnowledgeBaseFragment, error) {
	doc := fragmodel.SnapshotDocument(input.Doc)
	if doc == nil {
		return nil, nil
	}
	return assembleDocumentFragments(doc, input.Chunks, input.SplitVersion), nil
}

func assembleDocumentFragments(
	doc *fragmodel.KnowledgeBaseDocument,
	chunks []TokenChunk,
	splitVersion string,
) []*fragmodel.KnowledgeBaseFragment {
	createdAtUnix := time.Now().Unix()
	fragments := make([]*fragmodel.KnowledgeBaseFragment, 0, len(chunks))
	for index, chunk := range chunks {
		contentHash := hashFragmentContent(chunk.Content)
		chunkIdentityKey := buildFragmentChunkIdentityKey(contentHash, index)
		extraMetadata := map[string]any{
			"token_count":          chunk.TokenCount,
			"tree_node_id":         chunk.TreeNodeID,
			"parent_node_id":       chunk.ParentNodeID,
			"section_chunk_index":  chunk.SectionChunkIndex,
			"effective_split_mode": chunk.EffectiveSplitMode,
			"hierarchy_detector":   chunk.HierarchyDetector,
			"document_name":        doc.Name,
			"organization_code":    doc.OrganizationCode,
		}
		if len(chunk.Metadata) > 0 {
			maps.Copy(extraMetadata, chunk.Metadata)
		}
		maps.Copy(extraMetadata, documentSourceMetadata(doc))
		meta := fragmetadata.BuildFragmentSemanticMetadata(doc.DocMetadata, fragmetadata.FragmentSemanticMetadataDefaults{
			ChunkIndex:           index,
			ContentHash:          contentHash,
			SplitVersion:         splitVersion,
			RetrievalTextVersion: fragretrieval.RetrievalTextVersionV1,
			SectionPath:          chunk.SectionPath,
			SectionTitle:         chunk.SectionTitle,
			SectionLevel:         chunk.SectionLevel,
			CreatedAtTS:          createdAtUnix,
			DocumentCode:         doc.Code,
			DocumentType:         doc.DocType,
		}, extraMetadata)

		fragment := fragmodel.NewFragment(
			doc.KnowledgeBaseCode,
			doc.Code,
			chunk.Content,
			meta,
			doc.UpdatedUID,
		)
		fragment.OrganizationCode = doc.OrganizationCode
		fragment.DocumentName = doc.Name
		fragment.DocumentType = doc.DocType
		fragment.ChunkIndex = index
		fragment.ContentHash = contentHash
		fragment.SplitVersion = splitVersion
		fragment.SectionPath = chunk.SectionPath
		fragment.SectionTitle = chunk.SectionTitle
		fragment.SectionLevel = chunk.SectionLevel
		fragment.PointID = buildPointID(doc.KnowledgeBaseCode, doc.Code, chunkIdentityKey)
		fragments = append(fragments, fragment)
	}

	return fragments
}

func documentSourceMetadata(doc *fragmodel.KnowledgeBaseDocument) map[string]any {
	if doc == nil || doc.DocumentFile == nil {
		return nil
	}
	file := doc.DocumentFile
	sourceURL := strings.TrimSpace(file.URL)
	fileKey := downloadableDocumentFileKey(doc, file)
	sourceProvider := strings.TrimSpace(file.SourceType)
	if sourceProvider == "" {
		sourceProvider = strings.TrimSpace(doc.ThirdPlatformType)
	}
	thirdFileID := firstNonEmptyString(doc.ThirdFileID, file.ThirdID)
	sourceTitle := firstNonEmptyString(file.Name, doc.Name)

	metadata := map[string]any{}
	if sourceURL != "" {
		metadata["source_url"] = sourceURL
		metadata["url"] = sourceURL
	}
	if fileKey != "" {
		metadata["file_key"] = fileKey
	}
	if sourceProvider != "" {
		metadata["source_provider"] = sourceProvider
	}
	if thirdFileID != "" {
		metadata["third_file_id"] = thirdFileID
	}
	if sourceTitle != "" {
		metadata["source_title"] = sourceTitle
	}
	if len(metadata) == 0 {
		return nil
	}
	return metadata
}

func downloadableDocumentFileKey(doc *fragmodel.KnowledgeBaseDocument, file *fragmodel.DocumentFile) string {
	if file == nil {
		return ""
	}
	if fileKey := strings.TrimSpace(file.FileKey); fileKey != "" {
		return fileKey
	}
	sourceURL := strings.TrimSpace(file.URL)
	if sourceURL == "" || looksLikeExternalURL(sourceURL) {
		if !isThirdPlatformDocumentFile(file) {
			return ""
		}
		sourceType := firstNonEmptyString(file.SourceType, doc.ThirdPlatformType)
		thirdID := firstNonEmptyString(file.ThirdID, doc.ThirdFileID)
		if sourceType == "" || thirdID == "" {
			return ""
		}
		return "third_platform/" + url.PathEscape(sourceType) + "/" + url.PathEscape(thirdID)
	}
	return sourceURL
}

func isThirdPlatformDocumentFile(file *fragmodel.DocumentFile) bool {
	if file == nil {
		return false
	}
	switch strings.TrimSpace(strings.ToLower(file.Type)) {
	case "2", "third_platform", "third-platform", "thirdplatform":
		return true
	default:
		return false
	}
}

func looksLikeExternalURL(value string) bool {
	normalized := strings.ToLower(strings.TrimSpace(value))
	return strings.Contains(normalized, "://") || strings.HasPrefix(normalized, "//")
}

func buildFragmentChunkIdentityKey(contentHash string, chunkIndex int) string {
	return fmt.Sprintf("%s#%d", contentHash, chunkIndex)
}

// BuildChunkIdentityKey 根据内容哈希和 chunk 序号构造稳定 identity。
func BuildChunkIdentityKey(contentHash string, chunkIndex int) string {
	return buildFragmentChunkIdentityKey(contentHash, chunkIndex)
}

func buildPointID(knowledgeCode, documentCode, chunkIdentityKey string) string {
	raw := fmt.Sprintf("%s|%s|%s", knowledgeCode, documentCode, chunkIdentityKey)
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(raw)).String()
}

// BuildPointID 构造分片在向量库中的稳定点位 ID。
func BuildPointID(knowledgeCode, documentCode, chunkIdentityKey string) string {
	return buildPointID(knowledgeCode, documentCode, chunkIdentityKey)
}

func hashFragmentContent(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}
