<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Service;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\AssetTagEntity;
use App\Domain\Asset\Entity\ValueObject\AssetTagNodeType;
use App\Domain\Asset\Repository\Facade\AssetRepositoryInterface;
use App\Domain\Asset\Repository\Facade\AssetTagRelationRepositoryInterface;
use App\Domain\Asset\Repository\Facade\AssetTagRepositoryInterface;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\DbConnection\Db;

class AssetTagDomainService
{
    public function __construct(
        private readonly AssetTagRepositoryInterface $tags,
        private readonly AssetTagRelationRepositoryInterface $relations,
        private readonly AssetRepositoryInterface $assets,
        private readonly AssetSearchTextBuilder $searchTextBuilder,
    ) {
    }

    /**
     * @param null|string $businessType 只看某个业务类型的标签；null 表示不过滤（后台管理查看全部）
     * @return AssetTagEntity[]
     */
    public function listVisible(AssetDataIsolation $dataIsolation, ?string $businessType = null): array
    {
        return $this->tags->queryVisibleTree($dataIsolation, $dataIsolation->getCurrentUserId(), $businessType);
    }

    /** @param array<int, array{name_i18n: array{default: string, zh_CN: string, en_US: string}, tags: array<int, array{default: string, zh_CN: string, en_US: string}>}> $groups */
    public function initializeSystemTags(AssetDataIsolation $dataIsolation, array $groups): array
    {
        $groupCount = count($groups);
        $tagCount = 0;
        Db::transaction(function () use ($dataIsolation, $groups, $groupCount, &$tagCount): void {
            foreach ($groups as $groupIndex => $group) {
                $groupEntity = $this->saveSystemTag(
                    $dataIsolation,
                    $group['name_i18n'],
                    AssetTagNodeType::Group,
                    0,
                    ($groupCount - $groupIndex) * 100,
                );
                $childCount = count($group['tags']);
                foreach ($group['tags'] as $tagIndex => $tagNameI18n) {
                    $this->saveSystemTag(
                        $dataIsolation,
                        $tagNameI18n,
                        AssetTagNodeType::Tag,
                        (int) $groupEntity->getId(),
                        ($childCount - $tagIndex) * 100,
                    );
                    ++$tagCount;
                }
            }
        });
        return ['groups' => $groupCount, 'tags' => $tagCount];
    }

    public function create(AssetDataIsolation $dataIsolation, string $name, AssetTagNodeType $nodeType, int $parentId): AssetTagEntity
    {
        $this->assertStructure($dataIsolation, $nodeType, $parentId);
        $uid = $dataIsolation->getCurrentUserId();
        $entity = (new AssetTagEntity())
            ->setOrganizationCode($dataIsolation->getCurrentOrganizationCode())
            ->setNameI18n(['default' => trim($name)])
            ->setNodeType($nodeType->value)
            ->setParentId($parentId)
            ->setOwnerUid($uid)
            ->setCreatedUid($uid)
            ->setUpdatedUid($uid);
        return $this->tags->save($dataIsolation, $entity);
    }

    public function createOfficial(
        AssetDataIsolation $dataIsolation,
        string $name,
        AssetTagNodeType $nodeType,
        int $parentId,
        string $businessType = AssetTagEntity::DEFAULT_BUSINESS_TYPE,
    ): AssetTagEntity {
        $this->assertStructure($dataIsolation, $nodeType, $parentId, null, $businessType);
        $uid = $dataIsolation->getCurrentUserId();
        $entity = (new AssetTagEntity())
            ->setOrganizationCode($dataIsolation->getCurrentOrganizationCode())
            ->setBusinessType($businessType)
            ->setNameI18n(['default' => trim($name)])
            ->setNodeType($nodeType->value)
            ->setParentId($parentId)
            ->setCreatedUid($uid)
            ->setUpdatedUid($uid);
        return $this->tags->save($dataIsolation, $entity);
    }

    public function updateOfficial(AssetDataIsolation $dataIsolation, int|string $id, string $name, AssetTagNodeType $nodeType, int $parentId): AssetTagEntity
    {
        $entity = $this->tags->findById($dataIsolation, $id);
        if ($entity === null || $entity->getOwnerUid() !== null) {
            ExceptionBuilder::throw(AssetErrorCode::TAG_NOT_ALLOWED);
        }
        // 业务类型创建后不可更改，移动节点时只检查它与新父级是否同类型。
        $this->assertStructure($dataIsolation, $nodeType, $parentId, $id, $entity->getBusinessType());
        $entity->setNameI18n(['default' => trim($name)])->setParentId($parentId)->setUpdatedUid($dataIsolation->getCurrentUserId());
        return $this->tags->save($dataIsolation, $entity);
    }

