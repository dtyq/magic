<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;

/**
 * Skill 基础实体.
 */
class SkillEntity extends AbstractEntity
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
     * @var string Skill 唯一标识码，同一 Skill 的所有版本共享同一个 code
     */
    protected string $code;

    /**
     * @var string 创建者用户 ID
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
     * @var array 多语言展示名，格式：{"en":"Web Search","zh":"网页搜索"}
     */
    protected array $nameI18n;

    /**
     * @var null|array 多语言展示描述
     */
    protected ?array $descriptionI18n = null;

    /**
     * @var null|string Logo 图片 URL
     */
    protected ?string $logo = null;

    /**
     * @var string 压缩包在对象存储中的 key
     */
    protected string $fileKey;

    protected ?string $fileUrl = null;

    /**
     * @var SkillSourceType 来源类型：LOCAL_UPLOAD=本地上传, STORE=商店添加, GITHUB=GitHub 导入
     */
    protected SkillSourceType $sourceType = SkillSourceType::LOCAL_UPLOAD;

    /**
     * @var null|int 来源关联 ID：source_type=STORE 时关联 magic_skill_market.id
     */
    protected ?int $sourceId = null;

    /**
     * @var null|array 来源扩展元数据
     */
    protected ?array $sourceMeta = null;

    /**
     * @var null|int 版本ID，对应 magic_skill_versions.id
     */
    protected ?int $versionId = null;

    /**
     * @var null|string 版本号，对应 magic_skill_versions.version
     */
    protected ?string $versionCode = null;

    /**
     * @var bool 是否启用：0=禁用, 1=启用
     */
    protected bool $isEnabled = true;

    /**
     * @var null|string 置顶时间，NULL 表示未置顶
     */
    protected ?string $pinnedAt = null;

    /**
     * @var null|int 项目ID
     */
    protected ?int $projectId = null;

    /**
     * @var null|string Latest published timestamp
     */
    protected ?string $latestPublishedAt = null;

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
            'code' => $this->code,
            'creator_id' => $this->creatorId,
            'package_name' => $this->packageName,
            'package_description' => $this->packageDescription,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'logo' => $this->logo,
            'file_key' => $this->fileKey,
            'source_type' => $this->sourceType->value,
            'source_id' => $this->sourceId,
            'source_meta' => $this->sourceMeta,
            'version_id' => $this->versionId,
            'version_code' => $this->versionCode,
            'is_enabled' => $this->isEnabled ? 1 : 0,
            'pinned_at' => $this->pinnedAt,
            'project_id' => $this->projectId,
            'latest_published_at' => $this->latestPublishedAt,
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

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): self
    {
        $this->code = $code;
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

    public function getLogo(): ?string
    {
        return $this->logo;
    }

    public function setLogo(?string $logo): self
    {
        $this->logo = $logo;
        return $this;
    }

    public function getFileUrl(): ?string
    {
        return $this->fileUrl;
    }

    public function setFileUrl(?string $fileUrl): self
    {
        $this->fileUrl = $fileUrl;
        return $this;
    }

    public function getFileKey(): string
    {
        return $this->fileKey;
    }

    public function setFileKey(string $fileKey): self
    {
        $this->fileKey = $fileKey;
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
            $this->sourceType = SkillSourceType::from($sourceType);
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

    public function getVersionId(): ?int
    {
        return $this->versionId;
    }

    public function setVersionId(null|int|string $versionId): self
    {
        if ($versionId === null) {
            $this->versionId = null;
        } else {
            $this->versionId = is_string($versionId) ? (int) $versionId : $versionId;
        }
        return $this;
    }

    public function getVersionCode(): ?string
    {
        return $this->versionCode;
    }

    public function setVersionCode(?string $versionCode): self
    {
        $this->versionCode = $versionCode;
        return $this;
    }

    public function getIsEnabled(): bool
    {
        return $this->isEnabled;
    }

    public function setIsEnabled(bool|int $isEnabled): self
    {
        $this->isEnabled = (bool) $isEnabled;
        return $this;
    }

    public function getPinnedAt(): ?string
    {
        return $this->pinnedAt;
    }

    public function setPinnedAt(?string $pinnedAt): self
    {
        $this->pinnedAt = $pinnedAt;
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

    public function getLatestPublishedAt(): ?string
    {
        return $this->latestPublishedAt;
    }

    public function setLatestPublishedAt(?string $latestPublishedAt): self
    {
        $this->latestPublishedAt = $latestPublishedAt;
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
