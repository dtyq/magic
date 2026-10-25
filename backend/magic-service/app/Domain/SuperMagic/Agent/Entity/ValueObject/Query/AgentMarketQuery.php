<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Entity\ValueObject\Query;

use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentMarketType;
use App\Infrastructure\Core\AbstractQuery;

class AgentMarketQuery extends AbstractQuery
{
    protected ?string $keyword = null;

    protected ?string $languageCode = null;

    /** @var int[] */
    protected array $categoryIds = [];

    /**
     * Organization market records are visible only when their shelf id is in this list.
     * Public records are always included by the repository independently of this field.
     *
     * @var int[]
     */
    protected array $visibleOrganizationMarketIds = [];

    protected ?string $visibleOrganizationCode = null;

    protected ?AgentMarketType $marketType = null;

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

    /** @return int[] */
    public function getCategoryIds(): array
    {
        return $this->categoryIds;
    }

    /** @param int[] $categoryIds */
    public function setCategoryIds(array $categoryIds): void
    {
        $this->categoryIds = array_values(array_unique(array_filter($categoryIds)));
    }

    /**
     * @param int[] $marketIds
     */
    public function setVisibleOrganizationShelf(string $organizationCode, array $marketIds): void
    {
        $this->visibleOrganizationCode = trim($organizationCode);
        $this->visibleOrganizationMarketIds = array_values(array_unique(array_filter(
            array_map('intval', $marketIds),
            static fn (int $marketId): bool => $marketId > 0
        )));
    }

    public function getVisibleOrganizationCode(): ?string
    {
        return $this->visibleOrganizationCode;
    }

    /** @return int[] */
    public function getVisibleOrganizationMarketIds(): array
    {
        return $this->visibleOrganizationMarketIds;
    }

    public function setMarketType(?AgentMarketType $marketType): void
    {
        $this->marketType = $marketType;
    }

    public function getMarketType(): ?AgentMarketType
    {
        return $this->marketType;
    }
}
