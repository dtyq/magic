<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\Service;

use App\Domain\Chat\Repository\Facade\MagicMessageRepositoryInterface;
use App\Domain\LongTermMemory\Assembler\LongTermMemoryAssembler;
use App\Domain\LongTermMemory\DTO\CreateMemoryDTO;
use App\Domain\LongTermMemory\DTO\MemoryQueryDTO;
use App\Domain\LongTermMemory\DTO\UpdateMemoryDTO;
use App\Domain\LongTermMemory\Entity\LongTermMemoryEntity;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryCategory;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryStatus;
use App\Domain\LongTermMemory\Repository\LongTermMemoryRepositoryInterface;
use App\ErrorCode\LongTermMemoryErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use DateTime;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\ValueObject\MemoryOperationAction;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\ValueObject\MemoryOperationScenario;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\SuperAgentMessage;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * 长期记忆领域服务
 */
readonly class LongTermMemoryDomainService
{
    public function __construct(
        private LongTermMemoryRepositoryInterface $repository,
        private LoggerInterface $logger,
        private LockerInterface $locker,
        private MagicMessageRepositoryInterface $messageRepository,
    ) {
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
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
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
    public function batchProcessMemorySuggestions(array $memoryIds, MemoryOperationAction $action, MemoryOperationScenario $scenario = MemoryOperationScenario::ADMIN_PANEL, ?string $magicMessageId = null): void
    {
        if (empty($memoryIds)) {
            return;
        }

        // 验证当 scenario 是 memory_card_quick 时，magicMessageId 必须提供
        if ($scenario === MemoryOperationScenario::MEMORY_CARD_QUICK && empty($magicMessageId)) {
            throw new InvalidArgumentException('magic_message_id is required when scenario is memory_card_quick');
        }

        // 生成锁名称和所有者（基于记忆ID排序后生成唯一锁名）
        sort($memoryIds);
        $lockName = sprintf('memory:batch:%s:%s:%s', $action->value, $scenario->value, md5(implode(',', $memoryIds)));
        $lockOwner = getmypid() . '_' . microtime(true);

        // 获取互斥锁
        if (! $this->locker->mutexLock($lockName, $lockOwner, 60)) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
        }

        try {
            if ($action === MemoryOperationAction::ACCEPT) {
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
                    ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
                }
            } elseif ($action === MemoryOperationAction::REJECT) {
                // 批量拒绝记忆建议：根据记忆状态决定删除还是清空pending_content
                $memories = $this->repository->findByIds($memoryIds);

                $memoriesToDelete = [];
                $memoriesToUpdate = [];

                foreach ($memories as $memory) {
                    $content = $memory->getContent();
                    $pendingContent = $memory->getPendingContent();

                    // 如果content为空且PendingContent不为空，直接删除记忆
                    if (empty($content) && ! empty($pendingContent)) {
                        $memoriesToDelete[] = $memory->getId();
                    }
                    // 如果content和PendingContent都不为空，则清空PendingContent即可，不要删除记忆
                    elseif (! empty($content) && ! empty($pendingContent)) {
                        $memory->setPendingContent(null);
                        $memory->setStatus(MemoryStatus::ACTIVE);
                        $memoriesToUpdate[] = $memory;
                    }
                    // 如果content不为空但PendingContent为空，也直接删除记忆（原有逻辑保持）
                    elseif (! empty($content) && empty($pendingContent)) {
                        $memoriesToDelete[] = $memory->getId();
                    }
                    // 如果content为空且PendingContent也为空，直接删除记忆（原有逻辑保持）
                    elseif (empty($content) && empty($pendingContent)) {
                        $memoriesToDelete[] = $memory->getId();
                    }
                }

                // 批量删除需要删除的记忆
                if (! empty($memoriesToDelete) && ! $this->repository->deleteBatch($memoriesToDelete)) {
                    ExceptionBuilder::throw(LongTermMemoryErrorCode::DELETION_FAILED);
                }

                // 批量更新需要清空pending_content的记忆
                if (! empty($memoriesToUpdate) && ! $this->repository->updateBatch($memoriesToUpdate)) {
                    ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
                }
            }

            // 如果是 memory_card_quick 场景，需要更新对应的消息内容
            if ($scenario === MemoryOperationScenario::MEMORY_CARD_QUICK && ! empty($magicMessageId)) {
                $this->updateMessageWithMemoryOperation($magicMessageId, $action, $memoryIds);
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
            $this->logger->debug(sprintf('Memory not found for access tracking: %s', $memoryId));
            return;
        }

        $memory->access();

        if (! $this->repository->update($memory)) {
            $this->logger->error(sprintf('Failed to update access stats for memory: %s', $memoryId));
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
        $lockName = sprintf('memory:create:%s:%s:%s', $dto->orgId, $dto->appId, $dto->userId);
        $lockOwner = getmypid() . '_' . microtime(true);

        // 获取互斥锁
        if (! $this->locker->mutexLock($lockName, $lockOwner, 30)) {
            $this->logger->error('Failed to acquire lock for memory creation', [
                'lock_name' => $lockName,
                'user_id' => $dto->userId,
            ]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::CREATION_FAILED);
        }

        try {
            // 验证用户记忆数量限制
            $count = $this->countByUser($dto->orgId, $dto->appId, $dto->userId);
            if ($count >= 40) {
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
            $memory->setEnabledInternal($dto->enabled);
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

            return $memory->getId();
        } finally {
            // 确保释放锁
            $this->locker->release($lockName, $lockOwner);
        }
    }

    public function updateMemory(string $memoryId, UpdateMemoryDTO $dto): void
    {
        // 生成锁名称和所有者
        $lockName = sprintf('memory:update:%s', $memoryId);
        $lockOwner = getmypid() . '_' . microtime(true);

        // 获取互斥锁
        if (! $this->locker->mutexLock($lockName, $lockOwner, 30)) {
            $this->logger->error('Failed to acquire lock for memory update', [
                'lock_name' => $lockName,
                'memory_id' => $memoryId,
            ]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
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
        $lockName = sprintf('memory:delete:%s', $memoryId);
        $lockOwner = getmypid() . '_' . microtime(true);

        // 获取互斥锁
        if (! $this->locker->mutexLock($lockName, $lockOwner, 30)) {
            $this->logger->error('Failed to acquire lock for memory deletion', [
                'lock_name' => $lockName,
                'memory_id' => $memoryId,
            ]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::DELETION_FAILED);
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
     * 根据项目ID列表批量删除记忆.
     * @param string $orgId 组织ID
     * @param string $appId 应用ID
     * @param string $userId 用户ID
     * @param array $projectIds 项目ID列表
     * @return int 删除的记录数量
     */
    public function deleteMemoriesByProjectIds(string $orgId, string $appId, string $userId, array $projectIds): int
    {
        if (empty($projectIds)) {
            return 0;
        }

        // 过滤空的项目ID
        $validProjectIds = array_filter($projectIds, static fn ($id) => ! empty($id));
        if (empty($validProjectIds)) {
            return 0;
        }

        // 一条SQL批量删除
        return $this->repository->deleteByProjectIds($orgId, $appId, $userId, $validProjectIds);
    }

    /**
     * 获取用户的有效记忆并构建提示词字符串.
     */
    public function getEffectiveMemoriesForPrompt(string $orgId, string $appId, string $userId, ?string $projectId, int $maxLength = 4000): string
    {
        // 获取用户全局记忆（没有项目ID的记忆）
        $generalMemoryLimit = MemoryCategory::GENERAL->getEnabledLimit();
        $generalMemories = $this->repository->findEffectiveMemoriesByUser($orgId, $appId, $userId, '', $generalMemoryLimit);

        // 获取项目相关记忆
        $projectMemoryLimit = MemoryCategory::PROJECT->getEnabledLimit();
        $projectMemories = $this->repository->findEffectiveMemoriesByUser($orgId, $appId, $userId, $projectId ?? '', $projectMemoryLimit);

        // 合并记忆，按分数排序
        $memories = array_merge($generalMemories, $projectMemories);

        // 过滤掉应该被淘汰的记忆
        $validMemories = array_filter($memories, function ($memory) {
            return ! $this->shouldMemoryBeEvicted($memory);
        });

        // 按有效分数排序
        usort($validMemories, static function ($a, $b) {
            return $b->getEffectiveScore() <=> $a->getEffectiveScore();
        });

        // 限制总长度
        $selectedMemories = [];
        $totalLength = 0;

        foreach ($validMemories as $memory) {
            $memoryLength = mb_strlen($memory->getContent());

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
        $memoryIds = array_map(static fn ($memory) => $memory->getId(), $selectedMemories);
        $this->accessMemories($memoryIds);

        // 构建记忆提示词字符串
        if (empty($selectedMemories)) {
            return '';
        }

        $prompt = '<用户长期记忆>';

        foreach ($selectedMemories as $memory) {
            $memoryId = $memory->getId();
            $memoryText = $memory->getContent();
            $prompt .= sprintf("\n[记忆ID: %s] %s", $memoryId, $memoryText);
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
            'average_size' => $totalCount > 0 ? (int) ($totalSize / $totalCount) : 0,
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
     * 统计用户记忆数量.
     */
    public function countByUser(string $orgId, string $appId, string $userId): int
    {
        return $this->repository->countByUser($orgId, $appId, $userId);
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
        $lockName = sprintf('memory:batch:%s:%s', $enabledStatus, md5(implode(',', $memoryIds)));
        $lockOwner = getmypid() . '_' . microtime(true);

        // 获取互斥锁
        if (! $this->locker->mutexLock($lockName, $lockOwner, 60)) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
        }

        try {
            // 验证记忆ID的有效性和所属权
            $validMemoryIds = $this->repository->filterMemoriesByUser($memoryIds, $orgId, $appId, $userId);
            if (empty($validMemoryIds)) {
                return 0;
            }

            // 如果是启用记忆，进行数量限制检查
            if ($enabled) {
                $this->validateMemoryEnablementLimits($validMemoryIds, $orgId, $appId, $userId);
            }

            // 执行批量更新
            return $this->repository->batchUpdateEnabled($validMemoryIds, $enabled, $orgId, $appId, $userId);
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
            $daysSinceLastAccess = new DateTime()->diff($memory->getLastAccessedAt())->days;
            if ($daysSinceLastAccess > 30) {
                return true;
            }
        }

        return false;
    }

    /**
     * 验证记忆启用数量限制.
     * @param array $memoryIds 要启用的记忆ID列表
     * @param string $orgId 组织ID
     * @param string $appId 应用ID
     * @param string $userId 用户ID
     * @throws BusinessException 当启用数量超过限制时抛出异常
     */
    private function validateMemoryEnablementLimits(array $memoryIds, string $orgId, string $appId, string $userId): void
    {
        // 获取要启用的记忆实体
        $memoriesToEnable = $this->repository->findByIds($memoryIds);

        // 获取当前项目记忆和全局记忆的启用数量
        $currentProjectCount = $this->repository->getEnabledMemoryCountByCategory($orgId, $appId, $userId, MemoryCategory::PROJECT);
        $currentGeneralCount = $this->repository->getEnabledMemoryCountByCategory($orgId, $appId, $userId, MemoryCategory::GENERAL);

        $currentEnabledCounts = [
            MemoryCategory::PROJECT->value => $currentProjectCount,
            MemoryCategory::GENERAL->value => $currentGeneralCount,
        ];

        // 计算启用后各类别的数量
        $projectedCounts = $currentEnabledCounts;

        foreach ($memoriesToEnable as $memory) {
            $projectId = $memory->getProjectId();
            $category = MemoryCategory::fromProjectId($projectId);
            $categoryKey = $category->value;

            if (! isset($projectedCounts[$categoryKey])) {
                $projectedCounts[$categoryKey] = 0;
            }

            // 只有当前未启用的记忆才会增加计数
            if (! $memory->isEnabled()) {
                ++$projectedCounts[$categoryKey];
            }
        }

        // 检查是否超过限制
        foreach ($projectedCounts as $categoryKey => $projectedCount) {
            $category = MemoryCategory::from($categoryKey);
            $limit = $category->getEnabledLimit();

            if ($projectedCount > $limit) {
                $categoryName = $category->getDisplayName();
                ExceptionBuilder::throw(LongTermMemoryErrorCode::ENABLED_MEMORY_LIMIT_EXCEEDED, trans('long_term_memory.memory_category_limit_exceeded', ['category' => $categoryName, 'limit' => $limit]));
            }
        }
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
            [MemoryStatus::PENDING_REVISION, false], [MemoryStatus::ACTIVE, false] => MemoryStatus::ACTIVE,        // 修订完成 → 生效
            [MemoryStatus::PENDING, false], [MemoryStatus::PENDING, true] => MemoryStatus::PENDING,                 // 待接受状态保持不变
            // pending_content不为空时的状态转换
            [MemoryStatus::ACTIVE, true], [MemoryStatus::PENDING_REVISION, true] => MemoryStatus::PENDING_REVISION,         // 生效记忆有修订 → 待修订
            // 默认情况（不应该到达这里）
            default => $currentStatus,
        };
    }

    /**
     * 更新消息内容，设置记忆操作信息.
     */
    private function updateMessageWithMemoryOperation(string $magicMessageId, MemoryOperationAction $action, array $memoryIds): void
    {
        try {
            // 根据 magic_message_id 查询消息数据
            $messageEntity = $this->messageRepository->getMessageByMagicMessageId($magicMessageId);

            if (! $messageEntity) {
                $this->logger->warning('Message not found for memory operation update', [
                    'magic_message_id' => $magicMessageId,
                    'action' => $action->value,
                    'memory_ids' => $memoryIds,
                ]);
                return;
            }

            $superAgentMessage = $messageEntity->getContent();
            if (! $superAgentMessage instanceof SuperAgentMessage) {
                return;
            }

            // 设置 MemoryOperation
            $superAgentMessage->setMemoryOperation([
                'action' => $action->value,
                'memory_id' => $memoryIds[0] ?? null,
                'scenario' => MemoryOperationScenario::MEMORY_CARD_QUICK->value,
            ]);

            // 更新消息内容
            $updatedContent = $superAgentMessage->toArray();
            $this->messageRepository->updateMessageContent($magicMessageId, $updatedContent);
        } catch (Throwable $e) {
            // 静默处理更新失败，不影响主要流程
            $this->logger->warning('Failed to update message with memory operation', [
                'magic_message_id' => $magicMessageId,
                'action' => $action->value,
                'memory_ids' => $memoryIds,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
