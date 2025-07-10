<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\DTO;

use App\Infrastructure\Core\AbstractDTO;

class MCPUserSettingDTO extends AbstractDTO
{
    /**
     * Required fields configuration.
     * @var array<string, string>
     */
    public array $requireFields = [];

    /**
     * Authentication type value.
     */
    public ?int $authType = null;

    /**
     * Authentication configuration details.
     * @var null|array<string, mixed>
     */
    public ?array $authConfig = null;

    public function getRequireFields(): array
    {
        return $this->requireFields;
    }

    public function setRequireFields(array $requireFields): void
    {
        $this->requireFields = $requireFields;
    }

    public function getAuthType(): ?int
    {
        return $this->authType;
    }

    public function setAuthType(?int $authType): void
    {
        $this->authType = $authType;
    }

    public function getAuthConfig(): ?array
    {
        return $this->authConfig;
    }

    public function setAuthConfig(?array $authConfig): void
    {
        $this->authConfig = $authConfig;
    }
}
