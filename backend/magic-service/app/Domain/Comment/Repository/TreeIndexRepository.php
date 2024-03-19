<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Comment\Repository;

use App\Domain\Comment\Entity\TreeIndexEntity;
use App\Domain\Comment\Repository\Model\AbstractTreeIndexModel;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Model\Builder;

class TreeIndexRepository
{
    public function __construct(
    ) {
    }

    /**
     * @return array<TreeIndexEntity>
     */
    public function createIndexes(
        string $organizationCode,
        Builder $builder,
        int $newNodeParentId,
        int $newNodeId,
    ): array {
        $treeIndexEntities = $this->buildTreeIndexesByDescendantId(
            $organizationCode,
            $builder,
            $newNodeParentId,
            $newNodeId
        );
        $this->batchInsert($builder, $treeIndexEntities);

        return $treeIndexEntities;
    }

    /**
     * 假设现在的父子级关系是1 -> 2 -> 3 -> 4，现在需要在4的后面插入5，那么需要做的操作是：
     * 获取到4的所有祖先节点，然后使用4的所有祖先节点去更新5的祖先节点，然后再创建一条5 -> 5的关系。
     * 1->4
     * 2->4
     * 3->4
     * 4->4.
     *
     * 1->5
     * 2->5
     * 3->5
     * 4->5
     * 5->5
     * @return array<TreeIndexEntity>
     */
    public function buildTreeIndexesByDescendantId(
        string $organizationCode,
        Builder $builder,
        int $newNodeParentId,
        int $newNodeId,
    ): array {
        /** @var array<AbstractTreeIndexModel> $results */
        $results = $builder->where('descendant_id', $newNodeParentId)
            ->where('organization_code', $organizationCode)
            ->orderBy('distance')
            ->get();
        $treeIndexEntities = [];
        $datetime = date('Y-m-d H:i:s');
        foreach ($results as $result) {
            $treeIndexEntity = new TreeIndexEntity();
            $treeIndexEntity->setId(IdGenerator::getSnowId());
            $treeIndexEntity->setAncestorId($result->ancestor_id);
            $treeIndexEntity->setDescendantId($newNodeId);
            $treeIndexEntity->setDistance($result->distance + 1);
            $treeIndexEntity->setOrganizationCode($result->organization_code);
            $treeIndexEntity->setCreatedAt($datetime);
            $treeIndexEntity->setUpdatedAt($datetime);
            $treeIndexEntities[] = $treeIndexEntity;
        }
        $treeIndexEntity = new TreeIndexEntity();
        $treeIndexEntity->setId(IdGenerator::getSnowId());
        $treeIndexEntity->setAncestorId($newNodeId);
        $treeIndexEntity->setDescendantId($newNodeId);
        $treeIndexEntity->setDistance(0);
        $treeIndexEntity->setOrganizationCode($organizationCode);
        $treeIndexEntity->setCreatedAt($datetime);
        $treeIndexEntity->setUpdatedAt($datetime);
        $treeIndexEntities[] = $treeIndexEntity;

        return $treeIndexEntities;
    }

    /**
     * @param array<TreeIndexEntity> $treeIndexEntities
     */
    public function batchInsert(
        Builder $builder,
        array $treeIndexEntities
    ): void {
        $attributes = [];
        foreach ($treeIndexEntities as $treeIndexEntity) {
            $attributes[] = [
                'id' => $treeIndexEntity->getId(),
                'ancestor_id' => $treeIndexEntity->getAncestorId(),
                'descendant_id' => $treeIndexEntity->getDescendantId(),
                'distance' => $treeIndexEntity->getDistance(),
                'organization_code' => $treeIndexEntity->getOrganizationCode(),
                'created_at' => $treeIndexEntity->getCreatedAt(),
                'updated_at' => $treeIndexEntity->getUpdatedAt(),
            ];
        }
        $builder->insert($attributes);
    }

    /**
     * @return array<int>
     */
    public function getDescendantIdsByAncestorId(
        RequestContext $requestContext,
        Builder $builder,
        int $ancestorId
    ): array {
        return $this->getDescendantIdsByAncestorIds(
            $requestContext,
            $builder,
            [$ancestorId]
        );
    }

    /**
     * @return array<int>
     */
    public function getDescendantIdsByAncestorIds(
        RequestContext $requestContext,
        Builder $builder,
        array $ancestorIds
    ): array {
        /** @var array<AbstractTreeIndexModel> $results */
        $results = $builder->whereIn('ancestor_id', $ancestorIds)
            ->where('organization_code', $requestContext->getOrganizationCode())
            ->orderBy('distance')
            ->get();
        $descendantIds = [];
        foreach ($results as $result) {
            $descendantIds[] = $result->descendant_id;
        }

        return $descendantIds;
    }

    /**
     * @return array<TreeIndexEntity>
     */
    public function getIndexesByAncestorId(
        RequestContext $requestContext,
        Builder $builder,
        int $ancestorId
    ): array {
        /** @var array<AbstractTreeIndexModel> $results */
        $results = $builder->where('ancestor_id', $ancestorId)
            ->where('organization_code', $requestContext->getOrganizationCode())
            ->orderBy('distance')
            ->get();
        $treeIndexEntities = [];
        foreach ($results as $result) {
            $treeIndexEntity = new TreeIndexEntity();
            $treeIndexEntity->setId($result->id);
            $treeIndexEntity->setAncestorId($result->ancestor_id);
            $treeIndexEntity->setDescendantId($result->descendant_id);
            $treeIndexEntity->setDistance($result->distance);
            $treeIndexEntity->setOrganizationCode($result->organization_code);
            $treeIndexEntity->setCreatedAt($result->created_at);
            $treeIndexEntity->setUpdatedAt($result->updated_at);
            $treeIndexEntities[] = $treeIndexEntity;
        }

        return $treeIndexEntities;
    }

    public function deleteIndexesByNodeIds(
        RequestContext $requestContext,
        Builder $builder,
        array $nodeIds
    ): void {
        // 删除祖先节点是 nodeIds 的索引
        $builder->newQuery()->whereIn('ancestor_id', $nodeIds)
            ->where('organization_code', $requestContext->getOrganizationCode())
            ->delete();

        // 删除后代节点是 nodeIds 的索引
        $builder->newQuery()->whereIn('descendant_id', $nodeIds)
            ->where('organization_code', $requestContext->getOrganizationCode())
            ->delete();
    }
}
