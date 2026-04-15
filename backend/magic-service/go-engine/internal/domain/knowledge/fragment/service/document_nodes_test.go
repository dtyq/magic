package fragdomain_test

import (
	"strings"
	"testing"

	fragdomain "magic/internal/domain/knowledge/fragment/service"
)

func TestBuildDocumentNodesUsesCommonSectionRootAsTitle(t *testing.T) {
	t.Parallel()

	nodes := fragdomain.BuildDocumentNodes("录音功能优化讨论.md", []fragdomain.DocumentNodeSource{
		{
			Content:      "数据来源：前端将录音识别的文本实时写入文件",
			SectionPath:  "录音文本时间区间提取方案 > 背景 > 当前状态",
			SectionTitle: "当前状态",
		},
		{
			Content:      "前端痛点：需要定位某一时刻的录音文字",
			SectionPath:  "录音文本时间区间提取方案 > 背景 > 存在问题",
			SectionTitle: "存在问题",
		},
	})

	if len(nodes) < 5 {
		t.Fatalf("expected structured nodes, got %#v", nodes)
	}
	if nodes[0].Type != "title" || nodes[0].Text != "录音文本时间区间提取方案" {
		t.Fatalf("unexpected root node: %#v", nodes[0])
	}
	if nodes[1].Type != "section-title" || nodes[1].Text != "背景" || nodes[1].Parent != 0 {
		t.Fatalf("unexpected first section node: %#v", nodes[1])
	}
}

func TestBuildDocumentNodesFallsBackToFlatTextNodes(t *testing.T) {
	t.Parallel()

	nodes := fragdomain.BuildDocumentNodes("demo.md", []fragdomain.DocumentNodeSource{
		{Content: "第一段"},
		{Content: "第二段"},
	})

	if len(nodes) != 3 {
		t.Fatalf("expected root plus two text nodes, got %#v", nodes)
	}
	if nodes[0].Text != "demo" {
		t.Fatalf("expected file title fallback, got %#v", nodes[0])
	}
	if nodes[1].Parent != 0 || nodes[1].Type != "section-text" {
		t.Fatalf("unexpected first text node: %#v", nodes[1])
	}
}

func TestBuildDocumentNodesKeepsThreeLevelHierarchyShape(t *testing.T) {
	t.Parallel()

	nodes := fragdomain.BuildDocumentNodes("录音文本时间区间提取方案.md", []fragdomain.DocumentNodeSource{
		{
			Content:      "# 录音文本时间区间提取方案\n## 背景\n### 当前状态\n数据来源：前端将录音识别的文本实时写入文件",
			SectionPath:  "录音文本时间区间提取方案 > 背景 > 当前状态",
			SectionTitle: "当前状态",
			SectionLevel: 3,
			TreeNodeID:   "current",
			ParentNodeID: "background",
		},
		{
			Content:      "# 录音文本时间区间提取方案\n## 背景\n### 存在问题\n前端痛点：需要定位某一时刻的录音文字",
			SectionPath:  "录音文本时间区间提取方案 > 背景 > 存在问题",
			SectionTitle: "存在问题",
			SectionLevel: 3,
			TreeNodeID:   "problem",
			ParentNodeID: "background",
		},
		{
			Content:      "# 录音文本时间区间提取方案\n## 🎯 需求分析\n### 核心需求\n时间区间查询：根据时间区间提取对应的文本内容",
			SectionPath:  "录音文本时间区间提取方案 > 🎯 需求分析 > 核心需求",
			SectionTitle: "核心需求",
			SectionLevel: 3,
			TreeNodeID:   "core",
			ParentNodeID: "requirements",
		},
		{
			Content: "# 录音文本时间区间提取方案\n## 💡 解决方案对比\n### 方案一：纯文本 + 独立索引文件\n" +
				"#### 方案概述\n保持现有纯文本格式不变，新增一个独立的索引文件。\n\n" +
				"#### 文件结构\nrecording_123.txt\nrecording_123.index.json",
			SectionPath:  "录音文本时间区间提取方案 > 💡 解决方案对比 > 方案一：纯文本 + 独立索引文件",
			SectionTitle: "方案一：纯文本 + 独立索引文件",
			SectionLevel: 3,
			TreeNodeID:   "solution-1",
			ParentNodeID: "solutions",
		},
	})

	assertDocumentNode(t, nodes, expectedDocumentNode{ID: 0, Parent: -1, Text: "录音文本时间区间提取方案", Level: -1, Type: "title", Children: []int{1, 6, 9}})
	assertDocumentNode(t, nodes, expectedDocumentNode{ID: 1, Parent: 0, Text: "背景", Level: 0, Type: "section-title", Children: []int{2, 4}})
	assertDocumentNode(t, nodes, expectedDocumentNode{ID: 2, Parent: 1, Text: "当前状态", Level: 1, Type: "section-title", Children: []int{3}})
	assertDocumentNode(t, nodes, expectedDocumentNode{ID: 3, Parent: 2, Text: "数据来源：前端将录音识别的文本实时写入文件", Level: -1, Type: "section-text", Children: []int{}})
	assertDocumentNode(t, nodes, expectedDocumentNode{ID: 4, Parent: 1, Text: "存在问题", Level: 1, Type: "section-title", Children: []int{5}})
	assertDocumentNode(t, nodes, expectedDocumentNode{ID: 6, Parent: 0, Text: "🎯 需求分析", Level: 0, Type: "section-title", Children: []int{7}})
	assertDocumentNode(t, nodes, expectedDocumentNode{ID: 7, Parent: 6, Text: "核心需求", Level: 1, Type: "section-title", Children: []int{8}})
	assertDocumentNode(t, nodes, expectedDocumentNode{ID: 9, Parent: 0, Text: "💡 解决方案对比", Level: 0, Type: "section-title", Children: []int{10}})
	assertDocumentNode(t, nodes, expectedDocumentNode{ID: 10, Parent: 9, Text: "方案一：纯文本 + 独立索引文件", Level: 1, Type: "section-title", Children: []int{11}})
	assertDocumentNode(t, nodes, expectedDocumentNode{ID: 11, Parent: 10, Text: "#### 方案概述\n保持现有纯文本格式不变，新增一个独立的索引文件。\n\n#### 文件结构\nrecording_123.txt\nrecording_123.index.json", Level: -1, Type: "section-text", Children: []int{}})
}

