// Package tokenizer 提供基于 tiktoken 的离线分词能力。
package tokenizer

import (
	"errors"
	"fmt"
	"strings"
	"sync"

	tiktoken "github.com/pkoukk/tiktoken-go"
	tiktokenloader "github.com/pkoukk/tiktoken-go-loader"
)

const (
	// DefaultEncoding 是不支持模型时的默认编码。
	DefaultEncoding = "cl100k_base"

	emptyModelCacheKey = "__empty_model__"
	defaultCacheSize   = 8

	o200kBaseURL  = "https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken"
	cl100kBaseURL = "https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken"
	p50kBaseURL   = "https://openaipublic.blob.core.windows.net/encodings/p50k_base.tiktoken"
	r50kBaseURL   = "https://openaipublic.blob.core.windows.net/encodings/r50k_base.tiktoken"

	o200kEndOfTextToken   = 199999
	o200kEndOfPromptToken = 200018

	cl100kEndOfTextToken   = 100257
	cl100kFIMPrefixToken   = 100258
	cl100kFIMMiddleToken   = 100259
	cl100kFIMSuffixToken   = 100260
	cl100kEndOfPromptToken = 100276

	p50kEndOfTextToken   = 50256
	p50kEditFIMPrefix    = 50281
	p50kEditFIMMiddle    = 50282
	p50kEditFIMSuffix    = 50283
	p50kBaseExplicitSize = 50281
)

var (
	errServiceNil       = errors.New("tokenizer service is nil")
	errUnknownEncoding  = errors.New("unknown encoding")
	errOfflineLoaderNil = errors.New("offline loader is nil")
)

// Encoder 包装一次模型解析后的编码器，支持重复复用。
type Encoder struct {
	requestedModel string
	resolvedModel  string
	encodingName   string
	fallback       bool
	core           *tiktoken.Tiktoken
}

// RequestedModel 返回调用方请求的模型名。
func (e *Encoder) RequestedModel() string {
	if e == nil {
		return ""
	}
	return e.requestedModel
}

// ResolvedModel 返回实际生效的模型标识（fallback 时为 cl100k_base）。
func (e *Encoder) ResolvedModel() string {
	if e == nil {
		return ""
	}
	return e.resolvedModel
}

// EncodingName 返回实际使用的编码名。
func (e *Encoder) EncodingName() string {
	if e == nil {
		return ""
	}
	return e.encodingName
}

// UsesFallback 返回是否触发了模型降级。
func (e *Encoder) UsesFallback() bool {
	if e == nil {
		return false
	}
	return e.fallback
}

// Encode 执行分词。
func (e *Encoder) Encode(text string) []int {
	if e == nil || e.core == nil || text == "" {
		return nil
	}
	return e.core.Encode(text, nil, nil)
}

// CountTokens 统计 token 数。
func (e *Encoder) CountTokens(text string) int {
	return len(e.Encode(text))
}

// Decode 将 token 还原为文本。
func (e *Encoder) Decode(tokens []int) string {
	if e == nil || e.core == nil || len(tokens) == 0 {
		return ""
	}
	return e.core.Decode(tokens)
}

// Service 提供实例级 tokenizer 缓存。
type Service struct {
	mu            sync.RWMutex
	modelCache    map[string]*Encoder
	encodingCache map[string]*tiktoken.Tiktoken
	loader        *tiktokenloader.OfflineLoader
}

// NewService 创建 tokenizer 服务实例。
func NewService() *Service {
	return &Service{
		modelCache:    make(map[string]*Encoder, defaultCacheSize),
		encodingCache: make(map[string]*tiktoken.Tiktoken, defaultCacheSize),
		loader:        tiktokenloader.NewOfflineLoader(),
	}
}

