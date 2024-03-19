<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity;

use App\Domain\MCP\Entity\ValueObject\Code;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ServiceConfigInterface;
use App\Domain\MCP\Entity\ValueObject\ServiceType;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

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

    protected ServiceConfigInterface $serviceConfig;

    /**
     * 是否启用.
     */
    protected ?bool $enabled = null;

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

    protected DateTime $updatedAt;

    private int $userOperation = 0;

    private int $toolsCount = 0;

    private bool $office = false;

    private bool $builtIn = false;

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
        $this->enabled = $this->enabled ?? true;
        $this->id = null;

        // Ensure serviceConfig is always set
        if (! isset($this->serviceConfig)) {
            $this->serviceConfig = $this->type->createServiceConfig([]);
        }

        // Validate service configuration
        $this->serviceConfig->validate();
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
        $mcpServerEntity->setModifier($this->creator);

        // Handle service config - always validate and set since it's never null
        $this->serviceConfig->validate();
        $mcpServerEntity->setServiceConfig($this->serviceConfig);

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

    public function isBuiltIn(): bool
    {
        return $this->builtIn;
    }

    public function setBuiltIn(bool $builtIn): void
    {
        $this->builtIn = $builtIn;
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

    public function getServiceConfig(): ServiceConfigInterface
    {
        return $this->serviceConfig;
    }

    public function setServiceConfig(array|ServiceConfigInterface $serviceConfig): void
    {
        if (is_array($serviceConfig)) {
            $serviceConfig = $this->type->createServiceConfig($serviceConfig);
        }
        $this->serviceConfig = $serviceConfig;
    }

    public function isOffice(): bool
    {
        return $this->office;
    }

    public function setOffice(bool $office): void
    {
        $this->office = $office;
    }
}