    public function deleteOfficial(AssetDataIsolation $dataIsolation, int|string $id): void
    {
        $entity = $this->tags->findById($dataIsolation, $id);
        if ($entity === null || $entity->getOwnerUid() !== null) {
            ExceptionBuilder::throw(AssetErrorCode::TAG_NOT_ALLOWED);
        }
        if ($this->tags->hasChildren($dataIsolation, $id)) {
            ExceptionBuilder::throw(AssetErrorCode::GROUP_NOT_EMPTY);
        }
        $this->relations->deleteByTagId($dataIsolation, $id);
        if (! $this->tags->delete($dataIsolation, $id)) {
            ExceptionBuilder::throw(AssetErrorCode::TAG_NOT_FOUND);
        }
    }

    public function update(AssetDataIsolation $dataIsolation, int|string $id, string $name, AssetTagNodeType $nodeType, int $parentId): AssetTagEntity
    {
        $entity = $this->findOwned($dataIsolation, $id);
        $this->assertStructure($dataIsolation, $nodeType, $parentId, $id);
        $entity->setNameI18n(['default' => trim($name)])->setParentId($parentId)->setUpdatedUid($dataIsolation->getCurrentUserId());
        $saved = $this->tags->save($dataIsolation, $entity);
        $this->rebuildSearchText($dataIsolation, $id);
        return $saved;
    }

    public function delete(AssetDataIsolation $dataIsolation, int|string $id): void
    {
        $entity = $this->findOwned($dataIsolation, $id);
        if ($this->tags->hasChildren($dataIsolation, $id)) {
            ExceptionBuilder::throw(AssetErrorCode::GROUP_NOT_EMPTY);
        }
        $assetIds = $this->relations->findAssetIdsByTagId($dataIsolation, $id);
        Db::transaction(function () use ($dataIsolation, $id): void {
            $this->relations->deleteByTagId($dataIsolation, $id);
            if (! $this->tags->delete($dataIsolation, $id, $dataIsolation->getCurrentUserId())) {
                ExceptionBuilder::throw(AssetErrorCode::TAG_NOT_FOUND);
            }
        });
        $this->rebuildSearchTextForAssets($dataIsolation, $assetIds);
    }

    /** @param array<int, int|string> $tagIds */
    public function syncAssetTags(AssetDataIsolation $dataIsolation, AssetEntity $asset, array $tagIds): void
    {
        $tags = $this->resolveUsableTags($dataIsolation, $tagIds, $asset->getAssetBusinessType());
        $asset->setSearchText($this->searchTextBuilder->build($asset, $tags));
        Db::transaction(function () use ($dataIsolation, $asset, $tags): void {
            $this->relations->syncAssetTags($dataIsolation, (string) $asset->getId(), array_map(static fn (AssetTagEntity $tag): int => (int) $tag->getId(), $tags), $dataIsolation->getCurrentUserId());
            $this->assets->update($dataIsolation, $asset);
        });
        $asset->setTags($tags);
    }

    /** @return AssetTagEntity[] */
    public function findAssetTags(AssetDataIsolation $dataIsolation, int|string $assetId): array
    {
        return $this->findTagsByAssetIds($dataIsolation, [$assetId])[(string) $assetId] ?? [];
    }

    /**
     * Batch variant of findAssetTags for list assembly: one relation query plus one tag query
     * for the whole page, instead of two queries per asset.
     *
     * @param array<int, int|string> $assetIds
     * @return array<string, AssetTagEntity[]> keyed by asset ID; assets without tags are absent
     */
    public function findTagsByAssetIds(AssetDataIsolation $dataIsolation, array $assetIds): array
    {
        $tagIdsByAsset = $this->relations->findTagIdsByAssetIds($dataIsolation, $assetIds);
        $tagIds = [];
        foreach ($tagIdsByAsset as $ids) {
            foreach ($ids as $tagId) {
                $tagIds[$tagId] = $tagId;
            }
        }
        $tags = $this->tags->findByIds($dataIsolation, array_values($tagIds));
        $currentUserId = $dataIsolation->getCurrentUserId();
        $result = [];
        foreach ($tagIdsByAsset as $assetId => $ids) {
            foreach ($ids as $tagId) {
                $tag = $tags[(string) $tagId] ?? null;
                // Personal tags are only visible to their owner; official tags (no owner) to everyone.
                if ($tag !== null && ($tag->getOwnerUid() === null || $tag->getOwnerUid() === $currentUserId)) {
                    $result[(string) $assetId][] = $tag;
                }
            }
        }
        return $result;
    }

    public function stripPersonalTagsForTransfer(AssetDataIsolation $dataIsolation, AssetEntity $asset): void
    {
        $officialTagIds = array_map(
            static fn (AssetTagEntity $tag): int => (int) $tag->getId(),
            array_filter($this->findAssetTags($dataIsolation, (string) $asset->getId()), static fn (AssetTagEntity $tag): bool => $tag->getOwnerUid() === null),
        );
        $this->syncAssetTags($dataIsolation, $asset, $officialTagIds);
    }

