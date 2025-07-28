<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\LongTermMemory\Service;

use App\Application\LongTermMemory\DTO\EvaluateConversationRequestDTO;
use App\Application\LongTermMemory\DTO\ShouldRememberDTO;
use App\Application\LongTermMemory\Enum\MemoryEvaluationStatus;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Mapper\OdinModel;
use App\Application\ModelGateway\Service\ModelConfigAppService;
use App\Domain\Chat\Entity\ValueObject\LLMModelEnum;
use App\Domain\LongTermMemory\DTO\CreateMemoryDTO;
use App\Domain\LongTermMemory\DTO\MemoryQueryDTO;
use App\Domain\LongTermMemory\DTO\MemoryStatsDTO;
use App\Domain\LongTermMemory\DTO\UpdateMemoryDTO;
use App\Domain\LongTermMemory\Entity\LongTermMemoryEntity;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryType;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\ErrorCode\LongTermMemoryErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\LLMParse\LLMResponseParseUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Odin\Message\SystemMessage;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 长期记忆应用服务
 */
class LongTermMemoryAppService
{
    private const MEMORY_SCORE_THRESHOLD = 3; // Default threshold for memory creation

    public function __construct(
        private readonly LongTermMemoryDomainService $longTermMemoryDomainService,
        private readonly ModelGatewayMapper $modelGatewayMapper,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * 创建记忆.
     */
    public function createMemory(CreateMemoryDTO $dto): string
    {
        // 检查用户记忆数量限制（最大20条）
        $count = $this->longTermMemoryDomainService->countByUser($dto->orgId, $dto->appId, $dto->userId);
        if ($count >= 20) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::GENERAL_ERROR, '用户记忆数量已达到上限（20条）');
        }

