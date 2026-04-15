package splitter

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/tokenizer"
)

const (
	hierarchyDefaultMaxLevel = 3
	hierarchyMinLevel        = 1
	hierarchyMaxLevel        = 6
	hierarchyChunkMaxTokens  = 1000

	splitModeHierarchyAuto  = "hierarchy_auto"
	splitModeNormal         = "normal"
	splitModeNormalFallback = "normal_fallback"

	hierarchyDetectorMarkdownAST   = "markdown_ast"
	hierarchyDetectorDocxStyle     = "docx_style"
	hierarchyDetectorRegexFallback = "regex_fallback"
)

var (
	hierarchyMarkdownHeadingRegex = regexp.MustCompile(`^\s{0,3}(#{1,6})\s+(.+?)\s*$`)
	hierarchyNumericHeadingRegex  = regexp.MustCompile(`^\s*(\d+(?:\.\d+){0,5})[.)]?\s+(.+?)\s*$`)
	hierarchyChineseHeadingRegex  = regexp.MustCompile(`^\s*第[一二三四五六七八九十百千万零〇两0-9]+([章节篇部卷条])\s*(.+)?$`)
	hierarchySetextH1Regex        = regexp.MustCompile(`^\s*=+\s*$`)
	hierarchySetextH2Regex        = regexp.MustCompile(`^\s*-+\s*$`)
)

type splitModeResolution struct {
	RequestedMode      shared.FragmentMode
	EffectiveMode      shared.FragmentMode
	EffectiveSplitMode string
	HierarchyDetected  bool
	HierarchyDetector  string
}

type hierarchyHeading struct {
	StartLine      int
	HeadingEndLine int
	Level          int
	Title          string
}

type hierarchyNode struct {
	Heading        hierarchyHeading
	EffectiveLevel int
	Parent         *hierarchyNode
	HasChildren    bool
	Path           string
	NodeID         string
	ParentNodeID   string
	Content        string
	Segments       []hierarchyOwnedSegment
}

type hierarchyOwnedSegment struct {
	Content      string
	HeadingTitle string
	HasChildren  bool
}

type hierarchySplitConfig struct {
	MaxLevel           int
	TextPreprocessRule []int
}

type autoSplitPipelineInput struct {
	Content             string
	SourceFileType      string
	RequestedMode       shared.FragmentMode
	FragmentConfig      *shared.FragmentConfig
	NormalSegmentConfig previewSegmentConfig
	Model               string
	TokenizerService    *tokenizer.Service
	Logger              *logging.SugaredLogger
}

type hierarchyPipelineInput struct {
	Content          string
	Headings         []hierarchyHeading
	Config           hierarchySplitConfig
	Model            string
	TokenizerService *tokenizer.Service
	Logger           *logging.SugaredLogger
}

