<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class AssetDTO extends AbstractDTO
{
    /**
     * 雪花 ID 一律以字符串返回。
     *
     * 主键是 19 位数字（如 958097509326077953），超过 JavaScript Number 的 53 位安全整数范围，
     * 直接给数字会在前端被静默截断成另一个值（958097509326077950），拿到它再回传就是别的素材。
     */
    public ?string $assetId = null;

    public string $assetKind = '';

    public ?string $assetBusinessType = null;

    public ?string $assetMediaType = null;

    public ?string $parentId = null;

    public string $name = '';

    public string $description = '';

    public ?string $fileUrl = null;

    /** 原始素材文件键，前端可据此重新解析最新 file_url。 */
    public ?string $fileKey = null;

    /** 合规校验结论：UNVERIFIED / PROCESSING / PASS / FAILED。 */
    public ?string $complianceStatus = 'UNVERIFIED';

    /** 合规校验未通过的原因；只有 FAILED 时有值。 */
    public ?string $complianceFailedReason = null;

    /** 合规结论的来源：VOLCENGINE / NO_PERSON / REUSED。 */
    public string $complianceReviewMode = 'VOLCENGINE';

    /** 当前素材归属人（历史数据回退到 user_id）。 */
    public array $owner = ['id' => null, 'name' => ''];

    public ?string $ownerUid = null;

    /** PERSONAL=当前用户自己的素材，TEAM=团队分享素材。 */
    public string $source = 'PERSONAL';

    public string $visibilityType = 'PERSONAL';

    /** @var array<int, array<string, mixed>> */
    public array $tags = [];

    public function getAssetId(): ?string
    {
        return $this->assetId;
    }

    public function setAssetId(null|int|string $assetId): void
    {
        $this->assetId = $assetId === null ? null : (string) $assetId;
    }

    public function getAssetKind(): string
    {
        return $this->assetKind;
    }

    public function setAssetKind(string $assetKind): void
    {
        $this->assetKind = $assetKind;
    }

    public function getAssetBusinessType(): ?string
    {
        return $this->assetBusinessType;
    }

    public function setAssetBusinessType(?string $assetBusinessType): void
    {
        $this->assetBusinessType = $assetBusinessType;
    }

    public function getAssetMediaType(): ?string
    {
        return $this->assetMediaType;
    }

    public function setAssetMediaType(?string $assetMediaType): void
    {
        $this->assetMediaType = $assetMediaType;
    }

    public function getParentId(): ?string
    {
        return $this->parentId;
    }

    public function setParentId(null|int|string $parentId): void
    {
        $this->parentId = $parentId === null ? null : (string) $parentId;
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

    public function getFileUrl(): ?string
    {
        return $this->fileUrl;
    }

    public function setFileUrl(?string $fileUrl): void
    {
        $this->fileUrl = $fileUrl;
    }

    public function getFileKey(): ?string
    {
        return $this->fileKey;
    }

    public function setFileKey(?string $fileKey): void
    {
        $this->fileKey = $fileKey;
    }

    public function getComplianceStatus(): ?string
    {
        return $this->complianceStatus;
    }

    public function setComplianceStatus(?string $complianceStatus): void
    {
        $this->complianceStatus = $complianceStatus;
    }

    public function getComplianceFailedReason(): ?string
    {
        return $this->complianceFailedReason;
    }

    public function setComplianceFailedReason(?string $complianceFailedReason): void
    {
        $this->complianceFailedReason = $complianceFailedReason;
    }

    public function getComplianceReviewMode(): string
    {
        return $this->complianceReviewMode;
    }

    public function setComplianceReviewMode(string $complianceReviewMode): void
    {
        $this->complianceReviewMode = $complianceReviewMode;
    }

    public function setOwner(?string $id, string $name = ''): void
    {
        $this->owner = ['id' => $id, 'name' => $name];
    }

    public function setOwnerUid(null|int|string $ownerUid): void
    {
        $this->ownerUid = $ownerUid === null ? null : (string) $ownerUid;
    }

    public function setSource(string $source): void
    {
        $this->source = $source;
    }

    public function setVisibilityType(string $visibilityType): void
    {
        $this->visibilityType = $visibilityType;
    }

    public function setTags(array $tags): void
    {
        $this->tags = array_values($tags);
    }
}
