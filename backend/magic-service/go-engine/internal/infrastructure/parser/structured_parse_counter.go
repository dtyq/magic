package docparser

import (
	"fmt"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

type structuredParseCounter struct {
	limits documentdomain.ResourceLimits
	stage  string
	count  int64
}

func newStructuredParseCounter(limits documentdomain.ResourceLimits, stage string) *structuredParseCounter {
	return &structuredParseCounter{
		limits: documentdomain.NormalizeResourceLimits(limits),
		stage:  stage,
	}
}

func (c *structuredParseCounter) observe() error {
	if c == nil {
		return nil
	}
	c.count++
	if err := documentdomain.CheckParsedBlockCount(c.count, c.limits, c.stage); err != nil {
		return fmt.Errorf("check structured parse node count: %w", err)
	}
	return nil
}
