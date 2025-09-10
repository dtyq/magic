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
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\ValueObject\MemoryOperationAction;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\ValueObject\MemoryOperationScenario;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Hyperf\Odin\Message\SystemMessage;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

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
        private readonly ProjectDomainService $projectDomainService,
    ) {
    }

    /**
     * 创建记忆.
     */
    public function createMemory(CreateMemoryDTO $dto): string
    {
        // 业务逻辑验证
        $this->validateMemoryContent($dto->content);
        $this->validateMemoryPendingContent($dto->pendingContent);

        // 如果传入了项目ID，需要验证项目存在性和用户权限
        if ($dto->projectId !== null) {
            $this->validateProjectAccess($dto->projectId, $dto->orgId, $dto->userId);
        }

        return $this->longTermMemoryDomainService->create($dto);
    }

    /**
     * 更新记忆.
     */
    public function updateMemory(string $memoryId, UpdateMemoryDTO $dto): void
    {
        // 业务逻辑验证
        if ($dto->content !== null) {
            $this->validateMemoryContent($dto->content);
        }
        if ($dto->pendingContent !== null) {
            $this->validateMemoryPendingContent($dto->pendingContent);
        }
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
     * @return array{success: bool, data: array, has_more: bool, next_page_token: null|string, total: int}
     */
    public function findMemories(MemoryQueryDTO $dto): array
    {
        // 获取总数（不包含limit和offset限制）
        $countDto = clone $dto;
        $countDto->limit = 0; // 不限制条数
        $countDto->offset = 0; // 不设置偏移
        $total = $this->longTermMemoryDomainService->countMemories($countDto);

        // 保存原始页面大小
        $originalPageSize = $dto->limit;

        // 为了判断是否有下一页，多查询一条记录
        $queryDto = clone $dto;
        $queryDto->limit = $originalPageSize + 1;

        $memories = $this->longTermMemoryDomainService->findMemories($queryDto);

        // 处理分页结果
        $hasMore = count($memories) > $originalPageSize;
        if ($hasMore) {
            // 移除多查询的那一条记录
            array_pop($memories);
        }

        $nextPageToken = null;
        if ($hasMore) {
            // 生成下一页的 pageToken，offset 增加原始页面大小
            $nextOffset = $dto->offset + $originalPageSize;
            $nextPageToken = MemoryQueryDTO::generatePageToken($nextOffset);
        }

        $result = [
            'data' => $memories,
            'hasMore' => $hasMore,
            'nextPageToken' => $nextPageToken,
        ];

        // 收集项目 ID 并批量查询项目名称
        $projectIds = [];
        foreach ($result['data'] as $memory) {
            $projectId = $memory->getProjectId();
            if ($projectId && ! in_array($projectId, $projectIds)) {
                $projectIds[] = $projectId;
            }
        }

        $projectNames = $this->getProjectNamesBatch($projectIds);

        $data = array_map(function (LongTermMemoryEntity $memory) use ($projectNames) {
            $memoryArray = $memory->toArray();
            $projectId = $memory->getProjectId();
            $memoryArray['project_name'] = $projectId && isset($projectNames[$projectId]) ? $projectNames[$projectId] : null;
            return $memoryArray;
        }, $result['data']);

        return [
            'success' => true,
            'data' => $data,
            'has_more' => $result['hasMore'],
            'next_page_token' => $result['nextPageToken'],
            'total' => $total,
        ];
    }

    /**
     * 根据项目ID获取项目名称.
     */
    public function getProjectNameById(?string $projectId): ?string
    {
        if ($projectId === null || $projectId === '') {
            return null;
        }

        try {
            $project = $this->projectDomainService->getProjectNotUserId((int) $projectId);
            return $project->getProjectName();
        } catch (Throwable $e) {
            return null;
        }
    }

    /**
     * 批量获取项目名称.
     *
     * @param array $projectIds 项目ID数组
     * @return array 项目ID => 项目名称的映射数组
     */
    public function getProjectNamesBatch(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        // 转换为整数数组
        $intIds = array_map('intval', $projectIds);

        // 批量查询项目
        $projects = $this->projectDomainService->getProjectsByIds($intIds);

        // 构建项目ID => 项目名称的映射
        $projectNames = [];
        foreach ($projects as $project) {
            $projectNames[(string) $project->getId()] = $project->getProjectName();
        }

        return $projectNames;
    }

    /**
     * 获取有效记忆用于系统提示词.
     */
    public function getEffectiveMemoriesForPrompt(string $orgId, string $appId, string $userId, ?string $projectId, int $maxLength = 4000): string
    {
        return $this->longTermMemoryDomainService->getEffectiveMemoriesForPrompt($orgId, $appId, $userId, $projectId, $maxLength);
    }

    /**
     * 强化记忆.
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
        $this->longTermMemoryDomainService->reinforceMemories($memoryIds);
    }

    /**
     * 批量处理记忆建议（接受/拒绝）.
     */
    public function batchProcessMemorySuggestions(array $memoryIds, MemoryOperationAction $action, MemoryOperationScenario $scenario = MemoryOperationScenario::ADMIN_PANEL, ?string $magicMessageId = null): void
    {
        $this->longTermMemoryDomainService->batchProcessMemorySuggestions($memoryIds, $action, $scenario, $magicMessageId);
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
     * 搜索记忆（包含项目名称）.
     */
    public function searchMemoriesWithProjectNames(string $orgId, string $appId, string $userId, string $keyword): array
    {
        $memories = $this->searchMemories($orgId, $appId, $userId, $keyword);

        // 收集项目 ID 并批量查询项目名称
        $projectIds = [];
        foreach ($memories as $memory) {
            $projectId = $memory->getProjectId();
            if ($projectId && ! in_array($projectId, $projectIds)) {
                $projectIds[] = $projectId;
            }
        }

        $projectNames = $this->getProjectNamesBatch($projectIds);

        return array_map(function (LongTermMemoryEntity $memory) use ($projectNames) {
            $memoryArray = $memory->toArray();
            $projectId = $memory->getProjectId();
            $memoryArray['project_name'] = $projectId && isset($projectNames[$projectId]) ? $projectNames[$projectId] : null;
            return $memoryArray;
        }, $memories);
    }

    /**
     * 构建记忆提示词内容.
     */
    public function buildMemoryPrompt(string $orgId, string $appId, string $userId, ?string $projectId, int $maxLength = 4000): string
    {
        return $this->getEffectiveMemoriesForPrompt($orgId, $appId, $userId, $projectId, $maxLength);
    }

    /**
     * 检查记忆是否属于用户.
     * @deprecated 使用 areMemoriesBelongToUser 替代
     */
    public function isMemoryBelongToUser(string $memoryId, string $orgId, string $appId, string $userId): bool
    {
        return $this->areMemoriesBelongToUser([$memoryId], $orgId, $appId, $userId);
    }

    /**
     * 批量检查记忆是否属于用户.
     */
    public function areMemoriesBelongToUser(array $memoryIds, string $orgId, string $appId, string $userId): bool
    {
        $validMemoryIds = $this->longTermMemoryDomainService->filterMemoriesByUser($memoryIds, $orgId, $appId, $userId);

        // 检查所有记忆是否都属于用户
        return count($validMemoryIds) === count($memoryIds);
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
     * 批量更新记忆启用状态.
     */
    public function batchUpdateMemoryStatus(array $memoryIds, bool $enabled, string $orgId, string $appId, string $userId): array
    {
        $updatedCount = $this->longTermMemoryDomainService->batchUpdateEnabled(
            $memoryIds,
            $enabled,
            $orgId,
            $appId,
            $userId
        );

        return [
            'updated_count' => $updatedCount,
            'requested_count' => count($memoryIds),
        ];
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

    /**
     * 验证记忆内容长度.
     */
    private function validateMemoryContent(string $content): void
    {
        if (mb_strlen($content) > 65535) {
            throw new InvalidArgumentException(trans('long_term_memory.entity.content_too_long'));
        }
    }

    /**
     * 验证待变更记忆内容长度.
     */
    private function validateMemoryPendingContent(?string $pendingContent): void
    {
        if ($pendingContent !== null && mb_strlen($pendingContent) > 65535) {
            throw new InvalidArgumentException(trans('long_term_memory.entity.pending_content_too_long'));
        }
    }

    /**
     * 验证项目访问权限.
     * 检查项目是否存在，以及是否属于当前用户.
     * 注意：只有项目所有者才能创建项目相关的记忆.
     */
    private function validateProjectAccess(string $projectId, string $orgId, string $userId): void
    {
        // 使用 ProjectDomainService 获取项目
        $project = $this->projectDomainService->getProjectNotUserId((int) $projectId);
        if ($project === null) {
            ExceptionBuilder::throw(LongTermMemoryErrorCode::PROJECT_NOT_FOUND);
        }

        // 检查组织代码是否匹配
        if ($project->getUserOrganizationCode() !== $orgId) {
            $this->logger->warning('Project organization code mismatch', [
                'projectId' => $projectId,
                'expected' => $orgId,
                'actual' => $project->getUserOrganizationCode(),
            ]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::PROJECT_ACCESS_DENIED);
        }

        // 检查用户是否是项目所有者
        if ($project->getUserId() !== $userId) {
            $this->logger->warning('Project user ID mismatch', [
                'projectId' => $projectId,
                'expected' => $userId,
                'actual' => $project->getUserId(),
            ]);
            ExceptionBuilder::throw(LongTermMemoryErrorCode::PROJECT_ACCESS_DENIED);
        }

        $this->logger->debug('Project access validation successful', ['projectId' => $projectId]);
    }
}
