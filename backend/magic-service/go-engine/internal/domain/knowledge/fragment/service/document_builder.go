package fragdomain

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"maps"
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