func splitContentWithEffectiveModePipeline(
	ctx context.Context,
	input autoSplitPipelineInput,
) ([]tokenChunk, splitModeResolution, error) {
	requestedMode := normalizeRequestedMode(input.RequestedMode)
	resolution := splitModeResolution{
		RequestedMode: requestedMode,
		EffectiveMode: shared.FragmentModeCustom,
	}

	if requestedMode != shared.FragmentModeCustom {
		detection := resolveHierarchyDetection(input.Content, input.SourceFileType)
		headings := detection.Headings
		resolution.HierarchyDetector = detection.Detector
		hierarchyDetected, _ := evaluateHierarchy(headings)
		if hierarchyDetected {
			hierarchyCfg := resolveHierarchyConfig(input.FragmentConfig, input.NormalSegmentConfig.TextPreprocessRule)
			chunks, err := splitContentByHierarchyPipeline(hierarchyPipelineInput{
				Content:          input.Content,
				Headings:         headings,
				Config:           hierarchyCfg,
				Model:            input.Model,
				TokenizerService: input.TokenizerService,
				Logger:           input.Logger,
			})
			if err != nil {
				return nil, resolution, err
			}
			resolution.EffectiveMode = shared.FragmentModeHierarchy
			resolution.EffectiveSplitMode = splitModeHierarchyAuto
			resolution.HierarchyDetected = true
			for i := range chunks {
				chunks[i].EffectiveSplitMode = splitModeHierarchyAuto
				chunks[i].HierarchyDetector = resolution.HierarchyDetector
			}
			logResolvedSplitMode(ctx, input.Logger, resolution)
			return chunks, resolution, nil
		}
	}

	chunks, err := splitContentByTokenPipeline(
		ctx,
		input.Content,
		input.NormalSegmentConfig,
		input.Model,
		input.TokenizerService,
		input.Logger,
	)
	if err != nil {
		return nil, resolution, err
	}
	resolution.HierarchyDetected = false
	resolution.EffectiveMode = shared.FragmentModeCustom
	if requestedMode == shared.FragmentModeHierarchy {
		resolution.EffectiveSplitMode = splitModeNormalFallback
	} else {
		resolution.EffectiveSplitMode = splitModeNormal
	}

	for i := range chunks {
		chunks[i].EffectiveSplitMode = resolution.EffectiveSplitMode
		chunks[i].HierarchyDetector = resolution.HierarchyDetector
	}
	logResolvedSplitMode(ctx, input.Logger, resolution)
	return chunks, resolution, nil
}

func splitContentByHierarchyPipeline(input hierarchyPipelineInput) ([]tokenChunk, error) {
	nodes, preface := buildHierarchyNodes(input.Content, input.Headings, input.Config.MaxLevel)
	chunks := make([]tokenChunk, 0, max(1, len(nodes)))

	if strings.TrimSpace(preface) != "" {
		prefaceNodeID := hashText("hierarchy:preface")
		prefaceChunks, err := splitHierarchyOwnedSegmentToChunks(
			nil,
			hierarchyOwnedSegment{Content: preface},
			input.Config.TextPreprocessRule,
			input.Model,
			input.TokenizerService,
		)
		if err != nil {
			return nil, fmt.Errorf("split hierarchy preface: %w", err)
		}
		for index, chunk := range prefaceChunks {
			chunk.SectionChunkIndex = index
			chunk.SectionLevel = 0
			chunk.TreeNodeID = prefaceNodeID
			chunk.EffectiveSplitMode = splitModeHierarchyAuto
			chunks = append(chunks, chunk)
		}
	}

	for _, node := range nodes {
		sectionChunkIndex := 0
		for _, segment := range node.Segments {
			segmentChunks, err := splitHierarchyOwnedSegmentToChunks(
				node,
				segment,
				input.Config.TextPreprocessRule,
				input.Model,
				input.TokenizerService,
			)
			if err != nil {
				return nil, fmt.Errorf("split hierarchy node: %w", err)
			}
			for _, chunk := range segmentChunks {
				chunk.SectionPath = node.Path
				chunk.SectionLevel = node.EffectiveLevel
				chunk.SectionTitle = node.Heading.Title
				chunk.TreeNodeID = node.NodeID
				chunk.ParentNodeID = node.ParentNodeID
				chunk.SectionChunkIndex = sectionChunkIndex
				chunk.EffectiveSplitMode = splitModeHierarchyAuto
				chunks = append(chunks, chunk)
				sectionChunkIndex++
			}
		}
	}

	return chunks, nil
}

func buildHierarchyChunkContent(content string, textPreprocessRule []int) string {
	preRules, needPostReplaceWhitespace := SplitPreviewPreprocessRules(textPreprocessRule)
	processed := ApplyPreviewPreprocess(content, preRules)
	if needPostReplaceWhitespace {
		processed = ApplyPreviewReplaceWhitespace(processed)
	}
	return strings.TrimSpace(processed)
}

