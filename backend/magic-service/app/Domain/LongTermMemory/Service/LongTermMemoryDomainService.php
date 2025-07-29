<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\Service;

use App\Domain\LongTermMemory\Assembler\LongTermMemoryAssembler;
use App\Domain\LongTermMemory\DTO\CreateMemoryDTO;
use App\Domain\LongTermMemory\DTO\MemoryQueryDTO;
use App\Domain\LongTermMemory\DTO\UpdateMemoryDTO;
use App\Domain\LongTermMemory\Entity\LongTermMemoryEntity;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryStatus;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryType;
use App\Domain\LongTermMemory\Repository\LongTermMemoryRepositoryInterface;
use App\ErrorCode\LongTermMemoryErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use DateTime;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;

use function Hyperf\Translation\trans;

/**
 * 长期记忆领域服务
 */
class LongTermMemoryDomainService
{
    public function __construct(
        private readonly LongTermMemoryRepositoryInterface $repository,
        private readonly LoggerInterface $logger,
        private readonly LockerInterface $locker
    ) {
    }

    /**
     * 执行记忆强化.
     */
    public function reinforceMemory(string $memoryId): void
    {
        $this->reinforceMemories([$memoryId]);
    }

    /**
     * 批量强化记忆.
     */
    public function reinforceMemories(array $memoryIds): void
    {
        if (empty($memoryIds)) {
            return;
        }

        // 生成锁名称和所有者（基于记忆ID排序后生成唯一锁名）
        sort($memoryIds);
        $lockName = 'memory:batch:reinforce:' . md5(implode(',', $memoryIds));
        $lockOwner = getmypid() . '_' . microtime(true);

        // 获取互斥锁
        if (! $this->locker->mutexLock($lockName, $lockOwner, 60)) {
            $this->logger->error('Failed to acquire lock for batch memory reinforcement', [
                'lock_name' => $lockName,
                'memory_ids' => $memoryIds,
            ]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED, '获取批量强化记忆锁失败');
        }

        try {
            // 批量查询记忆
            $memories = $this->repository->findByIds($memoryIds);

            if (empty($memories)) {
                $this->logger->debug('No memories found for reinforcement', ['memory_ids' => $memoryIds]);
                return;
            }

            // 批量强化
            foreach ($memories as $memory) {
                $memory->reinforce();
            }

            // 批量保存更新
            if (! $this->repository->updateBatch($memories)) {
                $this->logger->error('Failed to batch reinforce memories', ['memory_ids' => $memoryIds]);
                ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
            }

            $this->logger->info('Batch reinforced memories successfully', ['count' => count($memories)]);
        } finally {
            // 确保释放锁
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * 批量处理记忆建议（接受/拒绝）.
     */
    public function batchProcessMemorySuggestions(array $memoryIds, string $action): void
    {
        if (empty($memoryIds)) {
            return;
        }

        // 生成锁名称和所有者（基于记忆ID排序后生成唯一锁名）
        sort($memoryIds);
        $lockName = "memory:batch:{$action}:" . md5(implode(',', $memoryIds));
        $lockOwner = getmypid() . '_' . microtime(true);

        // 获取互斥锁
        if (! $this->locker->mutexLock($lockName, $lockOwner, 60)) {
            $this->logger->error('Failed to acquire lock for batch memory suggestions processing', [
                'lock_name' => $lockName,
                'action' => $action,
                'memory_ids' => $memoryIds,
            ]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED, '获取批量处理记忆建议锁失败');
        }

        try {
            if ($action === 'accept') {
                // 批量查询记忆
                $memories = $this->repository->findByIds($memoryIds);

                // 批量接受记忆建议：将pending_content移动到content，设置状态为已接受，启用记忆
                foreach ($memories as $memory) {
                    // 如果有pending_content，则将其移动到content
                    if ($memory->getPendingContent() !== null) {
                        // 将pending_content的值复制到content字段
                        $memory->setContent($memory->getPendingContent());
                        // 清空pending_content字段
                        $memory->setPendingContent(null);
                    }

                    // 设置状态为已生效
                    $memory->setStatus(MemoryStatus::ACTIVE);

                    // 启用记忆
                    $memory->setEnabledInternal(true);
                }

                // 批量保存更新
                if (! $this->repository->updateBatch($memories)) {
                    $this->logger->error('Failed to batch accept memory suggestions', ['memory_ids' => $memoryIds]);
                    ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
                }

                $this->logger->info('Batch accepted memory suggestions successfully', ['count' => count($memories)]);
            } elseif ($action === 'reject') {
                // 批量拒绝记忆建议：直接删除记忆
                if (! $this->repository->deleteBatch($memoryIds)) {
                    $this->logger->error('Failed to batch reject memory suggestions', ['memory_ids' => $memoryIds]);
                    ExceptionBuilder::throw(LongTermMemoryErrorCode::DELETION_FAILED);
                }

                $this->logger->info('Batch rejected and deleted memory suggestions successfully', ['count' => count($memoryIds)]);
            }
        } finally {
            // 确保释放锁
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * 访问记忆（更新访问统计）.
     */
    public function accessMemory(string $memoryId): void
    {
        $memory = $this->repository->findById($memoryId);
        if (! $memory) {
            $this->logger->debug("Memory not found for access tracking: {$memoryId}");
            return;
        }

        $memory->access();

        if (! $this->repository->update($memory)) {
            $this->logger->error("Failed to update access stats for memory: {$memoryId}");
        }
    }

    /**
     * 批量访问记忆.
     */
    public function accessMemories(array $memoryIds): void
    {
        if (empty($memoryIds)) {
            return;
        }

        // 批量查询记忆
        $memories = $this->repository->findByIds($memoryIds);

        if (empty($memories)) {
            $this->logger->debug('No memories found for access tracking', ['memory_ids' => $memoryIds]);
            return;
        }

        // 批量更新访问统计
        foreach ($memories as $memory) {
            $memory->access();
        }

        // 批量保存更新
        if (! $this->repository->updateBatch($memories)) {
            $this->logger->error('Failed to batch update access stats for memories', ['memory_ids' => $memoryIds]);
        }
    }

    public function create(CreateMemoryDTO $dto): string
    {
        // 生成锁名称和所有者
        $lockName = "memory:create:{$dto->orgId}:{$dto->appId}:{$dto->userId}";
        $lockOwner = getmypid() . '_' . microtime(true);

        // 获取互斥锁
        if (! $this->locker->mutexLock($lockName, $lockOwner, 30)) {
            $this->logger->error('Failed to acquire lock for memory creation', [
                'lock_name' => $lockName,
                'user_id' => $dto->userId,
            ]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::CREATION_FAILED, '获取记忆创建锁失败');
        }

        try {
            // 验证用户记忆数量限制
            $count = $this->countByUser($dto->orgId, $dto->appId, $dto->userId);
            if ($count >= 20) {
                throw new InvalidArgumentException(trans('long_term_memory.entity.user_memory_limit_exceeded'));
            }

            $memory = new LongTermMemoryEntity();
            $memory->setId((string) IdGenerator::getSnowId());
            $memory->setOrgId($dto->orgId);
            $memory->setAppId($dto->appId);
            $memory->setProjectId($dto->projectId);
            $memory->setUserId($dto->userId);
            $memory->setMemoryType($dto->memoryType);
            $memory->setStatus($dto->status);
            $memory->setContent($dto->content);
            $memory->setPendingContent($dto->pendingContent);
            $memory->setExplanation($dto->explanation);
            $memory->setOriginText($dto->originText);
            $memory->setTags($dto->tags);
            $memory->setMetadata($dto->metadata);
            $memory->setImportance($dto->importance);
            $memory->setConfidence($dto->confidence);
            if ($dto->expiresAt) {
                $memory->setExpiresAt($dto->expiresAt);
            }

            if (! $this->repository->save($memory)) {
                ExceptionBuilder::throw(LongTermMemoryErrorCode::CREATION_FAILED);
            }

            $this->logger->info('Memory created successfully: {id}', ['id' => $memory->getId()]);
            return $memory->getId();
        } finally {
            // 确保释放锁
            $this->locker->release($lockName, $lockOwner);
        }
    }

    public function updateMemory(string $memoryId, UpdateMemoryDTO $dto): void
    {
        // 生成锁名称和所有者
        $lockName = "memory:update:{$memoryId}";
        $lockOwner = getmypid() . '_' . microtime(true);

        // 获取互斥锁
        if (! $this->locker->mutexLock($lockName, $lockOwner, 30)) {
            $this->logger->error('Failed to acquire lock for memory update', [
                'lock_name' => $lockName,
                'memory_id' => $memoryId,
            ]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED, '获取记忆更新锁失败');
        }

        try {
            $memory = $this->repository->findById($memoryId);
            if (! $memory) {
                ExceptionBuilder::throw(LongTermMemoryErrorCode::MEMORY_NOT_FOUND);
            }

            // 如果更新了pending_content，需要根据业务规则调整状态
            if ($dto->pendingContent !== null) {
                $this->adjustMemoryStatusBasedOnPendingContent($memory, $dto->pendingContent);
            }

            LongTermMemoryAssembler::updateEntityFromDTO($memory, $dto);

            if (! $this->repository->update($memory)) {
                ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
            }

            $this->logger->info('Memory updated successfully: {id}', ['id' => $memoryId]);
        } finally {
            // 确保释放锁
            $this->locker->release($lockName, $lockOwner);
        }
    }

    public function deleteMemory(string $memoryId): void
    {
        // 生成锁名称和所有者
        $lockName = "memory:delete:{$memoryId}";
        $lockOwner = getmypid() . '_' . microtime(true);

        // 获取互斥锁
        if (! $this->locker->mutexLock($lockName, $lockOwner, 30)) {
            $this->logger->error('Failed to acquire lock for memory deletion', [
                'lock_name' => $lockName,
                'memory_id' => $memoryId,
            ]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::DELETION_FAILED, '获取记忆删除锁失败');
        }

        try {
            $memory = $this->repository->findById($memoryId);
            if (! $memory) {
                ExceptionBuilder::throw(LongTermMemoryErrorCode::MEMORY_NOT_FOUND);
            }

            if (! $this->repository->delete($memoryId)) {
                ExceptionBuilder::throw(LongTermMemoryErrorCode::DELETION_FAILED);
            }

            $this->logger->info('Memory deleted successfully: {id}', ['id' => $memoryId]);
        } finally {
            // 确保释放锁
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * 获取用户的有效记忆并构建提示词字符串.
     */
    public function getEffectiveMemoriesForPrompt(string $orgId, string $appId, string $userId, int $maxLength = 4000): string
    {
        // 获取有效记忆，按分数排序
        $memories = $this->repository->findEffectiveMemoriesByUser($orgId, $appId, $userId, 100);

        // 过滤掉应该被淘汰的记忆
        $validMemories = array_filter($memories, function ($memory) {
            return ! $this->shouldMemoryBeEvicted($memory);
        });

        // 按有效分数排序
        usort($validMemories, function ($a, $b) {
            return $b->getEffectiveScore() <=> $a->getEffectiveScore();
        });

        // 限制总长度
        $selectedMemories = [];
        $totalLength = 0;

        foreach ($validMemories as $memory) {
            $memoryLength = strlen($memory->getContent());

            if ($totalLength + $memoryLength <= $maxLength) {
                $selectedMemories[] = $memory;
                $totalLength += $memoryLength;
            } else {
                break;
            }
        }

        $this->logger->info('Selected {count} memories for prompt (total length: {length})', [
            'count' => count($selectedMemories),
            'length' => $totalLength,
        ]);

        // 记录访问
        $memoryIds = array_map(fn ($memory) => $memory->getId(), $selectedMemories);
        $this->accessMemories($memoryIds);

        // 构建记忆提示词字符串
        if (empty($selectedMemories)) {
            return '';
        }

        $prompt = '<用户长期记忆>';

        foreach ($selectedMemories as $memory) {
            $memoryId = $memory->getId();
            $memoryText = $memory->getContent();
            $prompt .= "\n[记忆ID: {$memoryId}] {$memoryText}";
        }

        $prompt .= "\n</用户长期记忆>";

        return $prompt;
    }

    /**
     * 获取记忆统计信息.
     */
    public function getMemoryStats(string $orgId, string $appId, string $userId): array
    {
        $totalCount = $this->repository->countByUser($orgId, $appId, $userId);
        $typeCount = $this->repository->countByUserAndType($orgId, $appId, $userId);
        $totalSize = $this->repository->getTotalSizeByUser($orgId, $appId, $userId);

        $memoriesToEvict = $this->repository->findMemoriesToEvict($orgId, $appId, $userId);
        $memoriesToCompress = $this->repository->findMemoriesToCompress($orgId, $appId, $userId);

        return [
            'total_count' => $totalCount,
            'type_count' => $typeCount,
            'total_size' => $totalSize,
            'evictable_count' => count($memoriesToEvict),
            'compressible_count' => count($memoriesToCompress),
            'average_size' => $totalCount > 0 ? intval($totalSize / $totalCount) : 0,
        ];
    }

    /**
     * 查找记忆 by ID.
     */
    public function findById(string $memoryId): ?LongTermMemoryEntity
    {
        return $this->repository->findById($memoryId);
    }

    /**
     * 通用查询方法 (使用 DTO).
     * @return LongTermMemoryEntity[]
     */
    public function findMemories(MemoryQueryDTO $dto): array
    {
        return $this->repository->findMemories($dto);
    }

    /**
     * 根据查询条件统计记忆数量.
     */
    public function countMemories(MemoryQueryDTO $dto): int
    {
        return $this->repository->countMemories($dto);
    }

    /**
     * 查找用户记忆.
     */
    public function findByUser(string $orgId, string $appId, string $userId, ?string $status = null): array
    {
        return $this->repository->findByUser($orgId, $appId, $userId, $status);
    }

    /**
     * 统计用户记忆数量.
     */
    public function countByUser(string $orgId, string $appId, string $userId): int
    {
        return $this->repository->countByUser($orgId, $appId, $userId);
    }

    /**
     * 查找 by type.
     */
    public function findByType(string $orgId, string $appId, string $userId, MemoryType $type, ?string $status = null): array
    {
        return $this->repository->findByType($orgId, $appId, $userId, $type, $status);
    }

    /**
     * 查找 by tags.
     */
    public function findByTags(string $orgId, string $appId, string $userId, array $tags, ?string $status = null): array
    {
        return $this->repository->findByTags($orgId, $appId, $userId, $tags, $status);
    }

    /**
     * 搜索 by content.
     */
    public function searchByContent(string $orgId, string $appId, string $userId, string $keyword, ?string $status = null): array
    {
        return $this->repository->searchByContent($orgId, $appId, $userId, $keyword, $status);
    }

    /**
     * 批量检查记忆是否属于用户.
     */
    public function filterMemoriesByUser(array $memoryIds, string $orgId, string $appId, string $userId): array
    {
        return $this->repository->filterMemoriesByUser($memoryIds, $orgId, $appId, $userId);
    }

    /**
     * 批量启用或禁用记忆.
     * @param array $memoryIds 记忆ID列表
     * @param bool $enabled 启用状态
     * @param string $orgId 组织ID
     * @param string $appId 应用ID
     * @param string $userId 用户ID
     * @return int 成功更新的记录数量
     */
    public function batchUpdateEnabled(array $memoryIds, bool $enabled, string $orgId, string $appId, string $userId): int
    {
        if (empty($memoryIds)) {
            $this->logger->warning('Empty memory IDs list provided for batch enable/disable');
            return 0;
        }

        // 生成锁名称和所有者（基于记忆ID排序后生成唯一锁名）
        sort($memoryIds);
        $enabledStatus = $enabled ? 'enable' : 'disable';
        $lockName = "memory:batch:{$enabledStatus}:" . md5(implode(',', $memoryIds));
        $lockOwner = getmypid() . '_' . microtime(true);

        // 获取互斥锁
        if (! $this->locker->mutexLock($lockName, $lockOwner, 60)) {
            $this->logger->error('Failed to acquire lock for batch memory enable/disable', [
                'lock_name' => $lockName,
                'enabled' => $enabled,
                'memory_ids' => $memoryIds,
            ]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED, '获取批量启用/禁用记忆锁失败');
        }

        try {
            // 验证记忆ID的有效性和所属权
            $validMemoryIds = $this->repository->filterMemoriesByUser($memoryIds, $orgId, $appId, $userId);
            if (empty($validMemoryIds)) {
                $this->logger->warning('No valid memory IDs found for user', [
                    'org_id' => $orgId,
                    'app_id' => $appId,
                    'user_id' => $userId,
                    'provided_ids' => $memoryIds,
                ]);
                return 0;
            }

            // 执行批量更新
            $updatedCount = $this->repository->batchUpdateEnabled($validMemoryIds, $enabled, $orgId, $appId, $userId);

            $this->logger->info('Batch updated memory enabled status', [
                'org_id' => $orgId,
                'app_id' => $appId,
                'user_id' => $userId,
                'enabled' => $enabled,
                'requested_count' => count($memoryIds),
                'valid_count' => count($validMemoryIds),
                'updated_count' => $updatedCount,
            ]);

            return $updatedCount;
        } finally {
            // 确保释放锁
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * 判断记忆是否应该被淘汰.
     */
    public function shouldMemoryBeEvicted(LongTermMemoryEntity $memory): bool
    {
        // 过期时间检查
        if ($memory->getExpiresAt() && $memory->getExpiresAt() < new DateTime()) {
            return true;
        }

        // 有效分数过低
        if ($memory->getEffectiveScore() < 0.1) {
            return true;
        }

        // 长时间未访问且重要性很低
        if ($memory->getLastAccessedAt() && $memory->getImportance() < 0.2) {
            $daysSinceLastAccess = (new DateTime())->diff($memory->getLastAccessedAt())->days;
            if ($daysSinceLastAccess > 30) {
                return true;
            }
        }

        return false;
    }

    /**
     * 判断记忆是否需要压缩.
     */
    public function shouldMemoryBeCompressed(LongTermMemoryEntity $memory): bool
    {
        // 内容过长但重要性不高
        if (strlen($memory->getContent()) > 1000 && $memory->getImportance() < 0.6) {
            return true;
        }

        // 长时间未访问但不应该被淘汰
        if ($memory->getLastAccessedAt() && ! $this->shouldMemoryBeEvicted($memory)) {
            $daysSinceLastAccess = (new DateTime())->diff($memory->getLastAccessedAt())->days;
            if ($daysSinceLastAccess > 7) {
                return true;
            }
        }

        return false;
    }

    /**
     * 根据pending_content的变化调整记忆状态.
     */
    private function adjustMemoryStatusBasedOnPendingContent(LongTermMemoryEntity $memory, ?string $pendingContent): void
    {
        $currentStatus = $memory->getStatus();
        $hasPendingContent = ! empty($pendingContent);

        // 获取新状态
        $newStatus = $this->determineNewMemoryStatus($currentStatus, $hasPendingContent);

        // 只在状态需要改变时才更新
        if ($newStatus !== $currentStatus) {
            $memory->setStatus($newStatus);
        }
    }

    /**
     * 根据当前状态和pending_content的存在确定新状态.
     */
    private function determineNewMemoryStatus(MemoryStatus $currentStatus, bool $hasPendingContent): MemoryStatus
    {
        // 状态转换矩阵
        return match ([$currentStatus, $hasPendingContent]) {
            // pending_content为空时的状态转换
            [MemoryStatus::PENDING_REVISION, false] => MemoryStatus::ACTIVE,        // 修订完成 → 生效
            [MemoryStatus::PENDING, false] => MemoryStatus::PENDING,                 // 待接受状态保持不变
            [MemoryStatus::ACTIVE, false] => MemoryStatus::ACTIVE,                   // 已生效状态保持不变

            // pending_content不为空时的状态转换
            [MemoryStatus::ACTIVE, true] => MemoryStatus::PENDING_REVISION,         // 生效记忆有修订 → 待修订
            [MemoryStatus::PENDING, true] => MemoryStatus::PENDING,                 // 待接受记忆更新内容，状态不变
            [MemoryStatus::PENDING_REVISION, true] => MemoryStatus::PENDING_REVISION, // 待修订记忆再次修订，状态不变

            // 默认情况（不应该到达这里）
            default => $currentStatus,
        };
    }
}
