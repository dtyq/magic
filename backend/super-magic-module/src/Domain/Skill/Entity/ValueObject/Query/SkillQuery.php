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

    protected ?string $languageCode = null;

    protected ?string $publisherType = null;

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

    public function getLanguageCode(): ?string
    {
        return $this->languageCode;
    }

    public function setLanguageCode(?string $languageCode): void
    {
        $this->languageCode = $languageCode;
    }

    public function getPublisherType(): ?string
    {
        return $this->publisherType;
    }

    public function setPublisherType(?string $publisherType): void
    {
        $this->publisherType = $publisherType;
    }
}