func countHierarchyChunkTokens(content, model string, tokenizerService *tokenizer.Service) (int, error) {
	if strings.TrimSpace(content) == "" {
		return 0, nil
	}
	encoder, err := tokenizerService.EncoderForModel(model)
	if err != nil {
		return 0, fmt.Errorf("resolve hierarchy tokenizer encoder: %w", err)
	}
	return encoder.CountTokens(content), nil
}

func splitHierarchyOwnedSegmentToChunks(
	node *hierarchyNode,
	segment hierarchyOwnedSegment,
	textPreprocessRule []int,
	model string,
	tokenizerService *tokenizer.Service,
) ([]tokenChunk, error) {
	headingLine, body := splitHierarchyHeadingAndBody(segment.Content)
	if strings.TrimSpace(body) == "" && segment.HasChildren {
		return nil, nil
	}

	prefix := buildHierarchyChunkContent(buildHierarchyOwnedSegmentPrefix(node, headingLine), textPreprocessRule)
	bodyContent := buildHierarchyChunkContent(body, textPreprocessRule)
	content := joinHierarchyChunkPrefixAndBody(prefix, bodyContent)
	if content == "" {
		return nil, nil
	}

	tokenCount, err := countHierarchyChunkTokens(content, model, tokenizerService)
	if err != nil {
		return nil, err
	}
	if tokenCount <= hierarchyChunkMaxTokens {
		return []tokenChunk{{
			Content:    content,
			TokenCount: tokenCount,
		}}, nil
	}

	encoder, err := tokenizerService.EncoderForModel(model)
	if err != nil {
		return nil, fmt.Errorf("resolve hierarchy overflow tokenizer encoder: %w", err)
	}
	if prefix == "" {
		return splitHierarchyPlainOverflowContent(content, encoder), nil
	}

	prefixWithSeparator := prefix
	if bodyContent != "" {
		prefixWithSeparator += "\n"
	}
	prefixTokenCount := encoder.CountTokens(prefixWithSeparator)
	if prefixTokenCount <= 0 || prefixTokenCount >= hierarchyChunkMaxTokens {
		return splitHierarchyPlainOverflowContent(content, encoder), nil
	}

	bodyTokens := encoder.Encode(bodyContent)
	if len(bodyTokens) == 0 {
		return []tokenChunk{{
			Content:    prefix,
			TokenCount: encoder.CountTokens(prefix),
		}}, nil
	}

	windowSize := hierarchyChunkMaxTokens - prefixTokenCount
	results := make([]tokenChunk, 0, max(1, len(bodyTokens)/max(1, windowSize)+1))
	for start := 0; start < len(bodyTokens); {
		maxEnd := min(len(bodyTokens), start+windowSize)
		bodyWindow, end := decodeHierarchyValidUTF8TokenWindow(encoder, bodyTokens, start, maxEnd)
		if end <= start {
			break
		}
		bodyChunk := strings.TrimLeft(bodyWindow, "\n")
		chunkContent := joinHierarchyChunkPrefixAndBody(prefix, bodyChunk)
		if chunkContent == "" {
			start = end
			continue
		}
		results = append(results, tokenChunk{
			Content:    chunkContent,
			TokenCount: encoder.CountTokens(chunkContent),
		})
		start = end
	}
	return results, nil
}

