<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity;

use App\Domain\MCP\Entity\ValueObject\Code;
use App\Domain\MCP\Entity\ValueObject\ServiceType;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;
use Hyperf\Odin\Mcp\McpServerConfig;
use Hyperf\Odin\Mcp\McpType;

class MCPServerEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    /**
     * 唯一编码，仅在创建时生成，用作给前端的id.
     */
    protected string $code;

    /**
     * MCP服务名称.
     */
    protected string $name;

    /**
     * MCP服务描述.
     */
    protected string $description = '';

    /**
     * MCP服务图标.
     */
    protected string $icon = '';

    /**
     * 服务类型.
     */
    protected ServiceType $type;

    /**
     * 是否启用.
     */
    protected ?bool $enabled = null;

    /**
     * External SSE service URL.
     */
    protected string $externalSseUrl = '';

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

    protected DateTime $updatedAt;

    private int $userOperation = 0;

    private int $toolsCount = 0;

    public function shouldCreate(): bool
    {
        return empty($this->code);
    }

    public function prepareForCreation(): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }
        if (empty($this->name)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.name']);
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'creator']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }

        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
        $this->code = Code::MagicMCPService->gen();
        $this->type = $this->type ?? ServiceType::SSE;
        $this->enabled = $this->enabled ?? false;
        $this->id = null;

        if ($this->type === ServiceType::ExternalSSE) {
            if (empty($this->externalSseUrl)) {
                ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.external_sse_url']);
            }
        }
    }

    public function prepareForModification(MCPServerEntity $mcpServerEntity): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }
        if (empty($this->name)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'name']);
        }

        $mcpServerEntity->setName($this->name);
        $mcpServerEntity->setDescription($this->description);
        $mcpServerEntity->setIcon($this->icon);
        $mcpServerEntity->setExternalSseUrl($this->externalSseUrl);
        $mcpServerEntity->setModifier($this->creator);

        if (isset($this->type)) {
            $mcpServerEntity->setType($this->type);
        }

        if (isset($this->enabled)) {
            $mcpServerEntity->setEnabled($this->enabled);
        }

        $mcpServerEntity->setUpdatedAt(new DateTime());
    }

    public function prepareForChangeEnable(): void
    {
        $this->enabled = ! $this->enabled;
    }

    public function createMcpServerConfig(): ?McpServerConfig
    {
        if (! $this->isEnabled()) {
            return null;
        }
        switch ($this->type) {
            case ServiceType::SSE:
                return new McpServerConfig(
                    type: McpType::Http,
                    name: $this->name,
                    url: LOCAL_HTTP_URL . '/api/v1/mcp/sse/' . $this->code,
                );
            case ServiceType::ExternalSSE:
                if (empty($this->externalSseUrl)) {
                    return null;
                }
                return new McpServerConfig(
                    type: McpType::Http,
                    name: $this->name,
                    url: $this->externalSseUrl,
                );
            default:
                return null;
        }
    }

    // Getters and Setters...
    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): void
    {
        $this->code = $code;
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

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function getType(): ServiceType
    {
        return $this->type;
    }

    public function setType(ServiceType $type): void
    {
        $this->type = $type;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getExternalSseUrl(): string
    {
        return $this->externalSseUrl;
    }

    public function setExternalSseUrl(string $externalSseUrl): void
    {
        $this->externalSseUrl = $externalSseUrl;
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

    public function getUserOperation(): int
    {
        return $this->userOperation;
    }

    public function setUserOperation(int $userOperation): void
    {
        $this->userOperation = $userOperation;
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