// EncoderForModel 根据模型名解析并缓存编码器。
func (s *Service) EncoderForModel(model string) (*Encoder, error) {
	if s == nil {
		return nil, errServiceNil
	}

	key := modelCacheKey(model)
	if cached := s.getCachedModelEncoder(key); cached != nil {
		return cached, nil
	}

	normalizedModel := strings.TrimSpace(model)
	resolvedModel := normalizedModel
	encodingName := DefaultEncoding
	fallback := false

	if normalizedModel == "" {
		fallback = true
		resolvedModel = DefaultEncoding
	} else if matchedEncoding, ok := encodingForModel(normalizedModel); ok {
		encodingName = matchedEncoding
	} else {
		fallback = true
		resolvedModel = DefaultEncoding
	}

	core, err := s.getOrCreateEncoding(encodingName)
	if err != nil && encodingName != DefaultEncoding {
		// 主模型编码初始化失败时，退回默认编码，避免同步流程中断。
		fallback = true
		resolvedModel = DefaultEncoding
		encodingName = DefaultEncoding
		core, err = s.getOrCreateEncoding(DefaultEncoding)
	}
	if err != nil {
		return nil, fmt.Errorf("initialize tokenizer encoding %q: %w", encodingName, err)
	}

	encoder := &Encoder{
		requestedModel: normalizedModel,
		resolvedModel:  resolvedModel,
		encodingName:   encodingName,
		fallback:       fallback,
		core:           core,
	}

	s.mu.Lock()
	if cached := s.modelCache[key]; cached != nil {
		s.mu.Unlock()
		return cached, nil
	}
	s.modelCache[key] = encoder
	s.mu.Unlock()

	return encoder, nil
}

func (s *Service) getOrCreateEncoding(encodingName string) (*tiktoken.Tiktoken, error) {
	s.mu.RLock()
	if cached := s.encodingCache[encodingName]; cached != nil {
		s.mu.RUnlock()
		return cached, nil
	}
	s.mu.RUnlock()

	encoding, err := s.loadEncoding(encodingName)
	if err != nil {
		return nil, fmt.Errorf("get encoding %q: %w", encodingName, err)
	}

	s.mu.Lock()
	if cached := s.encodingCache[encodingName]; cached != nil {
		s.mu.Unlock()
		return cached, nil
	}
	s.encodingCache[encodingName] = encoding
	s.mu.Unlock()
	return encoding, nil
}

func (s *Service) getCachedModelEncoder(key string) *Encoder {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.modelCache[key]
}

func (s *Service) loadEncoding(encodingName string) (*tiktoken.Tiktoken, error) {
	encoding, err := s.loadEncodingSpec(encodingName)
	if err != nil {
		return nil, err
	}

	core, err := tiktoken.NewCoreBPE(encoding.MergeableRanks, encoding.SpecialTokens, encoding.PatStr)
	if err != nil {
		return nil, fmt.Errorf("create core bpe for %q: %w", encodingName, err)
	}

	specialTokensSet := make(map[string]any, len(encoding.SpecialTokens))
	for token := range encoding.SpecialTokens {
		specialTokensSet[token] = true
	}

	return tiktoken.NewTiktoken(core, encoding, specialTokensSet), nil
}

func (s *Service) loadEncodingSpec(encodingName string) (*tiktoken.Encoding, error) {
	switch encodingName {
	case tiktoken.MODEL_O200K_BASE:
		return s.loadO200KBaseEncoding()
	case tiktoken.MODEL_CL100K_BASE:
		return s.loadCL100KBaseEncoding()
	case tiktoken.MODEL_P50K_BASE:
		return s.loadP50KBaseEncoding()
	case tiktoken.MODEL_P50K_EDIT:
		return s.loadP50KEditEncoding()
	case tiktoken.MODEL_R50K_BASE:
		return s.loadR50KBaseEncoding()
	default:
		return nil, fmt.Errorf("%w: %s", errUnknownEncoding, encodingName)
	}
}

func (s *Service) loadRanks(tiktokenBpeFile string) (map[string]int, error) {
	if s.loader == nil {
		return nil, errOfflineLoaderNil
	}
	ranks, err := s.loader.LoadTiktokenBpe(tiktokenBpeFile)
	if err != nil {
		return nil, fmt.Errorf("load offline bpe %q: %w", tiktokenBpeFile, err)
	}
	return ranks, nil
}

