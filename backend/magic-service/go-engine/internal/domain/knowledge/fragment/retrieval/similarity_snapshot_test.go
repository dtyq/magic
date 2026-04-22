package retrieval_test

import (
	"reflect"
	"strconv"
	"strings"
	"testing"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	retrieval "magic/internal/domain/knowledge/fragment/retrieval"
	shared "magic/internal/domain/knowledge/shared"
)

func TestBuildCandidateAnalysisSnapshotMatchesLegacyHelpers(t *testing.T) {
	result := &fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
		ID:      "fragment-1",
		Score:   0.82,
		Content: "小哥 提到 录音 纪要 原文 显示 质量 问题，并建议优化录音质量与原文显示。",
		Payload: fragmodel.FragmentPayload{
			DocumentCode: "doc-1",
			DocumentName: "录音功能优化讨论.md",
			SectionTitle: "原文显示问题",
			SectionPath:  "录音功能优化讨论会议纪要 > 讨论要点及总结 > UI界面与交互体验优化",
			Metadata: map[string]any{
				retrieval.ParsedMetaTableTitle:        "录音问题汇总",
				retrieval.ParsedMetaPrimaryKeys:       []string{"问题"},
				retrieval.ParsedMetaPrimaryKeyHeaders: []string{"建议"},
				retrieval.ParsedMetaHeaderPaths:       []string{"问题 > 建议"},
			},
		},
	}

	snapshot := retrieval.BuildCandidateAnalysisSnapshotForTest(result)
	legacy := retrieval.BuildLegacyCandidateAnalysisForTest(result)

	if !reflect.DeepEqual(snapshot.FieldTexts, legacy.FieldTexts) {
		t.Fatalf("expected field texts to stay unchanged, got snapshot=%#v legacy=%#v", snapshot.FieldTexts, legacy.FieldTexts)
	}
	if !reflect.DeepEqual(snapshot.DocTokens, legacy.DocTokens) {
		t.Fatalf("expected doc tokens to stay unchanged, got snapshot=%#v legacy=%#v", snapshot.DocTokens, legacy.DocTokens)
	}
	if !reflect.DeepEqual(snapshot.SectionPathTokens, legacy.SectionPathTokens) {
		t.Fatalf("expected section path tokens to stay unchanged, got snapshot=%#v legacy=%#v", snapshot.SectionPathTokens, legacy.SectionPathTokens)
	}
	expectedFieldHits := filterRelevantFieldHits(legacy.FieldTokenHits)
	if !reflect.DeepEqual(snapshot.FieldTokenHits, expectedFieldHits) {
		t.Fatalf("expected field token hits to stay unchanged for matched fields, got snapshot=%#v legacy=%#v", snapshot.FieldTokenHits, expectedFieldHits)
	}

	query := "小哥对录音纪要提出了哪些问题"
	if got, want := retrieval.ComputeExactPhraseMatchScoreFromSnapshotForTest(query, snapshot), retrieval.ComputeExactPhraseMatchScoreForTest(query, result); got != want {
		t.Fatalf("expected exact phrase score to stay unchanged, got=%v want=%v", got, want)
	}
	if got, want := retrieval.ComputeSectionPathMatchScoreWithTokensForTest(query, result.Payload.SectionPath, snapshot.SectionPathTokens), retrieval.ComputeSectionPathMatchScoreForTest(query, result.Payload.SectionPath); got != want {
		t.Fatalf("expected section path score to stay unchanged, got=%v want=%v", got, want)
	}
}

func filterRelevantFieldHits(fieldHits map[string][]string) map[string][]string {
	result := make(map[string][]string, len(fieldHits))
	for field, tokens := range fieldHits {
		switch field {
		case "title", "path", "document_name", "table_title", "table_key", "header":
			result[field] = tokens
		}
	}
	return result
}

func BenchmarkScoreSimilarityResultsWithCandidateSnapshots(b *testing.B) {
	kb := &struct {
		RetrieveConfig *shared.RetrieveConfig
	}{
		RetrieveConfig: &shared.RetrieveConfig{RerankEnabled: true},
	}
	query := "小哥对录音纪要提出了哪些问题"

	for _, candidateCount := range []int{20, 50, 100} {
		b.Run(strings.Join([]string{"candidates", strconv.Itoa(candidateCount)}, "_"), func(b *testing.B) {
			results := buildBenchmarkSimilarityResults(candidateCount)
			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				_ = retrieval.ScoreSimilarityResultsForTest(query, results, kb, 10)
			}
		})
	}
}

func buildBenchmarkSimilarityResults(count int) []*fragmodel.VectorSearchResult[fragmodel.FragmentPayload] {
	results := make([]*fragmodel.VectorSearchResult[fragmodel.FragmentPayload], 0, count)
	for i := range count {
		results = append(results, &fragmodel.VectorSearchResult[fragmodel.FragmentPayload]{
			ID:    "fragment-" + strconv.Itoa(i),
			Score: 0.45 + float64(i%10)*0.03,
			Content: strings.Repeat(
				"录音功能优化讨论会议纪要，重点关注录音转文字、原文显示、笔记比例、UI 交互和上传质量问题。", 2,
			),
			Payload: fragmodel.FragmentPayload{
				DocumentCode: "doc-" + strconv.Itoa(i%8),
				DocumentName: "录音功能优化讨论.md",
				SectionTitle: "原文显示问题与录音质量",
				SectionPath:  "录音功能优化讨论会议纪要 > 讨论要点及总结 > UI界面与交互体验优化",
				Metadata: map[string]any{
					retrieval.ParsedMetaTableTitle:        "录音问题汇总",
					retrieval.ParsedMetaPrimaryKeys:       []string{"问题", "建议"},
					retrieval.ParsedMetaPrimaryKeyHeaders: []string{"负责人"},
					retrieval.ParsedMetaHeaderPaths:       []string{"问题 > 建议", "问题 > 负责人"},
				},
				KnowledgeCode: "kb",
			},
			Metadata: map[string]any{
				"dense_score":  0.42 + float64(i%7)*0.04,
				"sparse_score": 0.8 + float64(i%9)*0.35,
				"rrf_score":    0.2 + float64(i%5)*0.1,
			},
		})
	}
	return results
}
