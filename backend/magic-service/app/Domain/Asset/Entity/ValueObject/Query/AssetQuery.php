<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity\ValueObject\Query;

use App\Domain\Asset\Entity\ValueObject\AssetScope;
use App\Domain\Asset\Entity\ValueObject\ProviderAssetStatus;

/**
 * 资产列表查询条件。
 */
class AssetQuery
{
    private ?string $keyword = null;

    private ?string $assetKind = null;

    private ?string $assetBusinessType = null;

    private ?string $assetMediaType = null;

    private ?int $parentId = null;

    private ?int $status = null;

    private ?ProviderAssetStatus $complianceStatus = null;

    /** @var string[] */
    private array $ownerUids = [];

    /** @var array<string> */
    private array $tagIds = [];

    private string $tagMatch = 'any';

    /** 查询范围：个人 / 团队分享 / 官方公开 / 全部。 */
    private AssetScope $scope = AssetScope::PERSONAL;

    /**
     * 「团队分享」已授权给当前用户的资产主键。
     *
     * 由应用层从 magic_resource_visibility 解析后传入，仓储只做 IN 过滤，
     * 不直接读权限域的可见性表（见 AssetRepositoryInterface::queries 的约定）。
     *
     * @var array<string>
     */
    private array $sharedAssetIds = [];

    public function getKeyword(): ?string
    {
        return $this->keyword;
    }

    public function setKeyword(?string $keyword): void
    {
        $keyword = trim((string) $keyword);
        $this->keyword = $keyword === '' ? null : $keyword;
    }

    public function getAssetKind(): ?string
    {
        return $this->assetKind;
    }

    public function setAssetKind(?string $assetKind): void
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

    public function getParentId(): ?int
    {
        return $this->parentId;
    }

    public function setParentId(?int $parentId): void
    {
        $this->parentId = $parentId;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(?int $status): void
    {
        $this->status = $status;
    }

    public function getComplianceStatus(): ?ProviderAssetStatus
    {
        return $this->complianceStatus;
    }

    public function setComplianceStatus(?string $complianceStatus): void
    {
        $this->complianceStatus = $complianceStatus === null
            ? null
            : ProviderAssetStatus::fromValue($complianceStatus);
    }

    public function getOwnerUids(): array
    {
        return $this->ownerUids;
    }

    public function setOwnerUids(array $ownerUids): void
    {
        $this->ownerUids = array_values(array_unique(array_filter(array_map('strval', $ownerUids), static fn (string $id): bool => trim($id) !== '')));
    }

    public function getTagIds(): array
    {
        return $this->tagIds;
    }

    public function setTagIds(array $tagIds): void
    {
        $this->tagIds = array_values(array_unique(array_map('strval', $tagIds)));
    }

    public function getTagMatch(): string
    {
        return $this->tagMatch;
    }

    public function setTagMatch(string $tagMatch): void
    {
        $this->tagMatch = in_array($tagMatch, ['any', 'all'], true) ? $tagMatch : 'any';
    }

    public function getScope(): AssetScope
    {
        return $this->scope;
    }

    public function setScope(AssetScope $scope): void
    {
        $this->scope = $scope;
    }

    /**
     * @return array<string>
     */
    public function getSharedAssetIds(): array
    {
        return $this->sharedAssetIds;
    }

    /**
     * @param array<string> $sharedAssetIds
     */
    public function setSharedAssetIds(array $sharedAssetIds): void
    {
        $this->sharedAssetIds = array_values($sharedAssetIds);
    }
}
