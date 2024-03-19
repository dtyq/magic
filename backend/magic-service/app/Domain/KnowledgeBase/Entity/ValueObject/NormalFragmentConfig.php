<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Util\Text\TextPreprocess\ValueObject\TextPreprocessRule;

class NormalFragmentConfig extends AbstractValueObject
{
    /** @var TextPreprocessRule[] */
    protected array $textPreprocessRule;

    protected SegmentRule $segmentRule;

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

    public function getSegmentRule(): SegmentRule
    {
        return $this->segmentRule;
    }

    public function setSegmentRule(SegmentRule $segmentRule): self
    {
        $this->segmentRule = $segmentRule;
        return $this;
    }

    public static function fromArray(array $data): self
    {
        $config = new self();
        $config->setTextPreprocessRule(TextPreprocessRule::fromArray($data['text_preprocess_rule']));
        $config->setSegmentRule(SegmentRule::fromArray($data['segment_rule']));
        return $config;
    }
}
