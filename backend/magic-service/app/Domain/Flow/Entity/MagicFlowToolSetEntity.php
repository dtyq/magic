<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity;

use App\Domain\Flow\Entity\ValueObject\Code;
use App\Domain\Flow\Entity\ValueObject\ConstValue;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class MagicFlowToolSetEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    /**
     * 唯一编码，仅在创建时生成，用作给前端的id.
     */
    protected string $code;

    /**
     * 工具集名称.
     */
    protected string $name;

    /**
     * 工具集描述.
     */
    protected string $description = '';

    /**
     * 工具集图标.
     */
    protected string $icon = '';

    protected ?bool $enabled = true;

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

    protected DateTime $updatedAt;

    /**
     * 用于冗余工具的信息列表.
     * with 查询.
     */
    private array $tools = [];

    private int $userOperation = 0;

    public static function createNotGrouped(string $organizationCode): MagicFlowToolSetEntity
    {
        $toolSet = new MagicFlowToolSetEntity();
        $toolSet->setId(0);
        $toolSet->setOrganizationCode($organizationCode);
        $toolSet->setCode(ConstValue::TOOL_SET_DEFAULT_CODE);
        $toolSet->setName('未分类');
        $toolSet->setEnabled(true);
        $toolSet->setCreator('system');
        $toolSet->setCreatedAt(new DateTime());
        $toolSet->setModifier('system');
        $toolSet->setUpdatedAt(new DateTime());
        return $toolSet;
    }

    public function shouldCreate(): bool
    {
        return empty($this->code);
    }

    public function prepareForCreation(): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.organization_code.empty');
        }
        if (empty($this->name)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.name.empty');
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.creator.empty');
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
        $this->code = Code::MagicFlowToolSet->gen();
        $this->enabled = $this->enabled ?? true;
        $this->id = null;
    }

    public function prepareForModification(MagicFlowToolSetEntity $magicFlowToolSetEntity): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.organization_code.empty');
        }
        if (empty($this->name)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.name.empty');
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.creator.empty');
        }
        $magicFlowToolSetEntity->setName($this->name);
        $magicFlowToolSetEntity->setDescription($this->description);
        $magicFlowToolSetEntity->setIcon($this->icon);
        $magicFlowToolSetEntity->setModifier($this->creator);
        if (! is_null($this->enabled)) {
            $magicFlowToolSetEntity->setEnabled($this->enabled);
        }
        $magicFlowToolSetEntity->setUpdatedAt(new DateTime());
    }

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

    public function getTools(): array
    {
        return $this->tools;
    }

    public function setTools(array $tools): void
    {
        $this->tools = $tools;
    }

    public function addTool(array $tool): void
    {
        $this->tools[] = $tool;
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

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getUserOperation(): int
    {
        return $this->userOperation;
    }

    public function setUserOperation(int $userOperation): void
    {
        $this->userOperation = $userOperation;
    }
}