func buildHierarchyOwnedSegmentPrefix(node *hierarchyNode, headingLine string) string {
	if node == nil {
		return strings.TrimSpace(headingLine)
	}

	chain := hierarchyNodeChain(node)
	segmentTitle := resolveHierarchyHeadingLineTitle(headingLine)
	ownerTitle := strings.TrimSpace(node.Heading.Title)
	lines := make([]string, 0, len(chain)+1)

	for _, current := range chain {
		if current == nil {
			continue
		}
		if current == node && segmentTitle != "" && segmentTitle == ownerTitle {
			break
		}
		lines = append(lines, formatHierarchyHeadingLine(current.Heading.Level, current.Heading.Title))
	}
	if trimmedHeading := strings.TrimSpace(headingLine); trimmedHeading != "" {
		lines = append(lines, trimmedHeading)
	} else if len(chain) > 0 {
		lines = append(lines, formatHierarchyHeadingLine(node.Heading.Level, node.Heading.Title))
	}

	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func hierarchyNodeChain(node *hierarchyNode) []*hierarchyNode {
	if node == nil {
		return nil
	}
	reversed := make([]*hierarchyNode, 0, hierarchyMaxLevel)
	for current := node; current != nil; current = current.Parent {
		reversed = append(reversed, current)
	}
	chain := make([]*hierarchyNode, 0, len(reversed))
	for i := len(reversed) - 1; i >= 0; i-- {
		chain = append(chain, reversed[i])
	}
	return chain
}

func resolveHierarchyHeadingLineTitle(line string) string {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return ""
	}
	if _, title, ok := parseMarkdownHeading(trimmed); ok {
		return title
	}
	if _, title, ok := parseNumericHeading(trimmed); ok {
		return title
	}
	if _, title, ok := parseChineseHeading(trimmed); ok {
		return title
	}
	return trimmed
}

func formatHierarchyHeadingLine(level int, title string) string {
	trimmedTitle := strings.TrimSpace(title)
	if trimmedTitle == "" {
		return ""
	}
	return strings.Repeat("#", clampHierarchyLevel(level)) + " " + trimmedTitle
}

func joinHierarchyChunkPrefixAndBody(prefix, body string) string {
	trimmedPrefix := strings.TrimSpace(prefix)
	trimmedBody := strings.TrimSpace(body)
	switch {
	case trimmedPrefix == "":
		return trimmedBody
	case trimmedBody == "":
		return trimmedPrefix
	default:
		return trimmedPrefix + "\n" + trimmedBody
	}
}

func splitHierarchyPlainOverflowContent(content string, encoder *tokenizer.Encoder) []tokenChunk {
	tokens := encoder.Encode(content)
	if len(tokens) == 0 {
		return nil
	}
	results := make([]tokenChunk, 0, max(1, len(tokens)/hierarchyChunkMaxTokens+1))
	for start := 0; start < len(tokens); {
		maxEnd := min(len(tokens), start+hierarchyChunkMaxTokens)
		window, end := decodeHierarchyValidUTF8TokenWindow(encoder, tokens, start, maxEnd)
		if end <= start {
			break
		}
		chunkContent := strings.TrimSpace(window)
		if chunkContent == "" {
			start = end
			continue
		}
		results = append(results, tokenChunk{
			Content:    chunkContent,
			TokenCount: encoder.CountTokens(chunkContent),
		})
		start = end
	}
	return results
}

func decodeHierarchyValidUTF8TokenWindow(
	encoder *tokenizer.Encoder,
	tokens []int,
	start, maxEnd int,
) (string, int) {
	if encoder == nil || start < 0 || start >= len(tokens) {
		return "", start
	}

	end := min(len(tokens), maxEnd)
	for ; end > start; end-- {
		decoded := encoder.Decode(tokens[start:end])
		if utf8.ValidString(decoded) {
			return decoded, end
		}
	}

	sanitized := strings.ToValidUTF8(encoder.Decode(tokens[start:min(len(tokens), maxEnd)]), "")
	if sanitized == "" {
		return "", start
	}
	return sanitized, min(len(tokens), maxEnd)
}

func splitHierarchyHeadingAndBody(content string) (string, string) {
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	firstContentLine := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		firstContentLine = i
		break
	}
	if firstContentLine < 0 {
		return "", ""
	}
	line := lines[firstContentLine]
	if _, _, ok := parseMarkdownHeading(strings.TrimSpace(line)); !ok {
		if _, _, ok = parseNumericHeading(strings.TrimSpace(line)); !ok {
			if _, _, ok = parseChineseHeading(strings.TrimSpace(line)); !ok {
				return "", content
			}
		}
	}
	body := strings.Join(lines[firstContentLine+1:], "\n")
	return strings.TrimSpace(line), body
}