func TestBuildDocumentNodesSortsSourcesByChunkIndex(t *testing.T) {
	t.Parallel()

	nodes := fragdomain.BuildDocumentNodes("录音文本时间区间提取方案.md", []fragdomain.DocumentNodeSource{
		{
			Content:       "## 📊 方案对比总结\n对比表格",
			SectionPath:   "录音文本时间区间提取方案 > 📊 方案对比总结",
			SectionTitle:  "📊 方案对比总结",
			SectionLevel:  2,
			ChunkIndex:    7,
			HasChunkIndex: true,
		},
		{
			Content:       "# 录音文本时间区间提取方案\n## 📋 背景\n### 当前状态\n- 数据来源：前端将录音识别的文本实时写入文件",
			SectionPath:   "录音文本时间区间提取方案 > 📋 背景 > 当前状态",
			SectionTitle:  "当前状态",
			SectionLevel:  3,
			ChunkIndex:    0,
			HasChunkIndex: true,
		},
		{
			Content:       "# 录音文本时间区间提取方案\n## 🎯 需求分析\n### 核心需求\n- 时间区间查询：根据时间区间提取对应的文本内容",
			SectionPath:   "录音文本时间区间提取方案 > 🎯 需求分析 > 核心需求",
			SectionTitle:  "核心需求",
			SectionLevel:  3,
			ChunkIndex:    2,
			HasChunkIndex: true,
		},
	})

	assertNodeChildTexts(t, nodes, 0, []string{"📋 背景", "🎯 需求分析", "📊 方案对比总结"})

	backgroundID := findNodeByText(t, nodes, "📋 背景")
	assertNodeChildTexts(t, nodes, backgroundID, []string{"当前状态"})

	requirementID := findNodeByText(t, nodes, "🎯 需求分析")
	assertNodeChildTexts(t, nodes, requirementID, []string{"核心需求"})
}

