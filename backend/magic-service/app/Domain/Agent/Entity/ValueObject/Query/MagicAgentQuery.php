<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Entity\ValueObject\Query;

use App\Infrastructure\Core\ValueObject\Query;

class MagicAgentQuery extends Query
{
    private ?array $ids = null;

    private ?string $agentName = null;

    private bool $withLastVersionInfo = false;

    private ?string $createdUid = null;

    private ?bool $hasVersion = null;

    private ?int $status = null;

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(?int $status): void
    {
        $this->status = $status;
    }

    public function isWithLastVersionInfo(): bool
    {
        return $this->withLastVersionInfo;
    }

    public function setWithLastVersionInfo(bool $withLastVersionInfo): void
    {
        $this->withLastVersionInfo = $withLastVersionInfo;
    }

    public function getAgentName(): ?string
    {
        return $this->agentName;
    }

    public function setAgentName(?string $agentName): void
    {
        $this->agentName = $agentName;
    }

    public function getIds(): ?array
    {
        return $this->ids;
    }

    public function setIds(?array $ids): void
    {
        $this->ids = $ids;
    }

    public function getCreatedUid(): ?string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(?string $createdUid): void
    {
        $this->createdUid = $createdUid;
    }

    public function getHasVersion(): ?bool
    {
        return $this->hasVersion;
    }

    public function setHasVersion(?bool $hasVersion): void
    {
        $this->hasVersion = $hasVersion;
    }
}
