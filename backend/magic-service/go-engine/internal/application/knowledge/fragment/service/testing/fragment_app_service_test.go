package fragapp_test

import (
	"testing"

	service "magic/internal/application/knowledge/fragment/service"
	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
)

func TestFormatFragmentDisplayContent_SkipsDuplicatedSectionTitle(t *testing.T) {
	t.Parallel()

	content := "## 基本信息\n正文"
	sectionPath := "录音功能优化讨论会议纪要 > 基本信息"
	sectionTitle := "基本信息"

	got := fragmetadata.BuildFragmentDisplayContent(content, nil, sectionPath, sectionTitle)
	want := "录音功能优化讨论会议纪要 > 基本信息\n\n## 基本信息\n正文"
	if got != want {
		t.Fatalf("unexpected display content:\nwant: %q\ngot:  %q", want, got)
	}
}

func TestFormatFragmentDisplayContent_AppendsSectionTitleWhenPathMissingIt(t *testing.T) {
	t.Parallel()

	content := "正文"
	sectionPath := "会议纪要 > 讨论要点及总结"
	sectionTitle := "1.1 录音转文字界面布局"

	got := fragmetadata.BuildFragmentDisplayContent(content, nil, sectionPath, sectionTitle)
	want := "会议纪要 > 讨论要点及总结\n\n1.1 录音转文字界面布局\n\n正文"
	if got != want {
		t.Fatalf("unexpected display content:\nwant: %q\ngot:  %q", want, got)
	}
}

func TestBuildSimilarityDisplayContent_UsesContextSectionPathAndCountsRunes(t *testing.T) {
	t.Parallel()

	got, wordCount := service.BuildSimilarityDisplayContentForTest("命中正文\n\n邻接正文", map[string]any{
		"context_section_path": "会议纪要 > 讨论要点 > 1.14 原文显示问题",
		"section_path":         "会议纪要 > 讨论要点",
		"section_title":        "1.14 原文显示问题",
	})
	want := "会议纪要 > 讨论要点 > 1.14 原文显示问题\n\n命中正文\n\n邻接正文"
	if got != want {
		t.Fatalf("unexpected display content:\nwant: %q\ngot:  %q", want, got)
	}
	if wordCount != len([]rune(want)) {
		t.Fatalf("unexpected word count: want %d, got %d", len([]rune(want)), wordCount)
	}
}

func TestBuildSimilarityDisplayContent_FallsBackToRawContentWithoutSection(t *testing.T) {
	t.Parallel()

	got, wordCount := service.BuildSimilarityDisplayContentForTest("纯正文", nil)
	if got != "纯正文" {
		t.Fatalf("unexpected display content: %q", got)
	}
	if wordCount != len([]rune("纯正文")) {
		t.Fatalf("unexpected word count: %d", wordCount)
	}
}
