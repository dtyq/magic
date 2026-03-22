<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\AgentIconType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishStatus;
use Hyperf\Codec\Json;

/**
 * 市场 Agent 实体.
 */
class AgentMarketEntity extends AbstractEntity
{
    /**
     * @var int 主键 ID
     */
    protected ?int $id = null;

    /**
     * @var string Agent 唯一标识码，对应 magic_super_magic_agent_versions.code
     */
    protected string $agentCode;

    /**
     * @var int 关联的 Agent 版本 ID，对应 magic_super_magic_agent_versions.id
     */
    protected int $agentVersionId;

    /**
     * @var null|array 多语言展示名称，格式：{"en":"xxx","zh":"xxx"}，必须包含 en
     */
    protected ?array $nameI18n = null;

    /**
     * @var null|array 多语言展示描述，格式同 name_i18n
     */
    protected ?array $descriptionI18n = null;

    /**
     * @var null|array 角色定位（多语言），格式：{"zh_CN":["市场分析师","内容创作者"],"en_US":["Marketing Analyst","Content Creator"]}
     */
    protected ?array $roleI18n = null;

    /**
     * 图标.
     */
    protected ?array $icon = null;

    protected AgentIconType $iconType = AgentIconType::Icon;

    /**
     * @var string 发布者用户 ID
     */
    protected string $publisherId;

    /**
     * @var PublisherType 发布者类型：USER=普通用户, OFFICIAL=官方运营, VERIFIED_CREATOR=认证创作者, PARTNER=第三方机构
     */
    protected PublisherType $publisherType = PublisherType::USER;

    /**
     * @var null|int 分类 ID（预留字段，未来如有 Crew 分类表可关联）
     */
    protected ?int $categoryId = null;

    /**
     * @var PublishStatus 发布状态：UNPUBLISHED=未发布, PUBLISHING=发布中, PUBLISHED=已发布, OFFLINE=已下架
     */
    protected PublishStatus $publishStatus = PublishStatus::UNPUBLISHED;

    /**
     * @var int 安装次数（统计有多少用户安装了该员工）
     */
    protected int $installCount = 0;

    /**
     * @var null|int 排序值，数值越大越靠前；NULL 表示按创建时间排序
     */
    protected ?int $sortOrder = null;

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

    protected ?string $organizationCode = null;

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
            'agent_code' => $this->agentCode,
            'agent_version_id' => $this->agentVersionId,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'role_i18n' => $this->roleI18n,
            'icon' => $this->icon,
            'icon_type' => $this->iconType->value,
            'publisher_id' => $this->publisherId,
            'publisher_type' => $this->publisherType->value,
            'category_id' => $this->categoryId,
            'publish_status' => $this->publishStatus->value,
            'install_count' => $this->installCount,
            'sort_order' => $this->sortOrder,
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

    public function getAgentCode(): string
    {
        return $this->agentCode;
    }

    public function setAgentCode(string $agentCode): self
    {
        $this->agentCode = $agentCode;
        return $this;
    }

    public function getAgentVersionId(): int
    {
        return $this->agentVersionId;
    }

    public function setAgentVersionId(int|string $agentVersionId): self
    {
        $this->agentVersionId = is_string($agentVersionId) ? (int) $agentVersionId : $agentVersionId;
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

    public function getRoleI18n(): ?array
    {
        return $this->roleI18n;
    }

    public function setRoleI18n(null|array|string $roleI18n): self
    {
        if (is_string($roleI18n)) {
            $roleI18n = Json::decode($roleI18n);
        }
        $this->roleI18n = $roleI18n;
        return $this;
    }

    public function getPublisherId(): string
    {
        return $this->publisherId;
    }

    public function setPublisherId(string $publisherId): self
    {
        $this->publisherId = $publisherId;
        return $this;
    }

    public function getPublisherType(): PublisherType
    {
        return $this->publisherType;
    }

    public function setPublisherType(PublisherType|string $publisherType): self
    {
        if ($publisherType instanceof PublisherType) {
            $this->publisherType = $publisherType;
        } else {
            $this->publisherType = PublisherType::from($publisherType);
        }
        return $this;
    }

    public function getCategoryId(): ?int
    {
        return $this->categoryId;
    }

    public function setCategoryId(null|int|string $categoryId): self
    {
        if ($categoryId === null) {
            $this->categoryId = null;
        } else {
            $this->categoryId = is_string($categoryId) ? (int) $categoryId : $categoryId;
        }
        return $this;
    }

    public function getPublishStatus(): PublishStatus
    {
        return $this->publishStatus;
    }

    public function setPublishStatus(PublishStatus|string $publishStatus): self
    {
        if ($publishStatus instanceof PublishStatus) {
            $this->publishStatus = $publishStatus;
        } else {
            $this->publishStatus = PublishStatus::from($publishStatus);
        }
        return $this;
    }

    public function getInstallCount(): int
    {
        return $this->installCount;
    }

    public function setInstallCount(int|string $installCount): self
    {
        $this->installCount = is_string($installCount) ? (int) $installCount : $installCount;
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

    public function getIcon(): ?array
    {
        return $this->icon;
    }

    public function setIcon(null|array|string $icon): self
    {
        if (is_string($icon)) {
            $icon = Json::decode($icon);
        }
        $this->icon = $icon;
        return $this;
    }

    public function getIconType(): AgentIconType
    {
        return $this->iconType;
    }

    public function setIconType(AgentIconType|int $iconType): self
    {
        if ($iconType instanceof AgentIconType) {
            $this->iconType = $iconType;
        } else {
            $this->iconType = AgentIconType::from($iconType);
        }

        return $this;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }
}
