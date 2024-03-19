<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use Hyperf\Codec\Json;

/**
 * Playbook 工作流配置实体.
 */
class AgentPlaybookEntity extends AbstractEntity
{
    /**
     * @var int 主键 ID
     */
    protected ?int $id = null;

    /**
     * @var string 归属组织编码
     */
    protected string $organizationCode;

    /**
     * @var int 归属 Agent ID，对应 magic_super_magic_agents.id
     */
    protected int $agentId;

    /**
     * @var null|int 归属 Agent 版本 ID，对应 magic_super_magic_agent_versions.id，NULL 表示不属于特定版本
     */
    protected ?int $agentVersionId = null;

    /**
     * @var string Agent 代码标识，对应 magic_super_magic_agents.code
     */
    protected string $agentCode;

    /**
     * @var null|array Playbook 名称（多语言），格式：{"zh":"工作流标题","en":"Workflow Title"}
     */
    protected ?array $nameI18n = null;

    /**
     * @var null|array Playbook 描述（多语言），格式：{"zh":"...","en":"..."}
     */
    protected ?array $descriptionI18n = null;

    /**
     * @var null|string 图标标识（emoji 或图标 key）
     */
    protected ?string $icon = null;

    /**
     * @var null|string 主题色，格式 #RRGGBB，如 #4F46E5
     */
    protected ?string $themeColor = null;

    /**
     * @var null|bool 启用状态：0=禁用(Disabled)，1=启用(Enabled)
     */
    protected ?bool $isEnabled = null;

    /**
     * @var null|int 展示排序权重，数值越大越靠前（对应原型图拖拽手柄）
     */
    protected ?int $sortOrder = null;

    /**
     * @var null|array Playbook 配置 JSON，包含 scenes_config、presets_config、quick_starts_config
     */
    protected ?array $config = null;

    /**
     * @var string 创建者用户 ID
     */
    protected string $creatorId;

    /**
     * @var null|string 创建时间
     */
    protected ?string $createdAt = null;

    /**
     * @var null|string 更新时间
     */
    protected ?string $updatedAt = null;

    /**
     * @var null|string 软删除时间
     */
    protected ?string $deletedAt = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'organization_code' => $this->organizationCode,
            'agent_id' => $this->agentId,
            'agent_version_id' => $this->agentVersionId,
            'agent_code' => $this->agentCode,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'icon' => $this->icon,
            'theme_color' => $this->themeColor,
            'is_enabled' => $this->isEnabled !== null ? ($this->isEnabled ? 1 : 0) : null,
            'sort_order' => $this->sortOrder,
            'config' => $this->config,
            'creator_id' => $this->creatorId,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
        ];

        return array_filter($result, function ($value) {
            return $value !== null;
        });
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): self
    {
        if (is_string($id)) {
            $this->id = (int) $id;
        } else {
            $this->id = $id;
        }
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getAgentId(): int
    {
        return $this->agentId;
    }

    public function setAgentId(int|string $agentId): self
    {
        $this->agentId = is_string($agentId) ? (int) $agentId : $agentId;
        return $this;
    }

    public function getAgentVersionId(): ?int
    {
        return $this->agentVersionId;
    }

    public function setAgentVersionId(null|int|string $agentVersionId): self
    {
        if ($agentVersionId === null) {
            $this->agentVersionId = null;
        } else {
            $this->agentVersionId = is_string($agentVersionId) ? (int) $agentVersionId : $agentVersionId;
        }
        return $this;
    }

    public function getAgentCode(): string
    {
        return $this->agentCode;
    }

    public function setAgentCode(string $agentCode): self
    {
        $this->agentCode = $agentCode;
        return $this;
    }

    public function getNameI18n(): ?array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(null|array|string $nameI18n): self
    {
        if (is_string($nameI18n)) {
            $nameI18n = Json::decode($nameI18n);
        }

        $this->nameI18n = $nameI18n;
        return $this;
    }

    public function getDescriptionI18n(): ?array
    {
        return $this->descriptionI18n;
    }

    public function setDescriptionI18n(null|array|string $descriptionI18n): self
    {
        if (is_string($descriptionI18n)) {
            $descriptionI18n = Json::decode($descriptionI18n);
        }
        $this->descriptionI18n = $descriptionI18n;
        return $this;
    }

    public function getIcon(): ?string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): self
    {
        $this->icon = $icon;
        return $this;
    }

    public function getThemeColor(): ?string
    {
        return $this->themeColor;
    }

    public function setThemeColor(?string $themeColor): self
    {
        $this->themeColor = $themeColor;
        return $this;
    }

    public function getIsEnabled(): ?bool
    {
        return $this->isEnabled;
    }

    public function setIsEnabled(null|bool|int $isEnabled): self
    {
        if ($isEnabled === null) {
            $this->isEnabled = null;
        } else {
            $this->isEnabled = (bool) $isEnabled;
        }
        return $this;
    }

    public function getSortOrder(): ?int
    {
        return $this->sortOrder;
    }

    public function setSortOrder(null|int|string $sortOrder): self
    {
        if ($sortOrder === null) {
            $this->sortOrder = null;
        } else {
            $this->sortOrder = is_string($sortOrder) ? (int) $sortOrder : $sortOrder;
        }
        return $this;
    }

    public function getConfig(): ?array
    {
        return $this->config;
    }

    public function setConfig(null|array|string $config): self
    {
        if (is_string($config)) {
            $config = Json::decode($config);
        }

        $this->config = $config;
        return $this;
    }

    public function getCreatorId(): string
    {
        return $this->creatorId;
    }

    public function setCreatorId(string $creatorId): self
    {
        $this->creatorId = $creatorId;
        return $this;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): self
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    /**
     * 获取国际化名称.
     *
     * @param string $language 语言代码
     * @return string 名称，优先返回当前语言，其次 default，都没有则返回空字符串
     */
    public function getI18nName(string $language): string
    {
        if (! empty($this->nameI18n[$language])) {
            return $this->nameI18n[$language];
        }

        if (! empty($this->nameI18n[LanguageEnum::DEFAULT->value])) {
            return $this->nameI18n[LanguageEnum::DEFAULT->value];
        }

        return '';
    }

    /**
     * 获取国际化描述.
     *
     * @param string $language 语言代码
     * @return string 描述，优先返回当前语言，其次 default，都没有则返回空字符串
     */
    public function getI18nDescription(string $language): string
    {
        if (! empty($this->descriptionI18n[$language])) {
            return $this->descriptionI18n[$language];
        }

        if (! empty($this->descriptionI18n[LanguageEnum::DEFAULT->value])) {
            return $this->descriptionI18n[LanguageEnum::DEFAULT->value];
        }

        return '';
    }
}
