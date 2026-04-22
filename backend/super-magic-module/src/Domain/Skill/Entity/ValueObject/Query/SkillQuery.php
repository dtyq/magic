<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query;

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
}
