<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query;

use App\Infrastructure\Core\AbstractQuery;

/**
 * Agent 版本批量查询条件（codes、关键词、is_current_versions 等）.
 */
class AgentVersionQuery extends AbstractQuery
{
    protected ?string $keyword = null;

    protected ?string $languageCode = null;

    /**
     * is_current_versions：true 仅 is_current_version=1；false 为当前或最新一条；null 视为 true.
     */
    protected ?bool $isCurrentVersions = null;

    /**
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

    public function getLanguageCode(): ?string
    {
        return $this->languageCode;
    }

    public function setLanguageCode(?string $languageCode): void
    {
        $this->languageCode = $languageCode;
    }

    public function getIsCurrentVersions(): ?bool
    {
        return $this->isCurrentVersions;
    }

    public function setIsCurrentVersions(?bool $isCurrentVersions): void
    {
        $this->isCurrentVersions = $isCurrentVersions;
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