func logResolvedSplitMode(ctx context.Context, logger *logging.SugaredLogger, resolution splitModeResolution) {
	if logger == nil {
		return
	}
	logger.InfoContext(ctx, "Resolved split mode",
		"requested_mode", resolution.RequestedMode,
		"effective_mode", resolution.EffectiveMode,
		"effective_split_mode", resolution.EffectiveSplitMode,
		"hierarchy_detected", resolution.HierarchyDetected,
		"hierarchy_detector", resolution.HierarchyDetector,
	)
}

func resolveHierarchyConfig(fragmentConfig *shared.FragmentConfig, fallbackPreRules []int) hierarchySplitConfig {
	cfg := hierarchySplitConfig{
		MaxLevel:           hierarchyDefaultMaxLevel,
		TextPreprocessRule: append([]int(nil), fallbackPreRules...),
	}
	if fragmentConfig != nil && fragmentConfig.Hierarchy != nil {
		cfg.TextPreprocessRule = append([]int(nil), fragmentConfig.Hierarchy.TextPreprocessRule...)
		if fragmentConfig.Hierarchy.MaxLevel > 0 {
			cfg.MaxLevel = clampHierarchyLevel(fragmentConfig.Hierarchy.MaxLevel)
			return cfg
		}
	}
	return cfg
}

func buildHierarchyNodes(content string, headings []hierarchyHeading, maxLevel int) ([]*hierarchyNode, string) {
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	if len(headings) == 0 {
		return nil, strings.TrimSpace(content)
	}

	maxAllowedLevel := clampHierarchyLevel(maxLevel)
	nodes := buildHierarchyTree(normalizeHierarchyHeadings(headings))
	assignHierarchyNodeMetadata(nodes)
	assignHierarchyNodeEffectiveLevels(nodes)
	assignHierarchyNodeContent(lines, nodes, maxAllowedLevel)
	return collectKeptHierarchyNodes(nodes, maxAllowedLevel), extractHierarchyPreface(lines, nodes)
}

func resolveHierarchyContentOwner(node *hierarchyNode, maxAllowedLevel int) *hierarchyNode {
	for current := node; current != nil; current = current.Parent {
		if current.EffectiveLevel <= maxAllowedLevel {
			return current
		}
	}
	return nil
}

func normalizeHierarchyHeadings(headings []hierarchyHeading) []hierarchyHeading {
	normalized := make([]hierarchyHeading, 0, len(headings))
	for _, heading := range headings {
		heading.Level = clampHierarchyLevel(heading.Level)
		normalized = append(normalized, heading)
	}
	return normalized
}

func buildHierarchyTree(headings []hierarchyHeading) []*hierarchyNode {
	nodes := make([]*hierarchyNode, 0, len(headings))
	stack := make([]*hierarchyNode, 0, hierarchyMaxLevel)
	for _, heading := range headings {
		node := &hierarchyNode{Heading: heading}
		for len(stack) > 0 && stack[len(stack)-1].Heading.Level >= heading.Level {
			stack = stack[:len(stack)-1]
		}
		if len(stack) > 0 {
			node.Parent = stack[len(stack)-1]
			node.Parent.HasChildren = true
		}
		nodes = append(nodes, node)
		stack = append(stack, node)
	}
	return nodes
}

func assignHierarchyNodeMetadata(nodes []*hierarchyNode) {
	for i, node := range nodes {
		title := strings.TrimSpace(node.Heading.Title)
		switch {
		case node.Parent == nil:
			node.Path = title
		case node.Parent.Path == "":
			node.Path = title
		default:
			node.Path = node.Parent.Path + " > " + title
		}
		node.NodeID = hashText(fmt.Sprintf("hierarchy:%s:%d:%d", node.Path, node.Heading.Level, i))
		if node.Parent != nil {
			node.ParentNodeID = node.Parent.NodeID
		}
	}
}

