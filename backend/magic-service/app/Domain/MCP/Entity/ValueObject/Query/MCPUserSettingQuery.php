<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\Query;

use App\Infrastructure\Core\AbstractQuery;

class MCPUserSettingQuery extends AbstractQuery
{
    private ?string $userId = null;

    private ?string $mcpServerId = null;

    private ?bool $hasOauth2AuthResult = null;

    private ?bool $hasRequireFields = null;

    private ?bool $hasConfiguration = null;

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function setUserId(?string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getMcpServerId(): ?string
    {
        return $this->mcpServerId;
    }

    public function setMcpServerId(?string $mcpServerId): self
    {
        $this->mcpServerId = $mcpServerId;
        return $this;
    }

    public function getHasOauth2AuthResult(): ?bool
    {
        return $this->hasOauth2AuthResult;
    }

    public function setHasOauth2AuthResult(?bool $hasOauth2AuthResult): self
    {
        $this->hasOauth2AuthResult = $hasOauth2AuthResult;
        return $this;
    }

    public function getHasRequireFields(): ?bool
    {
        return $this->hasRequireFields;
    }

    public function setHasRequireFields(?bool $hasRequireFields): self
    {
        $this->hasRequireFields = $hasRequireFields;
        return $this;
    }

    public function getHasConfiguration(): ?bool
    {
        return $this->hasConfiguration;
    }

    public function setHasConfiguration(?bool $hasConfiguration): self
    {
        $this->hasConfiguration = $hasConfiguration;
        return $this;
    }
}
