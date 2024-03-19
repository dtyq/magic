<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\ReviewStatus;
use Hyperf\Codec\Json;

/**
 * Agent 版本实体.
 */
class AgentVersionEntity extends AbstractEntity
{
    /**
     * @var int 主键 ID（版本ID，雪花ID）
     */
    protected ?int $id = null;

    /**
     * @var string Agent 唯一标识码，对应 magic_super_magic_agents.code
     */
    protected string $code;

    /**
     * @var string 归属组织编码
     */
    protected string $organizationCode;

    /**
     * @var string 当前生效版本号，如 1.0.0
     */
    protected string $version;

    /**
     * @var string Agent 名称
     */
    protected string $name = '';

    /**
     * @var string Agent 描述
     */
    protected string $description = '';

    /**
     * @var null|array Agent 图标
     */
    protected ?array $icon = null;

    /**
     * @var int 图标类型: 1-图标, 2-图片
     */
    protected int $iconType = 1;

    /**
     * @var int 智能体类型: 1-内置, 2-自定义
     */
    protected int $type = 2;

    /**
     * @var bool 是否启用
     */
    protected bool $enabled = true;

    /**
     * @var null|array 系统提示词
     */
    protected ?array $prompt = null;

    /**
     * @var null|array 工具列表
     */
    protected ?array $tools = null;

    /**
     * @var string 创建者
     */
    protected string $creator;

    /**
     * @var string 修改者
     */
    protected string $modifier;

    /**
     * @var array Agent 名称（多语言），格式：{"zh":"市场分析师","en":"Marketing Analyst"}
     */
    protected array $nameI18n;

    /**
     * @var null|array 角色定位（多语言），格式：{"zh":["市场分析师","内容创作者"],"en":["Marketing Analyst","Content Creator"]}
     */
    protected ?array $roleI18n = null;

    /**
     * @var null|array 核心职责与适用场景描述（多语言），格式：{"zh":"...","en":"..."}
     */
    protected ?array $descriptionI18n = null;

    /**
     * @var PublishStatus 发布状态：UNPUBLISHED=未发布, PUBLISHING=发布中, PUBLISHED=已发布, OFFLINE=已下架
     */
    protected PublishStatus $publishStatus = PublishStatus::UNPUBLISHED;

    /**
     * @var ReviewStatus 审核状态：PENDING=待审核, UNDER_REVIEW=审核中, APPROVED=审核通过, REJECTED=审核拒绝
     */
    protected ReviewStatus $reviewStatus = ReviewStatus::PENDING;

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

    /**
     * @var null|int 项目ID
     */
    protected ?int $projectId = null;

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
            'code' => $this->code,
            'organization_code' => $this->organizationCode,
            'version' => $this->version,
            'name' => $this->name,
            'description' => $this->description,
            'icon' => $this->icon,
            'icon_type' => $this->iconType,
            'type' => $this->type,
            'enabled' => $this->enabled,
            'prompt' => $this->prompt,
            'tools' => $this->tools,
            'creator' => $this->creator,
            'modifier' => $this->modifier,
            'name_i18n' => $this->nameI18n,
            'role_i18n' => $this->roleI18n,
            'description_i18n' => $this->descriptionI18n,
            'publish_status' => $this->publishStatus->value,
            'review_status' => $this->reviewStatus->value,
            'project_id' => $this->projectId,
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

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): self
    {
        $this->code = $code;
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

    public function getVersion(): string
    {
        return $this->version;
    }

    public function setVersion(string $version): self
    {
        $this->version = $version;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): self
    {
        $this->description = $description;
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

    public function getIconType(): int
    {
        return $this->iconType;
    }

    public function setIconType(int $iconType): self
    {
        $this->iconType = $iconType;
        return $this;
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(int $type): self
    {
        $this->type = $type;
        return $this;
    }

    public function getEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool|int $enabled): self
    {
        $this->enabled = (bool) $enabled;
        return $this;
    }

    public function getPrompt(): ?array
    {
        return $this->prompt;
    }

    public function setPrompt(?array $prompt): self
    {
        $this->prompt = $prompt;
        return $this;
    }

    public function getTools(): ?array
    {
        return $this->tools;
    }

    public function setTools(?array $tools): self
    {
        $this->tools = $tools;
        return $this;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): self
    {
        $this->creator = $creator;
        return $this;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): self
    {
        $this->modifier = $modifier;
        return $this;
    }

    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(array $nameI18n): self
    {
        $this->nameI18n = $nameI18n;
        return $this;
    }

    public function getRoleI18n(): ?array
    {
        return $this->roleI18n;
    }

    public function setRoleI18n(?array $roleI18n): self
    {
        $this->roleI18n = $roleI18n;
        return $this;
    }

    public function getDescriptionI18n(): ?array
    {
        return $this->descriptionI18n;
    }

    public function setDescriptionI18n(?array $descriptionI18n): self
    {
        $this->descriptionI18n = $descriptionI18n;
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

    public function getReviewStatus(): ReviewStatus
    {
        return $this->reviewStatus;
    }

    public function setReviewStatus(ReviewStatus|string $reviewStatus): self
    {
        if ($reviewStatus instanceof ReviewStatus) {
            $this->reviewStatus = $reviewStatus;
        } else {
            $this->reviewStatus = ReviewStatus::from($reviewStatus);
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

    public function getProjectId(): ?int
    {
        return $this->projectId;
    }

    public function setProjectId(?int $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }
}