        return $this->longTermMemoryDomainService->create($dto);
    }

    /**
     * 更新记忆.
     */
    public function updateMemory(string $memoryId, UpdateMemoryDTO $dto): void
    {
        $this->longTermMemoryDomainService->updateMemory($memoryId, $dto);
    }

    /**
     * 删除记忆.
     */
    public function deleteMemory(string $memoryId): void
    {
        $this->longTermMemoryDomainService->deleteMemory($memoryId);
    }

    /**
     * 获取记忆详情.
     */
    public function getMemory(string $memoryId): LongTermMemoryEntity
    {
        $memory = $this->longTermMemoryDomainService->findById($memoryId);

        if (! $memory) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::MEMORY_NOT_FOUND);
        }

        // 记录访问
        $this->longTermMemoryDomainService->accessMemory($memoryId);

        return $memory;
    }

    /**
     * 通用查询方法 (使用 MemoryQueryDTO).
     */
    public function findMemories(MemoryQueryDTO $dto): array
    {
        return $this->longTermMemoryDomainService->findMemories($dto);
    }

    /**
     * 获取有效记忆用于系统提示词.
     */
    public function getEffectiveMemoriesForPrompt(string $orgId, string $appId, string $userId, int $maxLength = 4000): string
    {
        return $this->longTermMemoryDomainService->getEffectiveMemoriesForPrompt($orgId, $appId, $userId, $maxLength);
    }

    /**
     * 强化记忆.
     */
    public function reinforceMemory(string $memoryId): void
    {
        $this->longTermMemoryDomainService->reinforceMemory($memoryId);
    }

    /**
     * 批量强化记忆.
     */
    public function reinforceMemories(array $memoryIds): void
    {
        $this->longTermMemoryDomainService->reinforceMemories($memoryIds);
    }

    /**
     * 批量接受记忆建议.
     */
    public function acceptMemorySuggestions(array $memoryIds): void
    {
        $this->longTermMemoryDomainService->acceptMemorySuggestions($memoryIds);
    }

    /**
     * 执行记忆维护（淘汰 + 压缩）.
     */
    public function maintainMemories(string $orgId, string $appId, string $userId): array
    {
        return $this->longTermMemoryDomainService->maintainMemories($orgId, $appId, $userId);
    }

    /**
     * 获取记忆统计信息.
     */
    public function getMemoryStats(string $orgId, string $appId, string $userId): MemoryStatsDTO
    {
        $stats = $this->longTermMemoryDomainService->getMemoryStats($orgId, $appId, $userId);

        return new MemoryStatsDTO($stats);
    }

    /**
     * 搜索记忆.
     */
    public function searchMemories(string $orgId, string $appId, string $userId, string $keyword): array
    {
        $queryDto = new MemoryQueryDTO([
            'orgId' => $orgId,
            'appId' => $appId,
            'userId' => $userId,
            'keyword' => $keyword,
        ]);

        $memories = $this->longTermMemoryDomainService->findMemories($queryDto);

        // 记录访问
        $memoryIds = array_map(fn ($memory) => $memory->getId(), $memories);
        $this->longTermMemoryDomainService->accessMemories($memoryIds);

        return $memories;
    }

    /**
     * 获取最近访问的记忆.
     */
    public function getRecentlyAccessed(string $orgId, string $appId, string $userId, int $limit = 10): array
    {
        return $this->longTermMemoryDomainService->getRecentlyAccessed($orgId, $appId, $userId, $limit);
    }

    /**
     * 获取最近强化的记忆.
     */
    public function getRecentlyReinforced(string $orgId, string $appId, string $userId, int $limit = 10): array
    {
        return $this->longTermMemoryDomainService->getRecentlyReinforced($orgId, $appId, $userId, $limit);
    }

    /**
     * 获取最重要的记忆.
     */
    public function getMostImportant(string $orgId, string $appId, string $userId, int $limit = 10): array
    {
        return $this->longTermMemoryDomainService->getMostImportant($orgId, $appId, $userId, $limit);
    }

    /**
     * 获取访问次数最多的记忆.
     */
    public function getMostAccessed(string $orgId, string $appId, string $userId, int $limit = 10): array
    {
        return $this->longTermMemoryDomainService->getMostAccessed($orgId, $appId, $userId, $limit);
    }

    /**
     * 批量创建记忆.
     */
    public function createMemories(array $dtos): array
    {
        return $this->longTermMemoryDomainService->createBatch($dtos);
    }

    /**
     * 构建记忆提示词内容.
     */
    public function buildMemoryPrompt(string $orgId, string $appId, string $userId, int $maxLength = 4000): string
    {
        return $this->getEffectiveMemoriesForPrompt($orgId, $appId, $userId, $maxLength);
    }

    /**
     * 检查记忆是否属于用户.
     */
    public function isMemoryBelongToUser(string $memoryId, string $orgId, string $appId, string $userId): bool
    {
        $memory = $this->longTermMemoryDomainService->findById($memoryId);

        if (! $memory) {
            return false;
        }

        return $memory->getOrgId() === $orgId
            && $memory->getAppId() === $appId
            && $memory->getUserId() === $userId;
    }

    /**
     * 计算记忆的相关性分数.
     */
    public function calculateRelevanceScore(string $memoryId, string $context): float
    {
        $memory = $this->longTermMemoryDomainService->findById($memoryId);

        if (! $memory) {
            return 0.0;
        }

        return $this->longTermMemoryDomainService->calculateRelevanceScore($memory, $context);
    }

    /**
     * 评估对话内容并可能创建记忆.
     */
    public function evaluateAndCreateMemory(
        EvaluateConversationRequestDTO $dto,
        MagicUserAuthorization $authorization
    ): array {
        try {
            // 1. 获取聊天模型
            $model = $this->getChatModel($authorization);

            // 2. 判断是否应该记忆
            $shouldRemember = $this->shouldRememberContent($model, $dto);

            if (! $shouldRemember->remember) {
                return ['status' => MemoryEvaluationStatus::NO_MEMORY_NEEDED->value, 'reason' => $shouldRemember->explanation];
            }

            // 3. 如果需要，对记忆进行评分
            $score = $this->rateMemory($model, $shouldRemember->memory);

            // 4. 如果评分高于阈值，则创建记忆
            if ($score >= self::MEMORY_SCORE_THRESHOLD) {
                $createDto = new CreateMemoryDTO([
                    'orgId' => $authorization->getOrganizationCode(),
                    'appId' => $dto->appId,
                    'userId' => $authorization->getId(),
                    'memoryType' => MemoryType::CONVERSATION_ANALYSIS->value,
                    'content' => $shouldRemember->memory,
                    'explanation' => $shouldRemember->explanation,
                    'tags' => array_merge($dto->tags, $shouldRemember->tags), // 合并外部传入的 tags 和 LLM 生成的 tags
                ]);
                $memoryId = $this->createMemory($createDto);
                return ['status' => MemoryEvaluationStatus::CREATED->value, 'memory_id' => $memoryId, 'score' => $score];
            }

            return ['status' => MemoryEvaluationStatus::NOT_CREATED_LOW_SCORE->value, 'score' => $score];
        } catch (Throwable $e) {
            $this->logger->error('Failed to evaluate and create memory', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            // Re-throw with a specific error code if it's not already a structured exception
            if ($e instanceof BusinessException) {
                throw $e;
            }
            ExceptionBuilder::throw(LongTermMemoryErrorCode::GENERAL_ERROR, throwable: $e);
        }
    }

    /**
     * 对记忆进行评分.
     */
    public function rateMemory(OdinModel $model, string $memory): int
    {
        $promptFile = BASE_PATH . '/app/Application/LongTermMemory/Prompt/MemoryPrompt.text';
        $prompt = $this->loadPromptFile($promptFile);

        $prompt = str_replace(['${topic.messages}', '${a.memory}'], [$memory, $memory], $prompt);

        try {
            // 使用系统提示词
            $response = $model->getModel()->chat([new SystemMessage($prompt)]);
            $content = $response->getFirstChoice()?->getMessage()->getContent();
        } catch (Throwable $e) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::EVALUATION_LLM_REQUEST_FAILED, throwable: $e);
        }

        if (preg_match('/SCORE:\s*(\d+)/', $content, $matches)) {
            return (int) $matches[1];
        }

        ExceptionBuilder::throw(LongTermMemoryErrorCode::EVALUATION_SCORE_PARSE_FAILED);
    }

    /**
     * 获取聊天模型.
     */
    public function getChatModel(MagicUserAuthorization $authorization): OdinModel
    {
        $modelName = di(ModelConfigAppService::class)->getChatModelTypeByFallbackChain(
            $authorization->getOrganizationCode(),
            LLMModelEnum::DEEPSEEK_V3->value
        );
        $chatModel = $this->modelGatewayMapper->getOrganizationChatModel($modelName, $authorization->getOrganizationCode());
        if ($chatModel instanceof OdinModel) {
            return $chatModel;
        }
        // Assuming getOrganizationChatModel returns null or a different type on failure
        ExceptionBuilder::throw(LongTermMemoryErrorCode::GENERAL_ERROR);
    }

    /**
     * 判断是否需要记住内容.
     */
    public function shouldRememberContent(OdinModel $model, EvaluateConversationRequestDTO $dto): ShouldRememberDTO
    {
        $promptFile = BASE_PATH . '/app/Application/LongTermMemory/Prompt/MemoryRatingPrompt.txt';
        $prompt = $this->loadPromptFile($promptFile);

        $prompt = str_replace('${topic.messages}', $dto->conversationContent, $prompt);

        try {
            // 使用系统提示词
            $response = $model->getModel()->chat([new SystemMessage($prompt)]);
            $firstChoiceContent = $response->getFirstChoice()?->getMessage()->getContent();
        } catch (Throwable $e) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::EVALUATION_LLM_REQUEST_FAILED, throwable: $e);
        }

        if (empty($firstChoiceContent)) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::EVALUATION_LLM_RESPONSE_PARSE_FAILED);
        }

        // Handle non-JSON "no_memory_needed" response
        if (strlen($firstChoiceContent) < 20 && str_contains($firstChoiceContent, 'no_memory_needed')) {
            return new ShouldRememberDTO(['remember' => false, 'memory' => 'no_memory_needed', 'explanation' => 'LLM determined no memory was needed.', 'tags' => []]);
        }

        $parsed = LLMResponseParseUtil::parseJson($firstChoiceContent);

        if (! $parsed) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::EVALUATION_LLM_RESPONSE_PARSE_FAILED);
        }

        if (isset($parsed['memory']) && str_contains($parsed['memory'], 'no_memory_needed')) {
            return new ShouldRememberDTO(['remember' => false, 'memory' => 'no_memory_needed', 'explanation' => $parsed['explanation'] ?? 'LLM determined no memory was needed.', 'tags' => []]);
        }

        if (! isset($parsed['memory'], $parsed['explanation'])) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::EVALUATION_LLM_RESPONSE_PARSE_FAILED);
        }

        return new ShouldRememberDTO(['remember' => true, 'memory' => $parsed['memory'], 'explanation' => $parsed['explanation'], 'tags' => $parsed['tags'] ?? []]);
    }

    /**
     * 加载提示词文件.
     */
    private function loadPromptFile(string $filePath): string
    {
        if (! file_exists($filePath)) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::PROMPT_FILE_NOT_FOUND, $filePath);
        }
        return file_get_contents($filePath);
    }
}
