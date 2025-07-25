<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\LongTermMemory\Facade;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\LongTermMemory\DTO\EvaluateConversationRequestDTO;
use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Application\LongTermMemory\Service\LongTermMemoryAppService;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\Chat\Entity\ValueObject\LLMModelEnum;
use App\Domain\LongTermMemory\DTO\CreateMemoryDTO;
use App\Domain\LongTermMemory\DTO\MemoryListDTO;
use App\Domain\LongTermMemory\DTO\UpdateMemoryDTO;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryStatus;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Exception;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\Rule;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;

/**
 * 长期记忆 HTTP API.
 */
#[ApiResponse('low_code')]
class LongTermMemoryHttpApi extends AbstractApi
{
    use MagicUserAuthorizationTrait;

    protected LoggerInterface $logger;

    public function __construct(
        protected RequestInterface $request,
        protected ValidatorFactoryInterface $validator,
        protected LoggerFactory $loggerFactory,
        protected LongTermMemoryAppService $longTermMemoryAppService,
        protected MagicChatMessageAppService $magicChatMessageAppService,
        protected ModelGatewayMapper $modelGatewayMapper
    ) {
        parent::__construct($request);
        $this->logger = $this->loggerFactory->get(get_class($this));
    }

    /**
     * 创建记忆.
     */
    public function createMemory(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'explanation' => 'required|string',
            'content' => 'required|string|max:65535',
            'status' => ['string', Rule::enum(MemoryStatus::class)],
            'tags' => 'array',
        ];

        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();
        $model = $this->modelGatewayMapper->getOrganizationChatModel(LLMModelEnum::DEEPSEEK_V3->value, $authorization->getOrganizationCode());

        // Score the memory
        $score = $this->longTermMemoryAppService->rateMemory($model, $validatedParams['content']);

        // Generate summary if content is long
        $summary = null;
        if (mb_strlen($validatedParams['content']) > 100) {
            $summary = $this->magicChatMessageAppService->summarizeText($authorization, $validatedParams['content']);
        }

        $dto = new CreateMemoryDTO([
            'content' => $validatedParams['content'],
            'originText' => $summary,
            'explanation' => $validatedParams['explanation'],
            'memoryType' => 'manual_input',
            'status' => $validatedParams['status'] ?? MemoryStatus::PENDING->value,
            'confidence' => 0.8,
            'importance' => $score,
            'tags' => $validatedParams['tags'] ?? [],
            'metadata' => [],
            'orgId' => $authorization->getOrganizationCode(),
            'appId' => $authorization->getApplicationCode(),
            'projectId' => null,
            'userId' => $authorization->getId(),
            'expiresAt' => null,
        ]);
        $memoryId = $this->longTermMemoryAppService->createMemory($dto);