    private function saveSystemTag(AssetDataIsolation $dataIsolation, array $nameI18n, AssetTagNodeType $nodeType, int $parentId, int $sort): AssetTagEntity
    {
        $entity = $this->tags->findOfficialByName($dataIsolation, $nameI18n, $nodeType->value, $parentId)
            ?? new AssetTagEntity();
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode())
            ->setParentId($parentId)
            ->setNodeType($nodeType)
            ->setNameI18n($nameI18n)
            ->setStatus(1)
            ->setSort($sort)
            ->setOwnerUid(null)
            ->setCreatedUid($entity->getCreatedUid() ?? 'system')
            ->setUpdatedUid('system');
        return $this->tags->save($dataIsolation, $entity);
    }

    private function findOwned(AssetDataIsolation $dataIsolation, int|string $id): AssetTagEntity
    {
        $entity = $this->tags->findById($dataIsolation, $id);
        if ($entity === null) {
            ExceptionBuilder::throw(AssetErrorCode::TAG_NOT_FOUND);
        }
        if ($entity->getOwnerUid() === null || $entity->getOwnerUid() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(AssetErrorCode::TAG_NOT_ALLOWED);
        }
        return $entity;
    }

    /**
     * 个人标签允许直接建在根级：根级节点既可以是标签组，也可以是暂时没有下级的普通标签。
     * 树最多两级，二级节点只能挂在根级节点下，不能再被挂子级。
     */
    private function assertStructure(
        AssetDataIsolation $dataIsolation,
        AssetTagNodeType $nodeType,
        int $parentId,
        null|int|string $ignoreId = null,
        string $businessType = AssetTagEntity::DEFAULT_BUSINESS_TYPE,
    ): void {
        if ($parentId === 0) {
            return;
        }
        // 标签组只能作为根级节点。
        if ($nodeType === AssetTagNodeType::Group) {
            ExceptionBuilder::throw(AssetErrorCode::TAG_STRUCTURE_INVALID);
        }
        $parent = $this->tags->findById($dataIsolation, $parentId);
        if ($parent === null
            || $parent->getParentId() !== 0
            || ($ignoreId !== null && (string) $parent->getId() === (string) $ignoreId)
        ) {
            ExceptionBuilder::throw(AssetErrorCode::TAG_STRUCTURE_INVALID);
        }
        // 自身已有下级的节点不能再下沉为二级节点，否则树会出现第三层。
        if ($ignoreId !== null && $this->tags->hasChildren($dataIsolation, $ignoreId)) {
            ExceptionBuilder::throw(AssetErrorCode::TAG_STRUCTURE_INVALID);
        }
        if ($parent->getOwnerUid() !== null && $parent->getOwnerUid() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(AssetErrorCode::TAG_NOT_ALLOWED);
        }
        // 标签组和其下的标签必须属于同一业务类型，否则一个组里会混进别的场景的标签。
        if ($parent->getBusinessType() !== $businessType) {
            ExceptionBuilder::throw(AssetErrorCode::TAG_STRUCTURE_INVALID);
        }
    }

    /**
     * 素材只能挂同业务类型的标签：头像库的标签不能挂到通用素材上，反之亦然。
     * 素材未指定业务类型时按通用处理，与创建素材时的默认值一致。
     *
     * @return AssetTagEntity[]
     */
    private function resolveUsableTags(AssetDataIsolation $dataIsolation, array $tagIds, ?string $assetBusinessType = null): array
    {
        $businessType = trim((string) $assetBusinessType) === '' ? AssetTagEntity::DEFAULT_BUSINESS_TYPE : trim((string) $assetBusinessType);
        $result = [];
        foreach (array_values(array_unique(array_filter(array_map('intval', $tagIds), static fn (int $id): bool => $id > 0))) as $tagId) {
            $tag = $this->tags->findById($dataIsolation, $tagId);
            // 有下级的节点是标签组，不能直接挂到素材上。
            if ($tag === null
                || $this->tags->hasChildren($dataIsolation, $tagId)
                || ($tag->getOwnerUid() !== null && $tag->getOwnerUid() !== $dataIsolation->getCurrentUserId())
                || $tag->getBusinessType() !== $businessType
            ) {
                ExceptionBuilder::throw(AssetErrorCode::TAG_NOT_ALLOWED);
            }
            $result[] = $tag;
        }
        return $result;
    }

    private function rebuildSearchText(AssetDataIsolation $dataIsolation, int|string $tagId): void
    {
        $this->rebuildSearchTextForAssets($dataIsolation, $this->relations->findAssetIdsByTagId($dataIsolation, $tagId));
    }

    /** @param int[] $assetIds */
    private function rebuildSearchTextForAssets(AssetDataIsolation $dataIsolation, array $assetIds): void
    {
        foreach ($assetIds as $assetId) {
            $asset = $this->assets->findById($dataIsolation, $assetId);
            if ($asset !== null) {
                $this->syncAssetTags($dataIsolation, $asset, $this->relations->findTagIdsByAssetId($dataIsolation, $assetId));
            }
        }
    }
}