func assignHierarchyNodeEffectiveLevels(nodes []*hierarchyNode) {
	baseLevel := resolveHierarchyRootTitleBaseLevel(nodes)
	for _, node := range nodes {
		if node == nil {
			continue
		}
		node.EffectiveLevel = resolveHierarchyEffectiveLevel(node.Heading.Level, baseLevel)
	}
}

func resolveHierarchyRootTitleBaseLevel(nodes []*hierarchyNode) int {
	rootNodes := make([]*hierarchyNode, 0, 2)
	for _, node := range nodes {
		if node == nil || node.Parent != nil {
			continue
		}
		rootNodes = append(rootNodes, node)
	}
	if len(rootNodes) != 1 {
		return 0
	}

	root := rootNodes[0]
	if root.Heading.Level != hierarchyMinLevel || !root.HasChildren {
		return 0
	}
	return root.Heading.Level
}

func resolveHierarchyEffectiveLevel(rawLevel, baseLevel int) int {
	clampedLevel := clampHierarchyLevel(rawLevel)
	if baseLevel <= 0 {
		return clampedLevel
	}
	return max(0, clampedLevel-baseLevel)
}

func assignHierarchyNodeContent(lines []string, nodes []*hierarchyNode, maxAllowedLevel int) {
	segmentsByOwner := collectHierarchySegments(lines, nodes, maxAllowedLevel)
	for _, node := range nodes {
		node.Segments = append([]hierarchyOwnedSegment(nil), segmentsByOwner[node]...)
		contents := make([]string, 0, len(node.Segments))
		for _, segment := range node.Segments {
			if strings.TrimSpace(segment.Content) == "" {
				continue
			}
			contents = append(contents, segment.Content)
		}
		node.Content = strings.TrimSpace(strings.Join(contents, "\n"))
	}
}

func collectHierarchySegments(lines []string, nodes []*hierarchyNode, maxAllowedLevel int) map[*hierarchyNode][]hierarchyOwnedSegment {
	segmentsByOwner := make(map[*hierarchyNode][]hierarchyOwnedSegment, len(nodes))
	for i, node := range nodes {
		segment := hierarchyNodeSegment(lines, nodes, i)
		if segment == "" {
			continue
		}
		owner := resolveHierarchyContentOwner(node, maxAllowedLevel)
		if owner == nil {
			continue
		}
		segmentsByOwner[owner] = append(segmentsByOwner[owner], hierarchyOwnedSegment{
			Content:      segment,
			HeadingTitle: node.Heading.Title,
			HasChildren:  node.HasChildren,
		})
	}
	return segmentsByOwner
}

func hierarchyNodeSegment(lines []string, nodes []*hierarchyNode, index int) string {
	if index < 0 || index >= len(nodes) {
		return ""
	}
	start := max(0, nodes[index].Heading.StartLine)
	if start >= len(lines) {
		return ""
	}
	end := len(lines)
	if index+1 < len(nodes) {
		end = min(end, max(start, nodes[index+1].Heading.StartLine))
	}
	return strings.TrimSpace(strings.Join(lines[start:end], "\n"))
}

func collectKeptHierarchyNodes(nodes []*hierarchyNode, maxAllowedLevel int) []*hierarchyNode {
	kept := make([]*hierarchyNode, 0, len(nodes))
	for _, node := range nodes {
		if node.EffectiveLevel > maxAllowedLevel {
			continue
		}
		kept = append(kept, node)
	}
	return kept
}

func extractHierarchyPreface(lines []string, nodes []*hierarchyNode) string {
	if len(nodes) == 0 {
		return ""
	}
	firstHeadingStart := max(0, nodes[0].Heading.StartLine)
	if firstHeadingStart == 0 || firstHeadingStart > len(lines) {
		return ""
	}
	return strings.TrimSpace(strings.Join(lines[:firstHeadingStart], "\n"))
}

