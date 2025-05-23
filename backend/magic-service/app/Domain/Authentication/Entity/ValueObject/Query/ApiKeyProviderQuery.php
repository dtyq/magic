<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\Entity\ValueObject\Query;

use App\Domain\Authentication\Entity\ValueObject\ApiKeyProviderType;
use App\Infrastructure\Core\AbstractQuery;

class ApiKeyProviderQuery extends AbstractQuery
{
    protected string $name = '';

    protected ?ApiKeyProviderType $relType = null;

    protected string $relCode = '';

    protected bool $enabled = true;

    protected string $creator = '';

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getRelType(): ?ApiKeyProviderType
    {
        return $this->relType;
    }

    public function setRelType(null|ApiKeyProviderType|int $relType): void
    {
        if (is_int($relType)) {
            $relType = ApiKeyProviderType::tryFrom($relType);
        }
        $this->relType = $relType;
    }

    public function getRelCode(): string
    {
        return $this->relCode;
    }

    public function setRelCode(string $relCode): void
    {
        $this->relCode = $relCode;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }
}
