<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\DTO\Traits\OperatorDTOTrait;
use App\Interfaces\Kernel\DTO\Traits\StringIdDTOTrait;

class MCPServerDTO extends AbstractDTO
{
    use OperatorDTOTrait;
    use StringIdDTOTrait;

    /**
     * MCP服务名称.
     */
    public string $name = '';

    /**
     * MCP服务描述.
     */
    public string $description = '';

    /**
     * MCP服务图标.
     */
    public string $icon = '';

    /**
     * 服务类型.
     */
    public string $type = '';

    /**
     * 是否启用.
     */
    public ?bool $enabled = null;

    /**
     * External SSE service URL.
     */
    public string $externalSseUrl = '';

    /**
     * Service configuration.
     */
    public ?array $serviceConfig = null;

    public int $userOperation = 0;

    public int $toolsCount = 0;

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name ?? '';
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description ?? '';
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): void
    {
        $this->icon = $icon ?? '';
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(?string $type): void
    {
        $this->type = $type ?? '';
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getExternalSseUrl(): string
    {
        return $this->externalSseUrl;
    }

    public function setExternalSseUrl(?string $externalSseUrl): void
    {
        $this->externalSseUrl = $externalSseUrl ?? '';
    }

    public function getServiceConfig(): ?array
    {
        return $this->serviceConfig;
    }

    public function setServiceConfig(?array $serviceConfig): void
    {
        $this->serviceConfig = $serviceConfig;
    }

    public function getUserOperation(): int
    {
        return $this->userOperation;
    }

    public function setUserOperation(?int $userOperation): void
    {
        $this->userOperation = $userOperation ?? 0;
    }

    public function getToolsCount(): int
    {
        return $this->toolsCount;
    }

    public function setToolsCount(int $toolsCount): void
    {
        $this->toolsCount = $toolsCount;
    }
}
