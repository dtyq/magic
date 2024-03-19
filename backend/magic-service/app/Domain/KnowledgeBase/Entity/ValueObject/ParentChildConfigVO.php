<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Util\Text\TextPreprocess\ValueObject\TextPreprocessRule;

class ParentChildConfigVO extends AbstractValueObject
{
    protected string $separator;

    protected string $chunkSize;

    protected ParentMode $parentMode;

    protected SegmentRule $childSegmentRule;

    protected SegmentRule $parentSegmentRule;

    /** @var TextPreprocessRule[] */
    protected array $textPreprocessRule;

    public function getSeparator(): string
    {
        return $this->separator;
    }

    public function setSeparator(string $separator): self
    {
        $this->separator = $separator;
        return $this;
    }

    public function getChunkSize(): string
    {
        return $this->chunkSize;
    }

    public function setChunkSize(string $chunkSize): self
    {
        $this->chunkSize = $chunkSize;
        return $this;
    }

    public function getParentMode(): ParentMode
    {
        return $this->parentMode;
    }

    public function setParentMode(ParentMode $parentMode): self
    {
        $this->parentMode = $parentMode;
        return $this;
    }

    public function getChildSegmentRule(): SegmentRule
    {
        return $this->childSegmentRule;
    }

    public function setChildSegmentRule(SegmentRule $childSegmentRule): self
    {
        $this->childSegmentRule = $childSegmentRule;
        return $this;
    }

    public function getParentSegmentRule(): SegmentRule
    {
        return $this->parentSegmentRule;
    }

    public function setParentSegmentRule(SegmentRule $parentSegmentRule): self
    {
        $this->parentSegmentRule = $parentSegmentRule;
        return $this;
    }

    /**
     * @return TextPreprocessRule[]
     */
    public function getTextPreprocessRule(): array
    {
        return $this->textPreprocessRule;
    }

    /**
     * @param TextPreprocessRule[] $textPreprocessRule
     */
    public function setTextPreprocessRule(array $textPreprocessRule): self
    {
        $this->textPreprocessRule = $textPreprocessRule;
        return $this;
    }

    public static function fromArray(array $data): self
    {
        $config = new self();
        $config->setSeparator($data['separator']);
        $config->setChunkSize($data['chunk_size']);
        $config->setParentMode(ParentMode::from($data['parent_mode']));
        $config->setChildSegmentRule(SegmentRule::fromArray($data['child_segment_rule']));
        $config->setParentSegmentRule(SegmentRule::fromArray($data['parent_segment_rule']));
        $config->setTextPreprocessRule(TextPreprocessRule::fromArray($data['text_preprocess_rule']));
        return $config;
    }
}