func evaluateHierarchy(headings []hierarchyHeading) (bool, int) {
	if len(headings) < 2 {
		return false, 0
	}
	maxDepth := 0
	stack := make([]int, 0, hierarchyMaxLevel)
	hasNestedLevels := false
	for _, heading := range headings {
		level := clampHierarchyLevel(heading.Level)
		maxDepth = max(maxDepth, level)
		for len(stack) > 0 && stack[len(stack)-1] >= level {
			stack = stack[:len(stack)-1]
		}
		if len(stack) > 0 {
			hasNestedLevels = true
		}
		stack = append(stack, level)
	}
	return hasNestedLevels, maxDepth
}

func detectHierarchyHeadingsRegex(content string) []hierarchyHeading {
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	headings := make([]hierarchyHeading, 0, len(lines)/8+1)
	for i := 0; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		if i+1 < len(lines) {
			if level, ok := parseSetextLevel(lines[i+1]); ok {
				headings = append(headings, hierarchyHeading{
					StartLine:      i,
					HeadingEndLine: i + 1,
					Level:          level,
					Title:          trimmed,
				})
				i++
				continue
			}
		}

		if level, title, ok := parseMarkdownHeading(trimmed); ok {
			headings = append(headings, hierarchyHeading{
				StartLine:      i,
				HeadingEndLine: i,
				Level:          level,
				Title:          title,
			})
			continue
		}
		if level, title, ok := parseNumericHeading(trimmed); ok {
			headings = append(headings, hierarchyHeading{
				StartLine:      i,
				HeadingEndLine: i,
				Level:          level,
				Title:          title,
			})
			continue
		}
		if level, title, ok := parseChineseHeading(trimmed); ok {
			headings = append(headings, hierarchyHeading{
				StartLine:      i,
				HeadingEndLine: i,
				Level:          level,
				Title:          title,
			})
		}
	}
	return headings
}

func parseMarkdownHeading(line string) (int, string, bool) {
	matches := hierarchyMarkdownHeadingRegex.FindStringSubmatch(line)
	if len(matches) != 3 {
		return 0, "", false
	}
	level := clampHierarchyLevel(len(matches[1]))
	title := strings.TrimSpace(strings.TrimRight(matches[2], "#"))
	if title == "" {
		return 0, "", false
	}
	return level, title, true
}

func parseNumericHeading(line string) (int, string, bool) {
	matches := hierarchyNumericHeadingRegex.FindStringSubmatch(line)
	if len(matches) != 3 {
		return 0, "", false
	}
	level := clampHierarchyLevel(strings.Count(matches[1], ".") + 1)
	title := strings.TrimSpace(matches[2])
	if title == "" {
		return 0, "", false
	}
	return level, title, true
}

func parseChineseHeading(line string) (int, string, bool) {
	matches := hierarchyChineseHeadingRegex.FindStringSubmatch(line)
	if len(matches) != 3 {
		return 0, "", false
	}
	level := 1
	switch matches[1] {
	case "节":
		level = 2
	case "条":
		level = 3
	}
	title := strings.TrimSpace(line)
	return clampHierarchyLevel(level), title, true
}

func parseSetextLevel(line string) (int, bool) {
	trimmed := strings.TrimSpace(line)
	switch {
	case hierarchySetextH1Regex.MatchString(trimmed):
		return 1, true
	case hierarchySetextH2Regex.MatchString(trimmed):
		return 2, true
	default:
		return 0, false
	}
}

func normalizeRequestedMode(mode shared.FragmentMode) shared.FragmentMode {
	switch mode {
	case shared.FragmentModeCustom, shared.FragmentModeAuto, shared.FragmentModeHierarchy:
		return mode
	default:
		return shared.FragmentModeCustom
	}
}

func clampHierarchyLevel(level int) int {
	return min(hierarchyMaxLevel, max(hierarchyMinLevel, level))
}
