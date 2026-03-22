<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetValue;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;

/**
 * Skill 版本实体.
 */
class SkillVersionEntity extends AbstractEntity
{
    /**
     * @var int 主键 ID（版本ID）
     */
    protected ?int $id = null;

    /**
     * @var string Skill 唯一标识码，对应 magic_skills.code
     */
    protected string $code;

    /**
     * @var string 归属组织编码
     */
    protected string $organizationCode;

    /**
     * @var string 创建操作人用户 ID
     */
    protected string $creatorId;

    /**
     * @var string Skill 包唯一标识名，来自压缩包 skill.md
     */
    protected string $packageName;

    /**
     * @var null|string Skill 包描述，来自压缩包 skill.md
     */
    protected ?string $packageDescription = null;

    /**
     * @var string 当前生效版本号，如 1.0.0
     */
    protected string $version;

    /**
     * @var array 多语言展示名，格式：{"en":"Web Search","zh":"网页搜索"}
     */
    protected array $nameI18n;

    /**
     * @var null|array 多语言展示描述
     */
    protected ?array $descriptionI18n = null;

    /**
     * @var null|string 统一小写搜索字段
     */
    protected ?string $searchText = null;

    /**
     * @var null|string Logo 图片 URL
     */
    protected ?string $logo = null;

    /**
     * @var string 压缩包在对象存储中的 key
     */
    protected ?string $fileKey = null;

    protected ?string $fileUrl = null;

    /**
     * @var PublishStatus 发布状态
     */
    protected PublishStatus $publishStatus = PublishStatus::UNPUBLISHED;

    /**
     * @var null|ReviewStatus 审核状态
     */
    protected ?ReviewStatus $reviewStatus = ReviewStatus::PENDING;

    /**
     * @var PublishTargetType Publish target type
     */
    protected PublishTargetType $publishTargetType = PublishTargetType::MARKET;

    /**
     * @var null|PublishTargetValue 实际发布目标值，仅 MEMBER 发布时使用
     */
    protected ?PublishTargetValue $publishTargetValue = null;

    /**
     * @var null|array Version description in i18n format
     */
    protected ?array $versionDescriptionI18n = null;

    /**
     * @var null|string Publisher user ID
     */
    protected ?string $publisherUserId = null;

    /**
     * @var null|string Published timestamp
     */
    protected ?string $publishedAt = null;

    /**
     * @var bool Whether this is the current version
     */
    protected bool $isCurrentVersion = false;

    /**
     * @var SkillSourceType 来源类型
     */
    protected SkillSourceType $sourceType;

    /**
     * @var null|int 来源关联 ID：source_type=STORE 时关联 magic_skill_market.id
     */
    protected ?int $sourceId = null;

    /**
     * @var null|array 来源扩展元数据
     */
    protected ?array $sourceMeta = null;

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
            'creator_id' => $this->creatorId,
            'package_name' => $this->packageName,
            'package_description' => $this->packageDescription,
            'version' => $this->version,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'search_text' => $this->searchText,
            'logo' => $this->logo,
            'file_key' => $this->fileKey,
            'publish_status' => $this->publishStatus->value,
            'review_status' => $this->reviewStatus?->value,
            'publish_target_type' => $this->publishTargetType->value,
            'publish_target_value' => $this->publishTargetValue?->toArray(),
            'version_description_i18n' => $this->versionDescriptionI18n,
            'publisher_user_id' => $this->publisherUserId,
            'published_at' => $this->publishedAt,
            'is_current_version' => $this->isCurrentVersion,
            'source_type' => $this->sourceType->value,
            'source_id' => $this->sourceId,
            'source_meta' => $this->sourceMeta,
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

    public function getCreatorId(): string
    {
        return $this->creatorId;
    }

    public function setCreatorId(string $creatorId): self
    {
        $this->creatorId = $creatorId;
        return $this;
    }

    public function getPackageName(): string
    {
        return $this->packageName;
    }

    public function setPackageName(string $packageName): self
    {
        $this->packageName = $packageName;
        return $this;
    }

    public function getPackageDescription(): ?string
    {
        return $this->packageDescription;
    }

