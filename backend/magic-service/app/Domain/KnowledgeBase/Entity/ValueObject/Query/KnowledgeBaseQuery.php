<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject\Query;

use App\Domain\KnowledgeBase\Entity\ValueObject\SearchType;

class KnowledgeBaseQuery extends Query
{
    protected ?int $type = 0;

    protected string $name = '';

    protected ?array $codes = null;

    protected ?array $types = null;

    protected ?bool $enabled = null;

    protected ?string $businessId = null;

    protected ?array $businessIds = null;

    protected ?SearchType $searchType = null;

    protected ?int $lastId = null;

    public function getBusinessId(): ?string
    {
        return $this->businessId;
    }

    public function setBusinessId(?string $businessId): void
    {
        $this->businessId = $businessId;
    }

    public function getCodes(): ?array
    {
        return $this->codes;
    }

    public function setCodes(?array $codes): void
    {
        $this->codes = $codes;
    }

    public function getType(): ?int
    {
        return $this->type;
    }

    public function setType(?int $type): void
    {
        $this->type = $type;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getTypes(): ?array
    {
        return $this->types;
    }

    public function setTypes(?array $types): void
    {
        $this->types = $types;
    }

    public function getEnabled(): ?bool
    {
        if (! $this->searchType) {
            return $this->enabled;
        }
        return match ($this->searchType) {
            SearchType::ALL => null,
            SearchType::ENABLED => true,
            SearchType::DISABLED => false,
        };
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getBusinessIds(): ?array
    {
        return $this->businessIds;
    }

    public function setBusinessIds(?array $businessIds): void
    {
        $this->businessIds = $businessIds;
    }

    public function getLastId(): ?int
    {
        return $this->lastId;
    }

    public function setLastId(?int $lastId): void
    {
        $this->lastId = $lastId;
    }

    public function getSearchType(): SearchType
    {
        return $this->searchType;
    }

    public function setSearchType(null|int|SearchType $searchType): KnowledgeBaseQuery
    {
        is_int($searchType) && $searchType = SearchType::from($searchType);
        $this->searchType = $searchType ?? SearchType::ALL;
        return $this;
    }
}
