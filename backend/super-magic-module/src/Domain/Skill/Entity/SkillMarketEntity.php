<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishStatus;

/**
 * 市场 Skill 实体.
 */
class SkillMarketEntity extends AbstractEntity
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
     * @var string Skill 唯一标识码，对应 magic_skill_versions.code
     */
    protected string $skillCode;

    /**
     * @var int 关联的 Skill 版本 ID，对应 magic_skill_versions.id
     */
    protected int $skillVersionId;

    /**
     * @var null|array 多语言展示名称
     */
    protected ?array $nameI18n = null;

    /**
     * @var null|array 多语言展示描述
     */
    protected ?array $descriptionI18n = null;

    /**
     * @var null|string Logo 图片 URL
     */
    protected ?string $logo = null;

    /**
     * @var string 发布者用户 ID
     */
    protected string $publisherId;

    /**
     * @var PublisherType 发布者类型
     */
    protected PublisherType $publisherType = PublisherType::USER;

    /**
     * @var null|int 分类 ID
     */
    protected ?int $categoryId = null;

    /**
     * @var PublishStatus 发布状态
     */
    protected PublishStatus $publishStatus = PublishStatus::UNPUBLISHED;

    /**
     * @var int 安装次数
     */
    protected int $installCount = 0;

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
            'skill_code' => $this->skillCode,
            'skill_version_id' => $this->skillVersionId,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'logo' => $this->logo,
            'publisher_id' => $this->publisherId,
            'publisher_type' => $this->publisherType->value,
            'category_id' => $this->categoryId,
            'publish_status' => $this->publishStatus->value,
            'install_count' => $this->installCount,
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

    public function getSkillCode(): string
    {
        return $this->skillCode;
    }

    public function setSkillCode(string $skillCode): self
    {
        $this->skillCode = $skillCode;
        return $this;
    }

    public function getSkillVersionId(): int
    {
        return $this->skillVersionId;
    }

    public function setSkillVersionId(int|string $skillVersionId): self
    {
        $this->skillVersionId = is_string($skillVersionId) ? (int) $skillVersionId : $skillVersionId;
        return $this;
    }

    public function getNameI18n(): ?array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(?array $nameI18n): self
    {
        $this->nameI18n = $nameI18n;
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

    public function getLogo(): ?string
    {
        return $this->logo;
    }

    public function setLogo(?string $logo): self
    {
        $this->logo = $logo;
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
        if (empty($this->nameI18n)) {
            return '';
        }

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
        if (empty($this->descriptionI18n)) {
            return '';
        }

        if (! empty($this->descriptionI18n[$language])) {
            return $this->descriptionI18n[$language];
        }

        if (! empty($this->descriptionI18n[LanguageEnum::DEFAULT->value])) {
            return $this->descriptionI18n[LanguageEnum::DEFAULT->value];
        }

        return '';
    }
}