        return [
            'memory_id' => $memoryId,
            'message' => '记忆创建成功',
            'content' => $validatedParams['content'],
        ];
    }

    /**
     * 更新记忆.
     */
    public function updateMemory(string $memoryId, RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'content' => 'string|max:65535',
            'status' => ['string', Rule::enum(MemoryStatus::class)],
        ];

        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();

        if (! $this->longTermMemoryAppService->isMemoryBelongToUser(
            $memoryId,
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        )) {
            return [
                'success' => false,
                'message' => '记忆不存在或无权限访问',
            ];
        }

        $originContent = $content = $validatedParams['content'] ?? null;

        $shouldRemember = null;

        // 如果传入了content，则调用shouldRememberContent处理
        if ($content !== null) {
            $dto = new EvaluateConversationRequestDTO([
                'conversationContent' => '用户要求一定要记住：' . $content,
                'appId' => $authorization->getApplicationCode(),
            ]);

            $shouldRemember = $this->longTermMemoryAppService->shouldRememberContent(
                $this->longTermMemoryAppService->getChatModel($authorization),
                $dto
            );

            // 如果判断应该记忆，则使用处理后的内容，否则使用原内容
            if ($shouldRemember->remember) {
                $content = $shouldRemember->memory;
            }
        }

        // 构建DTO，只包含需要更新的字段，传入null的字段不会被更新
        $dto = new UpdateMemoryDTO([
            'content' => $content,
            'explanation' => $shouldRemember->explanation ?? null,
            'originText' => mb_strlen($originContent ?? '') > 100 ? $originContent : null,
            'status' => $validatedParams['status'] ?? null,
            'tags' => $shouldRemember->tags ?? null,
        ]);

        $this->longTermMemoryAppService->updateMemory($memoryId, $dto);

        return [
            'success' => true,
            'message' => '记忆更新成功',
        ];
    }

    /**
     * 删除记忆.
     */
    public function deleteMemory(string $memoryId): array
    {
        $authorization = $this->getAuthorization();

        // 检查权限
        if (! $this->longTermMemoryAppService->isMemoryBelongToUser(
            $memoryId,
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        )) {
            return [
                'success' => false,
                'message' => '记忆不存在或无权限访问',
            ];
        }

        $this->longTermMemoryAppService->deleteMemory($memoryId);

        return [
            'success' => true,
            'message' => '记忆删除成功',
        ];
    }

    /**
     * 获取记忆详情.
     */
    public function getMemory(string $memoryId): array
    {
        $authorization = $this->getAuthorization();

        // 检查权限
        if (! $this->longTermMemoryAppService->isMemoryBelongToUser(
            $memoryId,
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        )) {
            return [
                'success' => false,
                'message' => '记忆不存在或无权限访问',
            ];
        }

        $memory = $this->longTermMemoryAppService->getMemory($memoryId);

        return [
            'success' => true,
            'data' => [
                'id' => $memory->getId(),
                'content' => $memory->getContent(),
                'origin_text' => $memory->getOriginText(),
                'memory_type' => $memory->getMemoryType()->value,
                'status' => $memory->getStatus()->value,
                'status_description' => $memory->getStatus()->getDescription(),
                'project_id' => $memory->getProjectId(),
                'confidence' => $memory->getConfidence(),
                'importance' => $memory->getImportance(),
                'access_count' => $memory->getAccessCount(),
                'reinforcement_count' => $memory->getReinforcementCount(),
                'decay_factor' => $memory->getDecayFactor(),
                'tags' => $memory->getTags(),
                'metadata' => $memory->getMetadata(),
                'last_accessed_at' => $memory->getLastAccessedAt()?->format('Y-m-d H:i:s'),
                'last_reinforced_at' => $memory->getLastReinforcedAt()?->format('Y-m-d H:i:s'),
                'expires_at' => $memory->getExpiresAt()?->format('Y-m-d H:i:s'),
                'created_at' => $memory->getCreatedAt()?->format('Y-m-d H:i:s'),
                'updated_at' => $memory->getUpdatedAt()?->format('Y-m-d H:i:s'),
                'effective_score' => $memory->getEffectiveScore(),
            ],
        ];
    }

    /**
     * 获取记忆列表.
     */
    public function getMemoryList(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'filter_type' => 'string|in:all,type,tags,search',
            'filter_value' => 'string',
            'page' => 'integer|min:1',
            'page_size' => 'integer|min:1|max:100',
            'order_by' => 'string|in:created_at,importance,access_count,reinforcement_count',
            'order_direction' => 'string|in:asc,desc',
        ];

        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();

        $dto = new MemoryListDTO([
            'orgId' => $authorization->getOrganizationCode(),
            'appId' => AppCodeEnum::SUPER_MAGIC->value,
            'userId' => $authorization->getId(),
            'filterType' => $validatedParams['filter_type'] ?? 'all',
            'filterValue' => $validatedParams['filter_value'] ?? '',
            'page' => (int) ($validatedParams['page'] ?? 1),
            'pageSize' => (int) ($validatedParams['page_size'] ?? 20),
            'orderBy' => $validatedParams['order_by'] ?? 'created_at',
            'orderDirection' => $validatedParams['order_direction'] ?? 'desc',
        ]);

        $memories = $this->longTermMemoryAppService->getMemoryList($dto);

        $data = array_map(function ($memory) {
            return [
                'id' => $memory->getId(),
                'content' => substr($memory->getContent(), 0, 200) . (strlen($memory->getContent()) > 200 ? '...' : ''),
                'origin_text' => $memory->getOriginText(),
                'memory_type' => $memory->getMemoryType()->value,
                'status' => $memory->getStatus()->value,
                'status_description' => $memory->getStatus()->getDescription(),
                'project_id' => $memory->getProjectId(),
                'confidence' => $memory->getConfidence(),
                'importance' => $memory->getImportance(),
                'access_count' => $memory->getAccessCount(),
                'reinforcement_count' => $memory->getReinforcementCount(),
                'tags' => $memory->getTags(),
                'last_accessed_at' => $memory->getLastAccessedAt()?->format('Y-m-d H:i:s'),
                'created_at' => $memory->getCreatedAt()?->format('Y-m-d H:i:s'),
                'effective_score' => $memory->getEffectiveScore(),
            ];
        }, $memories);

        return [
            'success' => true,
            'data' => $data,
        ];
    }

    /**
     * 搜索记忆.
     */
    public function searchMemories(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'keyword' => 'required|string|min:1',
        ];

        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();

        $memories = $this->longTermMemoryAppService->searchMemories(
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId(),
            $validatedParams['keyword']
        );

        $data = array_map(function ($memory) {
            return [
                'id' => $memory->getId(),
                'content' => $memory->getContent(),
                'origin_text' => $memory->getOriginText(),
                'memory_type' => $memory->getMemoryType()->value,
                'status' => $memory->getStatus()->value,
                'status_description' => $memory->getStatus()->getDescription(),
                'project_id' => $memory->getProjectId(),
                'last_accessed_at' => $memory->getLastAccessedAt()?->format('Y-m-d H:i:s'),
                'created_at' => $memory->getCreatedAt()?->format('Y-m-d H:i:s'),
                'effective_score' => $memory->getEffectiveScore(),
            ];
        }, $memories);

        return [
            'success' => true,
            'data' => $data,
        ];
    }

    /**
     * 强化记忆.
     */
    public function reinforceMemory(string $memoryId): array
    {
        $authorization = $this->getAuthorization();

        // 检查权限
        if (! $this->longTermMemoryAppService->isMemoryBelongToUser(
            $memoryId,
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        )) {
            return [
                'success' => false,
                'message' => '记忆不存在或无权限访问',
            ];
        }

        $this->longTermMemoryAppService->reinforceMemory($memoryId);

        return [
            'success' => true,
            'message' => '记忆强化成功',
        ];
    }

    /**
     * 批量强化记忆.
     */
    public function reinforceMemories(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'memory_ids' => 'required|array',
            'memory_ids.*' => 'string',
        ];

        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();

        foreach ($validatedParams['memory_ids'] as $memoryId) {
            if (! $this->longTermMemoryAppService->isMemoryBelongToUser(
                $memoryId,
                $authorization->getOrganizationCode(),
                $authorization->getApplicationCode(),
                $authorization->getId()
            )) {
                return [
                    'success' => false,
                    'message' => "记忆 {$memoryId} 不存在或无权限访问",
                ];
            }
        }

        $this->longTermMemoryAppService->reinforceMemories($validatedParams['memory_ids']);

        return [
            'success' => true,
            'message' => '记忆批量强化成功',
        ];
    }

    /**
     * 批量接受记忆建议.
     */
    public function acceptMemorySuggestions(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'memory_ids' => 'required|array|min:1',
            'memory_ids.*' => 'required|string',
        ];

        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();

        // 验证所有记忆都属于当前用户
        foreach ($validatedParams['memory_ids'] as $memoryId) {
            if (! $this->longTermMemoryAppService->isMemoryBelongToUser(
                $memoryId,
                $authorization->getOrganizationCode(),
                $authorization->getApplicationCode(),
                $authorization->getId()
            )) {
                return [
                    'success' => false,
                    'message' => "记忆 {$memoryId} 不存在或无权限访问",
                ];
            }
        }

        try {
            // 批量更新记忆状态为已接受
            $this->longTermMemoryAppService->acceptMemorySuggestions($validatedParams['memory_ids']);

            return [
                'success' => true,
                'message' => '成功接受 ' . count($validatedParams['memory_ids']) . ' 条记忆建议',
                'accepted_count' => count($validatedParams['memory_ids']),
            ];
        } catch (Exception $e) {
            $this->logger->error('批量接受记忆建议失败', [
                'memory_ids' => $validatedParams['memory_ids'],
                'user_id' => $authorization->getId(),
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => '批量接受记忆建议失败：' . $e->getMessage(),
            ];
        }
    }

    /**
     * 执行记忆维护.
     */
    public function maintainMemories(): array
    {
        $authorization = $this->getAuthorization();
        $result = $this->longTermMemoryAppService->maintainMemories(
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        );

        return [
            'success' => true,
            'data' => $result,
        ];
    }

    /**
     * 获取记忆统计.
     */
    public function getMemoryStats(): array
    {
        $authorization = $this->getAuthorization();
        $stats = $this->longTermMemoryAppService->getMemoryStats(
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        );

        return [
            'success' => true,
            'data' => $stats->toArray(),
        ];
    }

    /**
     * 获取记忆提示词.
     */
    public function getMemoryPrompt(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'max_length' => 'integer|min:100|max:8000',
        ];
        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();

        $prompt = $this->longTermMemoryAppService->buildMemoryPrompt(
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId(),
            $validatedParams['max_length'] ?? 4000
        );

        return [
            'success' => true,
            'data' => [
                'prompt' => $prompt,
            ],
        ];
    }

    /**
     * 评估对话内容以创建记忆.
     */
    public function evaluateConversation(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'model_name' => 'string',
            'conversation_content' => 'string|max:65535',
            'app_id' => 'string',
            'tags' => 'array',
        ];

        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();

        $dto = new EvaluateConversationRequestDTO([
            'modelName' => $validatedParams['model_name'] ?? 'deepseek-v3',
            'conversationContent' => $validatedParams['conversation_content'] ?? '',
            'appId' => $validatedParams['app_id'] ?? $authorization->getApplicationCode(),
            'tags' => $validatedParams['tags'] ?? [],
        ]);

        return $this->longTermMemoryAppService->evaluateAndCreateMemory($dto, $authorization);
    }

    /**
     * 校验请求参数.
     *
     * @throws InvalidArgumentException
     */
    protected function checkParams(array $params, array $rules, ?string $method = null): array
    {
        $validator = $this->validator->make($params, $rules);

        if ($validator->fails()) {
            throw new InvalidArgumentException('参数验证失败: ' . implode(', ', $validator->errors()->all()));
        }

        return $validator->validated();
    }
}
