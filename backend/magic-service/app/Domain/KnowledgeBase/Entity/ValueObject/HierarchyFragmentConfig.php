<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Util\Text\TextPreprocess\ValueObject\TextPreprocessRule;

class HierarchyFragmentConfig extends AbstractValueObject
{
    protected int $maxLevel = 0;

    /** @var TextPreprocessRule[] */
    protected array $textPreprocessRule = [];

    protected bool $keepHierarchyInfo = false;

    public function getMaxLevel(): int
    {
        return $this->maxLevel;
    }

    public function setMaxLevel(int $maxLevel): self
    {
        $this->maxLevel = $maxLevel;
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

    public function isKeepHierarchyInfo(): bool
    {
        return $this->keepHierarchyInfo;
    }

    public function setKeepHierarchyInfo(bool $keepHierarchyInfo): self
    {
        $this->keepHierarchyInfo = $keepHierarchyInfo;
        return $this;
    }

    public static function fromArray(array $data): self
    {
        $config = new self();
        $config->setMaxLevel((int) ($data['max_level'] ?? 0));
        $config->setTextPreprocessRule(TextPreprocessRule::fromArray($data['text_preprocess_rule'] ?? []));
        $config->setKeepHierarchyInfo((bool) ($data['keep_hierarchy_info'] ?? false));
        return $config;
    }
}