func TestBuildDocumentNodesKeepsContinuationChunksAsSiblingCards(t *testing.T) {
	t.Parallel()

	nodes := fragdomain.BuildDocumentNodes("录音功能优化会议纪要.md", []fragdomain.DocumentNodeSource{
		{
			Content: "# 录音功能优化会议纪要\n## 讨论要点\n### 产品体验问题\n#### 1.5 新建项目流程不顺畅\n" +
				"- **问题**: 用户预期在工作区内自动创建项目，但实际需要手动新建\n" +
				"- **建议**: 优化新建项目流程，支持在工作区内自动创建",
			SectionPath:       "录音功能优化会议纪要 > 讨论要点 > 产品体验问题",
			SectionTitle:      "产品体验问题",
			SectionLevel:      3,
			ChunkIndex:        0,
			HasChunkIndex:     true,
			SectionChunkIndex: 0,
			HasSectionChunk:   true,
		},
		{
			Content: "# 录音功能优化会议纪要\n## 讨论要点\n### 产品体验问题\n#### 1.5 新建项目流程不顺畅\n" +
				"- **讨论记录**:\n" +
				"- 陈曹奇昊：\"我直接提了一些给佳博\"",
			SectionPath:       "录音功能优化会议纪要 > 讨论要点 > 产品体验问题",
			SectionTitle:      "产品体验问题",
			SectionLevel:      3,
			ChunkIndex:        1,
			HasChunkIndex:     true,
			SectionChunkIndex: 1,
			HasSectionChunk:   true,
		},
	})

	if got := countNodesByText(nodes, "1.5 新建项目流程不顺畅"); got != 0 {
		t.Fatalf("expected continuation heading to stay inside text cards, got %d in %#v", got, nodes)
	}

	nodeID := findNodeByText(t, nodes, "产品体验问题")
	if len(nodes[nodeID].Children) != 2 {
		t.Fatalf("expected one database fragment to map to one text card, got %#v", nodes[nodeID])
	}
	for _, childID := range nodes[nodeID].Children {
		if nodes[childID].Type != "section-text" {
			t.Fatalf("expected continuation children to stay as text cards, got %#v", nodes[childID])
		}
	}
	if !nodeChildrenContainText(nodes, nodeID, "我直接提了一些给佳博") {
		t.Fatalf("expected continuation card content preserved, got %#v", nodes[nodeID])
	}
}

type expectedDocumentNode struct {
	ID       int
	Parent   int
	Text     string
	Level    int
	Type     string
	Children []int
}

func assertDocumentNode(t *testing.T, nodes []fragdomain.DocumentNode, expected expectedDocumentNode) {
	t.Helper()
	if expected.ID >= len(nodes) {
		t.Fatalf("expected node %d in %#v", expected.ID, nodes)
	}
	node := nodes[expected.ID]
	if node.ID != expected.ID || node.Parent != expected.Parent || node.Text != expected.Text || node.Level != expected.Level || node.Type != expected.Type {
		t.Fatalf("unexpected node %d: %#v", expected.ID, node)
	}
	if len(node.Children) != len(expected.Children) {
		t.Fatalf("unexpected children for node %d: want %#v got %#v", expected.ID, expected.Children, node.Children)
	}
	for i, child := range expected.Children {
		if node.Children[i] != child {
			t.Fatalf("unexpected child %d for node %d: want %#v got %#v", i, expected.ID, expected.Children, node.Children)
		}
	}
}

func findNodeByText(t *testing.T, nodes []fragdomain.DocumentNode, text string) int {
	t.Helper()
	for _, node := range nodes {
		if node.Text == text {
			return node.ID
		}
	}
	t.Fatalf("node %q not found in %#v", text, nodes)
	return -1
}

func assertNodeChildTexts(t *testing.T, nodes []fragdomain.DocumentNode, parentID int, want []string) {
	t.Helper()
	if parentID < 0 || parentID >= len(nodes) {
		t.Fatalf("parent %d out of range in %#v", parentID, nodes)
	}
	got := make([]string, 0, len(nodes[parentID].Children))
	for _, childID := range nodes[parentID].Children {
		if childID < 0 || childID >= len(nodes) {
			t.Fatalf("child %d out of range in %#v", childID, nodes)
		}
		got = append(got, nodes[childID].Text)
	}
	if len(got) != len(want) {
		t.Fatalf("unexpected child count for node %d: want %#v got %#v", parentID, want, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("unexpected child order for node %d: want %#v got %#v", parentID, want, got)
		}
	}
}

func countNodesByText(nodes []fragdomain.DocumentNode, text string) int {
	count := 0
	for _, node := range nodes {
		if node.Text == text {
			count++
		}
	}
	return count
}

func nodeChildrenContainText(nodes []fragdomain.DocumentNode, parentID int, target string) bool {
	if parentID < 0 || parentID >= len(nodes) {
		return false
	}
	for _, childID := range nodes[parentID].Children {
		if childID < 0 || childID >= len(nodes) {
			continue
		}
		if strings.Contains(nodes[childID].Text, target) {
			return true
		}
	}
	return false
}
