<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity;

use App\Domain\MCP\Entity\ValueObject\ToolOptions;
use App\Domain\MCP\Entity\ValueObject\ToolSource;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class MCPServerToolEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    /**
     * 关联的mcp服务code.
     */
    protected string $mcpServerCode;

    /**
     * 工具名称.
     */
    protected string $name;

    /**
     * 工具描述.
     */
    protected string $description = '';

    /**
     * 工具来源.
     */
    protected ToolSource $source;

    /**
     * 关联的工具code.
     */
    protected string $relCode = '';

    /**
     * 关联的工具版本code.
     */
    protected string $relVersionCode = '';

    /**
     * 工具版本.
     */
    protected string $version = '';

    /**
     * 是否启用.
     */
    protected bool $enabled = false;

    /**
     * 工具配置.
     */
    protected ToolOptions $options;

    /**
     * 关联的信息，用于前端展示.
     */
    protected ?array $relInfo = null;

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

    protected DateTime $updatedAt;

    public function shouldCreate(): bool
    {
        return empty($this->id);
    }

    public function prepareForCreation(): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }
        if (empty($this->mcpServerCode)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp_server_code']);
        }
        $this->checkName();
        if (empty($this->creator)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'creator']);
        }
        if (empty($this->options)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'options']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }

        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
        $this->source = $this->source ?? ToolSource::Unknown;
        $this->enabled = $this->enabled ?? false;
        $this->id = null;
    }

    public function prepareForModification(MCPServerToolEntity $mcpServerToolEntity): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }
        if (empty($this->mcpServerCode)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp_server_code']);
        }
        $this->checkName();

        $mcpServerToolEntity->setName($this->name);
        $mcpServerToolEntity->setDescription($this->description);
        $mcpServerToolEntity->setSource($this->source);
        $mcpServerToolEntity->setRelCode($this->relCode);
        $mcpServerToolEntity->setRelVersionCode($this->relVersionCode);
        $mcpServerToolEntity->setVersion($this->version);
        $mcpServerToolEntity->setModifier($this->creator);

        if (isset($this->options)) {
            $mcpServerToolEntity->setOptions($this->options);
        }

        if (isset($this->enabled)) {
            $mcpServerToolEntity->setEnabled($this->enabled);
        }

        if (isset($this->relInfo)) {
            $mcpServerToolEntity->setRelInfo($this->relInfo);
        }

        $mcpServerToolEntity->setUpdatedAt(new DateTime());
    }

    public function prepareForChangeEnable(): void
    {
        $this->enabled = ! $this->enabled;
    }

    // Getters and Setters
    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id ? (int) $id : null;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getMcpServerCode(): string
    {
        return $this->mcpServerCode;
    }

    public function setMcpServerCode(string $mcpServerCode): void
    {
        $this->mcpServerCode = $mcpServerCode;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getSource(): ToolSource
    {
        return $this->source;
    }

    public function setSource(ToolSource $source): void
    {
        $this->source = $source;
    }

    public function getRelCode(): string
    {
        return $this->relCode;
    }

    public function setRelCode(string $relCode): void
    {
        $this->relCode = $relCode;
    }

    public function getRelVersionCode(): string
    {
        return $this->relVersionCode;
    }

    public function setRelVersionCode(string $relVersionCode): void
    {
        $this->relVersionCode = $relVersionCode;
    }

    public function getVersion(): string
    {
        return $this->version;
    }

    public function setVersion(string $version): void
    {
        $this->version = $version;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getOptions(): ToolOptions
    {
        return $this->options;
    }

    public function setOptions(ToolOptions $options): void
    {
        $this->options = $options;
    }

    public function getRelInfo(): ?array
    {
        return $this->relInfo;
    }

    public function setRelInfo(?array $relInfo): void
    {
        $this->relInfo = $relInfo;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    private function checkName(): void
    {
        if (empty($this->name)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.name']);
        }
        if (! preg_match('/^[a-zA-Z0-9_]+$/', $this->name)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'flow.tool.name.invalid_format');
        }
    }
}
