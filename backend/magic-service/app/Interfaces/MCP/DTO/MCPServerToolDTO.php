<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\DTO\Traits\OperatorDTOTrait;
use App\Interfaces\Kernel\DTO\Traits\StringIdDTOTrait;

class MCPServerToolDTO extends AbstractDTO
{
    use OperatorDTOTrait;
    use StringIdDTOTrait;

    /**
     * 关联的MCP服务code.
     */
    public string $mcpServerCode = '';

    /**
     * 工具名称.
     */
    public string $name = '';

    /**
     * 工具描述.
     */
    public string $description = '';

    /**
     * 工具来源.
     */
    public int $source = 0;

    /**
     * 关联的工具code.
     */
    public string $relCode = '';

    /**
     * 关联的工具版本code.
     */
    public string $relVersionCode = '';

    /**
     * 工具版本.
     */
    public string $version = '';

    /**
     * 是否启用.
     */
    public ?bool $enabled = null;

    /**
     * 工具配置.
     */
    public array $options = [];

    public array $sourceVersion = [];

    /**
     * 关联的信息，给前端使用，无业务逻辑.
     */
    public ?array $relInfo = null;

    public function getMcpServerCode(): string
    {
        return $this->mcpServerCode;
    }

    public function setMcpServerCode(?string $mcpServerCode): void
    {
        $this->mcpServerCode = $mcpServerCode ?? '';
    }

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

    public function getSource(): int
    {
        return $this->source;
    }

    public function setSource(?int $source): void
    {
        $this->source = $source ?? 0;
    }

    public function getRelCode(): string
    {
        return $this->relCode;
    }

    public function setRelCode(?string $relCode): void
    {
        $this->relCode = $relCode ?? '';
    }

    public function getRelVersionCode(): string
    {
        return $this->relVersionCode;
    }

    public function setRelVersionCode(?string $relVersionCode): void
    {
        $this->relVersionCode = $relVersionCode ?? '';
    }

    public function getVersion(): string
    {
        return $this->version;
    }

    public function setVersion(?string $version): void
    {
        $this->version = $version ?? '';
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getOptions(): array
    {
        return $this->options;
    }

    public function setOptions(?array $options): void
    {
        $this->options = $options ?? [];
    }

    public function getSourceVersion(): array
    {
        return $this->sourceVersion;
    }

    public function setSourceVersion(array $sourceVersion): void
    {
        $this->sourceVersion = $sourceVersion;
    }

    public function getRelInfo(): ?array
    {
        return $this->relInfo;
    }

    public function setRelInfo(?array $relInfo): void
    {
        $this->relInfo = $relInfo;
    }
}
