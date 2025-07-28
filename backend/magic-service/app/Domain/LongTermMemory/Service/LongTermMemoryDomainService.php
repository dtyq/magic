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
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 长期记忆领域服务
 */
class LongTermMemoryDomainService
{
    public function __construct(
        private readonly LongTermMemoryRepositoryInterface $repository,
        private readonly LoggerInterface $logger
    ) {
    }

    /**
     * 执行记忆强化.
     */
    public function reinforceMemory(string $memoryId): void
    {
        $memory = $this->repository->findById($memoryId);
        if (! $memory) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::MEMORY_NOT_FOUND);
        }

        $memory->reinforce();

        if (! $this->repository->update($memory)) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
        }

        $this->logger->info("Memory reinforced successfully: {$memoryId}");
    }

    /**
     * 批量强化记忆.
     */
    public function reinforceMemories(array $memoryIds): void
    {
        if (empty($memoryIds)) {
            return;
        }

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
    }

    /**
     * 接受单个记忆建议.
     */
    public function acceptMemorySuggestion(string $memoryId): void
    {
        $memory = $this->repository->findById($memoryId);
        if (! $memory) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::MEMORY_NOT_FOUND);
        }

        // 更新记忆状态为已接受
        $memory->setStatus(MemoryStatus::ACCEPTED);

        if (! $this->repository->update($memory)) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
        }

        $this->logger->info("Memory suggestion accepted successfully: {$memoryId}");
    }

    /**
     * 批量接受记忆建议.
     */
    public function acceptMemorySuggestions(array $memoryIds): void
    {
        if (empty($memoryIds)) {
            return;
        }

        // 批量查询记忆
        $memories = $this->repository->findByIds($memoryIds);

        if (empty($memories)) {
            $this->logger->debug('No memories found for accepting suggestions', ['memory_ids' => $memoryIds]);
            return;
        }

        // 批量更新状态为已接受
        foreach ($memories as $memory) {
            $memory->setStatus(MemoryStatus::ACCEPTED);
        }

        // 批量保存更新
        if (! $this->repository->updateBatch($memories)) {
            $this->logger->error('Failed to batch accept memory suggestions', ['memory_ids' => $memoryIds]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
        }

        $this->logger->info('Batch accepted memory suggestions successfully', ['count' => count($memories)]);
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

    /**
     * 淘汰过期或无效的记忆.
     */
    public function evictMemories(string $orgId, string $appId, string $userId): array
    {
        $evictedMemories = [];
        $memoriesToEvict = $this->repository->findMemoriesToEvict($orgId, $appId, $userId);

        $this->logger->info('Found {count} memories to evict for user {userId}', ['count' => count($memoriesToEvict), 'userId' => $userId]);

        foreach ($memoriesToEvict as $memory) {
            if ($memory->shouldBeEvicted()) {
                if ($this->repository->softDelete($memory->getId())) {
                    $evictedMemories[] = $memory;
                    $this->logger->info('Evicted memory: {id}', ['id' => $memory->getId()]);
                } else {
                    $this->logger->error('Failed to evict memory: {id}', ['id' => $memory->getId()]);
                    ExceptionBuilder::throw(LongTermMemoryErrorCode::DELETION_FAILED);
                }
            }
        }

        $this->logger->info('Evicted {count} memories for user {userId}', ['count' => count($evictedMemories), 'userId' => $userId]);

        return $evictedMemories;
    }

    /**
     * 压缩记忆内容.
     */
    public function compressMemories(string $orgId, string $appId, string $userId): array
    {
        $compressedMemories = [];
        $memoriesToCompress = $this->repository->findMemoriesToCompress($orgId, $appId, $userId);

        $this->logger->info('Found {count} memories to compress for user {userId}', ['count' => count($memoriesToCompress), 'userId' => $userId]);

        foreach ($memoriesToCompress as $memory) {
            if ($memory->shouldBeCompressed()) {
                $compressedContent = $this->compressContent($memory->getContent());

                if ($compressedContent !== $memory->getContent()) {
                    $memory->setContent($compressedContent);
                    $memory->addMetadata('compressed_at', date('Y-m-d H:i:s'));
                    $memory->addMetadata('original_length', strlen($memory->getContent()));
                    $memory->addMetadata('compressed_length', strlen($compressedContent));

                    if ($this->repository->update($memory)) {
                        $compressedMemories[] = $memory;
                        $this->logger->info('Compressed memory: {id}', ['id' => $memory->getId()]);
                    } else {
                        $this->logger->error('Failed to compress memory: {id}', ['id' => $memory->getId()]);
                        ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
                    }
                }
            }
        }

        $this->logger->info('Compressed {count} memories for user {userId}', ['count' => count($compressedMemories), 'userId' => $userId]);

        return $compressedMemories;
    }

    public function maintainMemories(string $orgId, string $appId, string $userId): array
    {
        $evicted = $this->evictMemories($orgId, $appId, $userId);
        $compressed = $this->compressMemories($orgId, $appId, $userId);

        return [
            'evicted_count' => count($evicted),
            'compressed_count' => count($compressed),
            'evicted_ids' => array_map(fn ($m) => $m->getId(), $evicted),
            'compressed_ids' => array_map(fn ($m) => $m->getId(), $compressed),
        ];
    }

    public function create(CreateMemoryDTO $dto): string
    {
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
    }

    public function createBatch(array $dtos): array
    {
        $createdIds = [];
        foreach ($dtos as $dto) {
            if ($dto instanceof CreateMemoryDTO) {
                try {
                    $createdIds[] = $this->create($dto);
                } catch (Throwable $e) {
                    $this->logger->error('Failed to create memory in batch', [
                        'error' => $e->getMessage(),
                        'dto' => json_encode($dto),
                    ]);
                }
            }
        }
        return $createdIds;
    }

    public function updateMemory(string $memoryId, UpdateMemoryDTO $dto): void
    {
        $memory = $this->repository->findById($memoryId);
        if (! $memory) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::MEMORY_NOT_FOUND);
        }

        LongTermMemoryAssembler::updateEntityFromDTO($memory, $dto);

        if (! $this->repository->update($memory)) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::UPDATE_FAILED);
        }

        $this->logger->info('Memory updated successfully: {id}', ['id' => $memoryId]);
    }

    public function deleteMemory(string $memoryId): void
    {
        $memory = $this->repository->findById($memoryId);
        if (! $memory) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::MEMORY_NOT_FOUND);
        }

        if (! $this->repository->delete($memoryId)) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::DELETION_FAILED);
        }

        $this->logger->info('Memory deleted successfully: {id}', ['id' => $memoryId]);
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
            return ! $memory->shouldBeEvicted();
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
     * 计算记忆的相关性分数.
     */
    public function calculateRelevanceScore(LongTermMemoryEntity $memory, string $context): float
    {
        $score = $memory->getEffectiveScore();

        // 根据上下文计算相关性
        $contextRelevance = $this->calculateContextRelevance($memory, $context);

        // 结合基础分数和上下文相关性
        return $score * 0.7 + $contextRelevance * 0.3;
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
     */
    public function findMemories(MemoryQueryDTO $dto): array
    {
        return $this->repository->findMemories($dto);
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
     * 获取最近访问的记忆.
     */
    public function getRecentlyAccessed(string $orgId, string $appId, string $userId, int $limit = 10): array
    {
        return $this->repository->getRecentlyAccessed($orgId, $appId, $userId, $limit);
    }

    /**
     * 获取最近强化的记忆.
     */
    public function getRecentlyReinforced(string $orgId, string $appId, string $userId, int $limit = 10): array
    {
        return $this->repository->getRecentlyReinforced($orgId, $appId, $userId, $limit);
    }

    /**
     * 获取最重要的记忆.
     */
    public function getMostImportant(string $orgId, string $appId, string $userId, int $limit = 10): array
    {
        return $this->repository->getMostImportant($orgId, $appId, $userId, $limit);
    }

    /**
     * 获取访问次数最多的记忆.
     */
    public function getMostAccessed(string $orgId, string $appId, string $userId, int $limit = 10): array
    {
        return $this->repository->getMostAccessed($orgId, $appId, $userId, $limit);
    }

    /**
     * 压缩内容（简单的压缩策略）.
     */
    private function compressContent(string $content): string
    {
        // 简单的压缩策略：
        // 1. 去除多余空白
        // 2. 简化重复的句子
        // 3. 提取关键信息

        $compressed = $content;

        // 去除多余空白
        $compressed = preg_replace('/\s+/', ' ', $compressed);
        $compressed = trim($compressed);

        // 如果内容过长，截取前面部分并添加摘要标识
        if (strlen($compressed) > 500) {
            $compressed = substr($compressed, 0, 500) . '...[已压缩]';
        }

        return $compressed;
    }

    /**
     * 计算上下文相关性.
     */
    private function calculateContextRelevance(LongTermMemoryEntity $memory, string $context): float
    {
        // 简单的关键词匹配算法
        $memoryWords = preg_split('/\s+/', strtolower($memory->getContent()));
        $contextWords = preg_split('/\s+/', strtolower($context));

        $matchCount = 0;
        foreach ($memoryWords as $word) {
            if (in_array($word, $contextWords)) {
                ++$matchCount;
            }
        }

        $totalWords = count($memoryWords);

        return $totalWords > 0 ? $matchCount / $totalWords : 0.0;
    }
}
