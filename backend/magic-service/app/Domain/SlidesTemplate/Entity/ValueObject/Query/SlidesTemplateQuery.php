<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Entity\ValueObject\Query;

use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateOwnerType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateQueryScope;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateSearchType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagMatch;

class SlidesTemplateQuery
{
    private ?string $keyword = null;

    private ?string $code = null;

    private ?string $categoryCode = null;

    private ?int $status = null;

    private SlidesTemplateQueryScope $scope = SlidesTemplateQueryScope::Official;

    private ?SlidesTemplateOwnerType $ownerType = null;

    private ?string $ownerId = null;

    private array $tagCodes = [];

    private SlidesTemplateTagMatch $tagMatch = SlidesTemplateTagMatch::Any;

    private SlidesTemplateSearchType $searchType = SlidesTemplateSearchType::Database;

    public function getSearchType(): SlidesTemplateSearchType
    {
        return $this->searchType;
    }

    public function setSearchType(null|SlidesTemplateSearchType|string $searchType): void
    {
        if ($searchType instanceof SlidesTemplateSearchType) {
            $this->searchType = $searchType;
            return;
        }

        $this->searchType = SlidesTemplateSearchType::tryFrom((string) $searchType)
            ?? SlidesTemplateSearchType::Database;
    }

    public function getKeyword(): ?string
    {
        return $this->keyword;
    }

    public function setKeyword(?string $keyword): void
    {
        $keyword = trim((string) $keyword);
        $this->keyword = $keyword === '' ? null : $keyword;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(?string $code): void
    {
        $code = trim((string) $code);
        $this->code = $code === '' ? null : $code;
    }

    public function getCategoryCode(): ?string
    {
        return $this->categoryCode;
    }

    public function setCategoryCode(?string $categoryCode): void
    {
        $categoryCode = trim((string) $categoryCode);
        $this->categoryCode = $categoryCode === '' ? null : $categoryCode;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(null|int|string $status): void
    {
        $this->status = $status === null || $status === '' ? null : (int) $status;
    }

    public function getScope(): SlidesTemplateQueryScope
    {
        return $this->scope;
    }

    public function setScope(null|SlidesTemplateQueryScope|string $scope): void
    {
        if ($scope instanceof SlidesTemplateQueryScope) {
            $this->scope = $scope;
            return;
        }

        $this->scope = SlidesTemplateQueryScope::tryFrom((string) $scope) ?? SlidesTemplateQueryScope::Official;
    }

    public function getOwnerType(): ?SlidesTemplateOwnerType
    {
        return $this->ownerType;
    }

    public function setOwnerType(null|SlidesTemplateOwnerType|string $ownerType): void
    {
        if ($ownerType instanceof SlidesTemplateOwnerType) {
            $this->ownerType = $ownerType;
            return;
        }

        $this->ownerType = $ownerType === null || $ownerType === ''
            ? null
            : SlidesTemplateOwnerType::from($ownerType);
    }

    public function getOwnerId(): ?string
    {
        return $this->ownerId;
    }

    public function setOwnerId(?string $ownerId): void
    {
        $ownerId = trim((string) $ownerId);
        $this->ownerId = $ownerId === '' ? null : $ownerId;
    }

    public function getTagCodes(): array
    {
        return $this->tagCodes;
    }

    public function setTagCodes(array $tagCodes): void
    {
        $result = [];
        foreach ($tagCodes as $tagCode) {
            if (! is_string($tagCode)) {
                continue;
            }
            $tagCode = trim($tagCode);
            if ($tagCode !== '') {
                $result[$tagCode] = $tagCode;
            }
        }
        $this->tagCodes = array_values($result);
    }

    public function getTagMatch(): SlidesTemplateTagMatch
    {
        return $this->tagMatch;
    }

    public function setTagMatch(null|SlidesTemplateTagMatch|string $tagMatch): void
    {
        if ($tagMatch instanceof SlidesTemplateTagMatch) {
            $this->tagMatch = $tagMatch;
            return;
        }

        $this->tagMatch = SlidesTemplateTagMatch::tryFrom((string) $tagMatch) ?? SlidesTemplateTagMatch::Any;
    }
}
