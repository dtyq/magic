<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository;

use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

interface VideoQueueOperationRepositoryInterface
{
    public function getOperation(string $operationId): ?VideoQueueOperationEntity;

    public function getOperations(array $operationIds): array;

    public function saveOperation(VideoQueueOperationEntity $operation, int $ttlSeconds): void;

    public function deleteOperation(string $operationId): void;

    public function addActiveOperation(VideoQueueOperationEntity $operation): void;

    public function removeActiveOperation(VideoQueueOperationEntity $operation): void;

    /**
     * 尝试为当前任务占用组织用户的视频运行槽位。
     * 该操作必须是原子的：同一组织用户运行任务数达到上限时返回 false。
     */
    public function claimUserActiveOperation(VideoQueueOperationEntity $operation, int $limit, int $ttlSeconds): bool;

    /**
     * 获取当前占用组织用户视频运行槽位的任务列表，用于清理已完成的残留槽位。
     *
     * @return array<int, VideoQueueOperationEntity>
     */
    public function getUserActiveOperations(string $organizationCode, string $userId): array;

    /**
     * 释放当前任务占用的组织用户视频运行槽位。
     */
    public function releaseUserActiveOperation(VideoQueueOperationEntity $operation): void;

    /**
     * 尝试为当前任务占用组织级视频运行槽位。
     * 该操作必须是原子的：组织运行任务数达到上限时返回 false。
     */
    public function claimOrganizationActiveOperation(VideoQueueOperationEntity $operation, int $limit, int $ttlSeconds): bool;

    /**
     * 获取当前占用组织级视频运行槽位的任务列表，用于清理已完成的残留槽位。
     *
     * @return array<int, VideoQueueOperationEntity>
     */
    public function getOrganizationActiveOperations(string $organizationCode): array;

    /**
     * 释放当前任务占用的组织级视频运行槽位。
     */
    public function releaseOrganizationActiveOperation(VideoQueueOperationEntity $operation): void;
}
