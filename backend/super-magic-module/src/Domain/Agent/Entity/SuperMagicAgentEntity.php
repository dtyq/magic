<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\BuiltinTool;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Code;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentTool;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentToolType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentType;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;

class SuperMagicAgentEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    /**
     * 唯一编码，仅在创建时生成，用作给前端的id.
     */
    protected string $code;

    /**
     * Agent名称.
     */
    protected string $name;

    /**
     * Agent描述.
     */
    protected string $description = '';

    /**
     * Agent图标.
     */
    protected array $icon = [];

    /**
     * @var array<SuperMagicAgentTool>
     */
    protected array $tools = [];

    /**
     * 系统提示词.
     * Format: {"version": "1.0.0", "structure": {"string": "prompt text"}}.
     */
    protected array $prompt = [];

    /**
     * 智能体类型.
     */
    protected SuperMagicAgentType $type = SuperMagicAgentType::Custom;

    /**
     * 是否启用.
     */
    protected ?bool $enabled = null;

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

    protected DateTime $updatedAt;

    /**
     * Category for agent classification.
     * Values: 'frequent', 'all'.
     */
    private string $category = 'all';

    public function shouldCreate(): bool
    {
        return empty($this->code);
    }

    public function prepareForCreation(): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }
        if (empty($this->name)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.name']);
        }
        if (empty($this->prompt)
            || ! isset($this->prompt['version'])
            || ! isset($this->prompt['structure'])) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.prompt']);
        }
        // Check if prompt string content is empty
        if (empty(trim($this->getPromptString()))) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.prompt']);
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'creator']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }

        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
        $this->code = Code::SuperMagicAgent->gen();
        $this->enabled = $this->enabled ?? true;
        // 强制设置为自定义类型，用户创建的智能体只能是自定义类型
        $this->type = SuperMagicAgentType::Custom;
        $this->id = null;
    }

    public function prepareForModification(SuperMagicAgentEntity $originalEntity): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }
        if (empty($this->name)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.name']);
        }
        if (empty($this->prompt)
            || ! isset($this->prompt['version'])
            || ! isset($this->prompt['structure'])) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.prompt']);
        }
        // Check if prompt string content is empty
        if (empty(trim($this->getPromptString()))) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.prompt']);
        }

        // 将新值设置到原始实体上
        $originalEntity->setName($this->name);
        $originalEntity->setDescription($this->description);
        $originalEntity->setIcon($this->icon);
        $originalEntity->setTools($this->tools);
        $originalEntity->setPrompt($this->prompt);
        $originalEntity->setType($this->type);
        $originalEntity->setModifier($this->creator);

        if (isset($this->enabled)) {
            $originalEntity->setEnabled($this->enabled);
        }

        $originalEntity->setUpdatedAt(new DateTime());
    }

    // Getters and Setters
    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        if (is_string($id)) {
            $this->id = (int) $id;
        } else {
            $this->id = $id;
        }
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

    public function getIcon(): array
    {
        return $this->icon;
    }

    public function setIcon(array $icon): void
    {
        $this->icon = $icon;
    }

    public function getTools(): array
    {
        $result = [];

        // 获取必填工具列表，按照 getRequiredTools 的顺序
        $requiredTools = BuiltinTool::getRequiredTools();

        // 1. 先添加必填工具（按照 getRequiredTools 的顺序）
        foreach ($requiredTools as $requiredTool) {
            $tool = new SuperMagicAgentTool();
            $tool->setCode($requiredTool->value);
            $tool->setName($requiredTool->getToolName());
            $tool->setDescription($requiredTool->getToolDescription());
            $tool->setIcon($requiredTool->getToolIcon());
            $tool->setType(SuperMagicAgentToolType::BuiltIn);
            $tool->setSchema(null);

            $result[$tool->getCode()] = $tool;
        }

        // 2. 再添加原始工具列表中的其他工具（跳过已存在的必填工具）
        foreach ($this->tools as $tool) {
            if ($tool->getType()->isBuiltIn()) {
                // 但是不在目前已有的内置列表中，则跳过
                if (! BuiltinTool::isValidTool($tool->getCode())) {
                    continue;
                }
            }
            if (! isset($result[$tool->getCode()])) {
                $result[$tool->getCode()] = $tool;
            }
        }

        return array_values($result);
    }

    /**
     * 获取原始工具列表（不包含自动添加的必填工具）.
     * @return array<SuperMagicAgentTool>
     */
    public function getOriginalTools(): array
    {
        return $this->tools;
    }

    public function setTools(array $tools): void
    {
        $this->tools = [];
        foreach ($tools as $tool) {
            if ($tool instanceof SuperMagicAgentTool) {
                $this->tools[] = $tool;
            } elseif (is_array($tool)) {
                $this->tools[] = new SuperMagicAgentTool($tool);
            }
        }
    }

    /**
     * 添加工具，如果工具已存在则不添加.
     */
    public function addTool(SuperMagicAgentTool $tool): void
    {
        if (array_any($this->tools, fn ($existingTool) => $existingTool->getCode() === $tool->getCode())) {
            return;
        }
        $this->tools[] = $tool;
    }

    public function getPrompt(): array
    {
        // Validate prompt format: must have version and structure keys
        if (empty($this->prompt)
            || ! isset($this->prompt['version'])
            || ! isset($this->prompt['structure'])) {
            return [];
        }

        return $this->prompt;
    }

    public function setPrompt(array $prompt): void
    {
        $this->prompt = $prompt;
    }

    /**
     * Get prompt as plain text string.
     *
     * @return string Plain text representation of the prompt
     */
    public function getPromptString(): string
    {
        $prompt = $this->getPrompt();
        if (empty($prompt)) {
            return '';
        }

        // Handle version 1.0.0 format
        if (isset($prompt['structure']['string'])) {
            return $prompt['structure']['string'];
        }

        return '';
    }

    public function getType(): SuperMagicAgentType
    {
        return $this->type;
    }

    public function setType(int|SuperMagicAgentType $type): void
    {
        if (is_int($type)) {
            $type = SuperMagicAgentType::tryFrom($type);
            if ($type === null) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.invalid', ['label' => 'super_magic.agent.fields.type']);
            }
        }
        $this->type = $type;
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function isEnabled(): bool
    {
        return $this->enabled ?? false;
    }

    public function setEnabled(?bool $enabled): void
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

    public function getCategory(): string
    {
        return $this->category;
    }

    public function setCategory(string $category): void
    {
        $this->category = $category;
    }
}
