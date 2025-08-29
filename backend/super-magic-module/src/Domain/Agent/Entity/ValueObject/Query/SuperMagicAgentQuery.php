<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query;

use App\Infrastructure\Core\AbstractQuery;

class SuperMagicAgentQuery extends AbstractQuery
{
    protected ?string $name = null;

    protected ?bool $enabled = null;

    protected ?array $codes = null;

    protected ?string $creatorId = null;

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name;
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getCodes(): ?array
    {
        return $this->codes;
    }

    public function setCodes(?array $codes): void
    {
        $this->codes = $codes;
    }

    public function getCreatorId(): ?string
    {
        return $this->creatorId;
    }

    public function setCreatorId(?string $creatorId): void
    {
        $this->creatorId = $creatorId;
    }
}