func (s *Service) loadO200KBaseEncoding() (*tiktoken.Encoding, error) {
	ranks, err := s.loadRanks(o200kBaseURL)
	if err != nil {
		return nil, err
	}

	patterns := []string{
		`[^\r\n\p{L}\p{N}]?[\p{Lu}\p{Lt}\p{Lm}\p{Lo}\p{M}]*[\p{Ll}\p{Lm}\p{Lo}\p{M}]+(?i:'s|'t|'re|'ve|'m|'ll|'d)?`,
		`[^\r\n\p{L}\p{N}]?[\p{Lu}\p{Lt}\p{Lm}\p{Lo}\p{M}]+[\p{Ll}\p{Lm}\p{Lo}\p{M}]*(?i:'s|'t|'re|'ve|'m|'ll|'d)?`,
		`\p{N}{1,3}`,
		` ?[^\s\p{L}\p{N}]+[\r\n/]*`,
		`\s*[\r\n]+`,
		`\s+(?!\S)`,
		`\s+`,
	}

	return &tiktoken.Encoding{
		Name:           tiktoken.MODEL_O200K_BASE,
		PatStr:         strings.Join(patterns, "|"),
		MergeableRanks: ranks,
		SpecialTokens: map[string]int{
			tiktoken.ENDOFTEXT:   o200kEndOfTextToken,
			tiktoken.ENDOFPROMPT: o200kEndOfPromptToken,
		},
	}, nil
}

func (s *Service) loadCL100KBaseEncoding() (*tiktoken.Encoding, error) {
	ranks, err := s.loadRanks(cl100kBaseURL)
	if err != nil {
		return nil, err
	}

	return &tiktoken.Encoding{
		Name:           tiktoken.MODEL_CL100K_BASE,
		PatStr:         `(?i:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+`,
		MergeableRanks: ranks,
		SpecialTokens: map[string]int{
			tiktoken.ENDOFTEXT:   cl100kEndOfTextToken,
			tiktoken.FIM_PREFIX:  cl100kFIMPrefixToken,
			tiktoken.FIM_MIDDLE:  cl100kFIMMiddleToken,
			tiktoken.FIM_SUFFIX:  cl100kFIMSuffixToken,
			tiktoken.ENDOFPROMPT: cl100kEndOfPromptToken,
		},
	}, nil
}

func (s *Service) loadP50KBaseEncoding() (*tiktoken.Encoding, error) {
	ranks, err := s.loadRanks(p50kBaseURL)
	if err != nil {
		return nil, err
	}

	return &tiktoken.Encoding{
		Name:           tiktoken.MODEL_P50K_BASE,
		PatStr:         `'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+`,
		MergeableRanks: ranks,
		SpecialTokens: map[string]int{
			tiktoken.ENDOFTEXT: p50kEndOfTextToken,
		},
		ExplicitNVocab: p50kBaseExplicitSize,
	}, nil
}

func (s *Service) loadP50KEditEncoding() (*tiktoken.Encoding, error) {
	ranks, err := s.loadRanks(p50kBaseURL)
	if err != nil {
		return nil, err
	}

	return &tiktoken.Encoding{
		Name:           tiktoken.MODEL_P50K_EDIT,
		PatStr:         `'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+`,
		MergeableRanks: ranks,
		SpecialTokens: map[string]int{
			tiktoken.ENDOFTEXT:  p50kEndOfTextToken,
			tiktoken.FIM_PREFIX: p50kEditFIMPrefix,
			tiktoken.FIM_MIDDLE: p50kEditFIMMiddle,
			tiktoken.FIM_SUFFIX: p50kEditFIMSuffix,
		},
	}, nil
}

func (s *Service) loadR50KBaseEncoding() (*tiktoken.Encoding, error) {
	ranks, err := s.loadRanks(r50kBaseURL)
	if err != nil {
		return nil, err
	}

	return &tiktoken.Encoding{
		Name:           tiktoken.MODEL_R50K_BASE,
		PatStr:         `'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+`,
		MergeableRanks: ranks,
		SpecialTokens: map[string]int{
			tiktoken.ENDOFTEXT: p50kEndOfTextToken,
		},
	}, nil
}

func encodingForModel(model string) (string, bool) {
	if model == "" {
		return "", false
	}
	if encoding, ok := tiktoken.MODEL_TO_ENCODING[model]; ok {
		return encoding, true
	}
	for prefix, encoding := range tiktoken.MODEL_PREFIX_TO_ENCODING {
		if strings.HasPrefix(model, prefix) {
			return encoding, true
		}
	}
	return "", false
}

func modelCacheKey(model string) string {
	normalized := strings.ToLower(strings.TrimSpace(model))
	if normalized == "" {
		return emptyModelCacheKey
	}
	return normalized
}
