<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Entity\ValueObject\Query;

use App\Infrastructure\Core\AbstractQuery;

class SkillQuery extends AbstractQuery
{
    protected ?string $keyword = null;

    protected ?string $sourceType = null;

    protected ?string $publisherType = null;

    /**
     * 按技能 code 过滤（如市场按 codes 批量查询）；为 null 或未设置时不限制.
     *
     * @var null|array<int, string>
     */
    protected ?array $codes = null;

    /** @var null|int[] */
    protected ?array $categoryIds = null;

    protected ?bool $isFeatured = null;

    public function getKeyword(): ?string
    {
        return $this->keyword;
    }

    public function setKeyword(?string $keyword): void
    {
        $this->keyword = $keyword;
    }

    public function getSourceType(): ?string
    {
        return $this->sourceType;
    }

    public function setSourceType(?string $sourceType): void
    {
        $this->sourceType = $sourceType;
    }

    public function getPublisherType(): ?string
    {
        return $this->publisherType;
    }

    public function setPublisherType(?string $publisherType): void
    {
        $this->publisherType = $publisherType;
    }

    /**
     * @return null|array<int, string>
     */
    public function getCodes(): ?array
    {
        return $this->codes;
    }

    /**
     * @param null|array<int, string> $codes
     */
    public function setCodes(?array $codes): void
    {
        $this->codes = $codes;
    }

    /** @return null|int[] */
    public function getCategoryIds(): ?array
    {
        return $this->categoryIds;
    }

    /** @param null|array<int, int|string> $categoryIds */
    public function setCategoryIds(?array $categoryIds): void
    {
        $this->categoryIds = $categoryIds === null ? null : array_values(array_unique(array_map('intval', $categoryIds)));
    }

    public function getIsFeatured(): ?bool
    {
        return $this->isFeatured;
    }

    public function setIsFeatured(mixed $isFeatured): void
    {
        $this->isFeatured = $isFeatured === null ? null : filter_var($isFeatured, FILTER_VALIDATE_BOOLEAN);
    }
}
