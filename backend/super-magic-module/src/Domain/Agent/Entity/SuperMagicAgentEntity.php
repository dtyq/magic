<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Code;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentTool;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentType;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\EditorJsUtil;

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
     * https://editorjs.io/saving-data/.
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
        if (empty($this->prompt)) {
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
        if (empty($this->prompt)) {
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

    public function getPrompt(): array
    {
        return $this->prompt;
    }

    public function setPrompt(array $prompt): void
    {
        $this->prompt = $prompt;
    }

    /**
     * Get prompt as plain text string
     * Converts Editor.js format to readable text.
     *
     * @return string Plain text representation of the prompt
     */
    public function getPromptString(): string
    {
        if (empty($this->prompt)) {
            return '';
        }

        return EditorJsUtil::convertToString($this->prompt);
    }

    /**
     * Get prompt summary (first N characters).
     *
     * @param int $maxLength Maximum length of summary
     * @return string Truncated prompt text
     */
    public function getPromptSummary(int $maxLength = 200): string
    {
        if (empty($this->prompt)) {
            return '';
        }

        return EditorJsUtil::getSummary($this->prompt, $maxLength);
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
}