    public function setPackageDescription(?string $packageDescription): self
    {
        $this->packageDescription = $packageDescription;
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

    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(array $nameI18n): self
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

    public function getSearchText(): ?string
    {
        return $this->searchText;
    }

    public function setSearchText(?string $searchText): self
    {
        $this->searchText = $searchText;
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

    public function getFileKey(): ?string
    {
        return $this->fileKey;
    }

    public function setFileKey(?string $fileKey): void
    {
        $this->fileKey = $fileKey;
    }

    /**
     * Note: File links must be obtained from the file service using the file_key.
     */
    public function getFileUrl(): ?string
    {
        return $this->fileUrl;
    }

    /**
     * Note: File links will not be stored in the database.
     */
    public function setFileUrl(?string $fileUrl): void
    {
        $this->fileUrl = $fileUrl;
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

    public function getReviewStatus(): ?ReviewStatus
    {
        return $this->reviewStatus;
    }

    public function setReviewStatus(null|ReviewStatus|string $reviewStatus): self
    {
        if ($reviewStatus === null) {
            $this->reviewStatus = null;
            return $this;
        }
        if ($reviewStatus instanceof ReviewStatus) {
            $this->reviewStatus = $reviewStatus;
        } else {
            $this->reviewStatus = ReviewStatus::from($reviewStatus);
        }
        return $this;
    }

    public function getPublishTargetType(): PublishTargetType
    {
        return $this->publishTargetType;
    }

    public function setPublishTargetType(PublishTargetType|string $publishTargetType): self
    {
        if ($publishTargetType instanceof PublishTargetType) {
            $this->publishTargetType = $publishTargetType;
        } else {
            $this->publishTargetType = PublishTargetType::from($publishTargetType);
        }
        return $this;
    }

    public function getPublishTargetValue(): ?PublishTargetValue
    {
        return $this->publishTargetValue;
    }

    public function setPublishTargetValue(null|array|PublishTargetValue $publishTargetValue): self
    {
        if (is_array($publishTargetValue)) {
            $publishTargetValue = PublishTargetValue::fromArray($publishTargetValue);
        }

        $this->publishTargetValue = $publishTargetValue;
        return $this;
    }

    public function getVersionDescriptionI18n(): ?array
    {
        return $this->versionDescriptionI18n;
    }

    public function setVersionDescriptionI18n(?array $versionDescriptionI18n): self
    {
        $this->versionDescriptionI18n = $versionDescriptionI18n;
        return $this;
    }

    public function getPublisherUserId(): ?string
    {
        return $this->publisherUserId;
    }

    public function setPublisherUserId(?string $publisherUserId): self
    {
        $this->publisherUserId = $publisherUserId;
        return $this;
    }

    public function getPublishedAt(): ?string
    {
        return $this->publishedAt;
    }

    public function setPublishedAt(?string $publishedAt): self
    {
        $this->publishedAt = $publishedAt;
        return $this;
    }

    public function isCurrentVersion(): bool
    {
        return $this->isCurrentVersion;
    }

    public function setIsCurrentVersion(bool|int $isCurrentVersion): self
    {
        $this->isCurrentVersion = (bool) $isCurrentVersion;
        return $this;
    }

    public function getSourceType(): SkillSourceType
    {
        return $this->sourceType;
    }

    public function setSourceType(SkillSourceType|string $sourceType): self
    {
        if ($sourceType instanceof SkillSourceType) {
            $this->sourceType = $sourceType;
        } else {
            $this->sourceType = SkillSourceType::tryFrom($sourceType) ?? SkillSourceType::LOCAL_UPLOAD;
        }
        return $this;
    }

    public function getSourceId(): ?int
    {
        return $this->sourceId;
    }

    public function setSourceId(null|int|string $sourceId): self
    {
        if ($sourceId === null) {
            $this->sourceId = null;
        } else {
            $this->sourceId = is_string($sourceId) ? (int) $sourceId : $sourceId;
        }
        return $this;
    }

    public function getSourceMeta(): ?array
    {
        return $this->sourceMeta;
    }

    public function setSourceMeta(?array $sourceMeta): self
    {
        $this->sourceMeta = $sourceMeta;
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
