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
use App\Domain\LongTermMemory\DTO\CreateMemoryDTO;
use App\Domain\LongTermMemory\DTO\MemoryQueryDTO;
use App\Domain\LongTermMemory\DTO\UpdateMemoryDTO;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryStatus;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\ValueObject\MemoryOperationAction;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\ValueObject\MemoryOperationScenario;
use Exception;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\Rule;
use Psr\Log\LoggerInterface;

use function Hyperf\Translation\trans;

/**
 * 长期记忆后台管理 API.
 */
#[ApiResponse('low_code')]
class LongTermMemoryAdminApi extends AbstractApi
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
            'explanation' => 'nullable|string',
            'content' => 'required|string',
            'status' => ['string', Rule::enum(MemoryStatus::class)],
            'enabled' => 'nullable|boolean',
            'tags' => 'array｜nullable',
            'project_id' => 'nullable|integer|string',
        ];

        $validatedParams = $this->checkParams($params, $rules);

        // 手动检查内容长度
        $contentLength = mb_strlen($validatedParams['content']);
        if ($contentLength > 5000) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                'long_term_memory.api.content_length_exceeded'
            );
        }

        $authorization = $this->getAuthorization();
        $dto = new CreateMemoryDTO([
            'content' => $validatedParams['content'],
            'originText' => null,
            'explanation' => $validatedParams['explanation'] ?? null,
            'memoryType' => 'manual_input',
            'status' => $validatedParams['status'] ?? MemoryStatus::ACTIVE->value,
            'enabled' => $validatedParams['enabled'] ?? true,
            'confidence' => 0.8,
            'importance' => 0.8,
            'tags' => $validatedParams['tags'] ?? [],
            'metadata' => [],
            'orgId' => $authorization->getOrganizationCode(),
            'appId' => $authorization->getApplicationCode(),
            'projectId' => isset($validatedParams['project_id']) ? (string) $validatedParams['project_id'] : null,
            'userId' => $authorization->getId(),
            'expiresAt' => null,
        ]);
        $memoryId = $this->longTermMemoryAppService->createMemory($dto);

        return [
            'memory_id' => $memoryId,
            'message' => trans('long_term_memory.api.memory_created_successfully'),
            'content' => $validatedParams['content'],
        ];
    }

    /**
     * 更新记忆.
     */
    public function updateMemory(string $memoryId, RequestInterface $request): array
    {
        // 1. 参数验证
        $validatedParams = $this->validateUpdateMemoryParams($request);
        $authorization = $this->getAuthorization();

        // 2. 权限检查
        $ownershipValidation = $this->validateMemoryOwnership($memoryId, $authorization);
        if (! $ownershipValidation['success']) {
            return $ownershipValidation;
        }

        // 3. 处理内容更新并构建DTO
        $dto = $this->buildUpdateMemoryDTO(
            $validatedParams['content'] ?? null,
            $validatedParams['pending_content'] ?? null
        );
        $this->longTermMemoryAppService->updateMemory($memoryId, $dto);

        return [
            'success' => true,
            'message' => trans('long_term_memory.api.memory_updated_successfully'),
        ];
    }

    /**
     * 删除记忆.
     */
    public function deleteMemory(string $memoryId): array
    {
        $authorization = $this->getAuthorization();

        // 检查权限
        if (! $this->longTermMemoryAppService->areMemoriesBelongToUser(
            [$memoryId],
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        )) {
            return [
                'success' => false,
                'message' => trans('long_term_memory.api.memory_not_belong_to_user'),
            ];
        }

        $this->longTermMemoryAppService->deleteMemory($memoryId);

        return [
            'success' => true,
            'message' => trans('long_term_memory.api.memory_deleted_successfully'),
        ];
    }

    /**
     * 获取记忆详情.
     */
    public function getMemory(string $memoryId): array
    {
        $authorization = $this->getAuthorization();

        // 检查权限
        if (! $this->longTermMemoryAppService->areMemoriesBelongToUser(
            [$memoryId],
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        )) {
            return [
                'success' => false,
                'message' => trans('long_term_memory.api.memory_not_belong_to_user'),
            ];
        }

        $memory = $this->longTermMemoryAppService->getMemory($memoryId);

        // 获取项目名称
        $projectName = null;
        if ($memory->getProjectId()) {
            $projectName = $this->longTermMemoryAppService->getProjectNameById($memory->getProjectId());
        }

        return [
            'success' => true,
            'data' => [
                'id' => $memory->getId(),
                'content' => $memory->getContent(),
                'pending_content' => $memory->getPendingContent(),
                'origin_text' => $memory->getOriginText(),
                'memory_type' => $memory->getMemoryType()->value,
                'status' => $memory->getStatus()->value,
                'status_description' => $memory->getStatus()->getDescription(),
                'project_id' => $memory->getProjectId(),
                'project_name' => $projectName,
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
            'status' => 'array',
            'status.*' => ['string', Rule::enum(MemoryStatus::class)],
            'enabled' => 'boolean',
            'page_token' => 'string',
            'page_size' => 'integer|min:1|max:100',
        ];

        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();
        $pageSize = empty($validatedParams['page_size']) ? 20 : $validatedParams['page_size'];
        $status = empty($validatedParams['status']) ? null : $validatedParams['status'];
        $enabled = array_key_exists('enabled', $validatedParams) ? $validatedParams['enabled'] : null;
        $dto = new MemoryQueryDTO([
            'orgId' => $authorization->getOrganizationCode(),
            'appId' => AppCodeEnum::SUPER_MAGIC->value,
            'userId' => $authorization->getId(),
            'status' => $status,
            'enabled' => $enabled,
            'pageToken' => $validatedParams['page_token'] ?? null,
            'limit' => (int) $pageSize, // 传递原始页面大小，让应用服务层处理分页逻辑
        ]);
        // 解析 pageToken
        $dto->parsePageToken();
        $result = $this->longTermMemoryAppService->findMemories($dto);

        // 按更新时间降序排序（PHP 排序）
        if (isset($result['data']) && is_array($result['data'])) {
            usort($result['data'], static function (array $a, array $b) {
                $timeB = isset($b['updated_at']) && ! empty($b['updated_at']) ? strtotime($b['updated_at']) : 0;
                $timeA = isset($a['updated_at']) && ! empty($a['updated_at']) ? strtotime($a['updated_at']) : 0;

                if ($timeB === $timeA) {
                    return strcmp((string) ($b['id'] ?? ''), (string) ($a['id'] ?? ''));
                }

                return $timeB <=> $timeA;
            });
        }

        return $result;
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

        $data = $this->longTermMemoryAppService->searchMemoriesWithProjectNames(
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId(),
            $validatedParams['keyword']
        );

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

        // 批量验证记忆是否属于当前用户
        $allMemoriesBelongToUser = $this->longTermMemoryAppService->areMemoriesBelongToUser(
            [$memoryId],
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        );

        // 检查是否有不属于用户的记忆
        if (! $allMemoriesBelongToUser) {
            return [
                'success' => false,
                'message' => trans('long_term_memory.api.memory_not_belong_to_user'),
            ];
        }

        $this->longTermMemoryAppService->reinforceMemories([$memoryId]);

        return [
            'success' => true,
            'message' => trans('long_term_memory.api.memory_reinforced_successfully'),
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

        // 批量验证所有记忆都属于当前用户
        $allMemoriesBelongToUser = $this->longTermMemoryAppService->areMemoriesBelongToUser(
            $validatedParams['memory_ids'],
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        );

        // 检查是否有不属于用户的记忆
        if (! $allMemoriesBelongToUser) {
            return [
                'success' => false,
                'message' => trans('long_term_memory.api.partial_memory_not_belong_to_user'),
            ];
        }

        $this->longTermMemoryAppService->reinforceMemories($validatedParams['memory_ids']);

        return [
            'success' => true,
            'message' => trans('long_term_memory.api.memories_batch_reinforced_successfully'),
        ];
    }

    /**
     * 批量处理记忆建议（接受/拒绝）.
     */
    public function batchProcessMemorySuggestions(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'memory_ids' => 'required|array|min:1',
            'memory_ids.*' => 'required|string',
            'action' => 'required|string|in:accept,reject',
            'scenario' => 'nullable|string|in:admin_panel,memory_card_quick',
            'magic_message_id' => 'nullable|string',
        ];

        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();

        // 批量验证所有记忆都属于当前用户
        $allMemoriesBelongToUser = $this->longTermMemoryAppService->areMemoriesBelongToUser(
            $validatedParams['memory_ids'],
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        );

        // 检查是否有不属于用户的记忆
        if (! $allMemoriesBelongToUser) {
            return [
                'success' => false,
                'message' => trans('long_term_memory.api.partial_memory_not_belong_to_user'),
            ];
        }

        $action = $validatedParams['action'];
        $memoryIds = $validatedParams['memory_ids'];
        $scenarioString = $validatedParams['scenario'] ?? 'admin_panel'; // 默认为管理后台
        $scenario = MemoryOperationScenario::from($scenarioString);

        // 验证当 scenario 是 memory_card_quick 时，magic_message_id 必须提供
        if ($scenarioString === 'memory_card_quick' && empty($validatedParams['magic_message_id'])) {
            return [
                'success' => false,
                'message' => trans('long_term_memory.api.magic_message_id_required_for_memory_card_quick'),
            ];
        }

        try {
            if ($action === 'accept') {
                // 批量接受记忆建议：status 改为 accept，enabled 为 true
                $this->longTermMemoryAppService->batchProcessMemorySuggestions($memoryIds, MemoryOperationAction::ACCEPT, $scenario, $validatedParams['magic_message_id'] ?? null);

                return [
                    'success' => true,
                    'message' => trans('long_term_memory.api.memories_accepted_successfully', ['count' => count($memoryIds)]),
                    'processed_count' => count($memoryIds),
                    'action' => 'accept',
                    'scenario' => $scenario->value,
                ];
            }
            // 删除记忆或者拒绝更新记忆
            $this->longTermMemoryAppService->batchProcessMemorySuggestions($memoryIds, MemoryOperationAction::REJECT, $scenario, $validatedParams['magic_message_id'] ?? null);

            return [
                'success' => true,
                'message' => trans('long_term_memory.api.memories_rejected_successfully', ['count' => count($memoryIds)]),
                'processed_count' => count($memoryIds),
                'action' => 'reject',
                'scenario' => $scenario->value,
            ];
        } catch (Exception $e) {
            $actionText = $validatedParams['action'] === 'accept'
                ? trans('long_term_memory.api.action_accept')
                : trans('long_term_memory.api.action_reject');
            $this->logger->error(trans('long_term_memory.api.batch_process_memories_failed'), [
                'memory_ids' => $validatedParams['memory_ids'],
                'action' => $validatedParams['action'],
                'scenario' => $scenario->value,
                'user_id' => $authorization->getId(),
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => trans('long_term_memory.api.batch_action_memories_failed', ['action' => $actionText, 'error' => $e->getMessage()]),
            ];
        }
    }

    /**
     * 批量更新记忆启用状态.
     */
    public function batchUpdateMemoryStatus(RequestInterface $request): array
    {
        $params = $this->checkParams($request->all(), [
            'memory_ids' => 'required|array|min:1',
            'memory_ids.*' => 'required|string|max:36',
            'enabled' => 'required|boolean',
        ]);

        $authorization = $this->getAuthorization();
        $result = $this->longTermMemoryAppService->batchUpdateMemoryStatus(
            $params['memory_ids'],
            $params['enabled'],
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
            'project_id' => 'string|max:36',
        ];
        $validatedParams = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();

        $prompt = $this->longTermMemoryAppService->buildMemoryPrompt(
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId(),
            $validatedParams['project_id'] ?? null,
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
     */
    protected function checkParams(array $params, array $rules, ?string $method = null): array
    {
        $validator = $this->validator->make($params, $rules);

        if ($validator->fails()) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                'long_term_memory.api.validation_failed',
                ['errors' => implode(',', $validator->errors()->keys())]
            );
        }

        return $validator->validated();
    }

    /**
     * 验证更新记忆的请求参数.
     */
    private function validateUpdateMemoryParams(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'content' => 'nullable|string',
            'pending_content' => 'nullable|string',
        ];

        $validatedParams = $this->checkParams($params, $rules);

        // 验证content和pending_content只能二选一
        $hasContent = ! empty($validatedParams['content']);
        $hasPendingContent = ! empty($validatedParams['pending_content']);

        if (! $hasContent && ! $hasPendingContent) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                'long_term_memory.api.at_least_one_content_field_required'
            );
        }

        if ($hasContent && $hasPendingContent) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                'long_term_memory.api.cannot_update_both_content_fields'
            );
        }

        // 手动检查内容长度
        if (isset($validatedParams['content'])) {
            $contentLength = mb_strlen($validatedParams['content']);
            if ($contentLength > 5000) {
                ExceptionBuilder::throw(
                    GenericErrorCode::ParameterValidationFailed,
                    'long_term_memory.api.content_length_exceeded'
                );
            }
        }

        // 手动检查 pending_content 长度
        if (isset($validatedParams['pending_content'])) {
            $contentLength = mb_strlen($validatedParams['pending_content']);
            if ($contentLength > 5000) {
                ExceptionBuilder::throw(
                    GenericErrorCode::ParameterValidationFailed,
                    'long_term_memory.api.pending_content_length_exceeded'
                );
            }
        }

        return $validatedParams;
    }

    /**
     * 验证记忆所有权.
     *
     * @param mixed $authorization
     * @return array{success: bool, message?: string}
     */
    private function validateMemoryOwnership(string $memoryId, $authorization): array
    {
        if (! $this->longTermMemoryAppService->areMemoriesBelongToUser(
            [$memoryId],
            $authorization->getOrganizationCode(),
            $authorization->getApplicationCode(),
            $authorization->getId()
        )) {
            return [
                'success' => false,
                'message' => trans('long_term_memory.api.memory_not_belong_to_user'),
            ];
        }

        return ['success' => true];
    }

    /**
     * 处理内容更新并构建更新记忆的DTO.
     */
    private function buildUpdateMemoryDTO(?string $inputContent, ?string $inputPendingContent = null): UpdateMemoryDTO
    {
        // 构建DTO（长度检查已在参数验证阶段完成，且至少有一个字段不为空）
        $status = null;
        $explanation = null;

        // 如果更新了content，设置状态为ACTIVE
        if ($inputContent !== null) {
            $status = MemoryStatus::ACTIVE->value;
            $explanation = trans('long_term_memory.api.user_manual_edit_explanation');
        }

        return new UpdateMemoryDTO([
            'content' => $inputContent,
            'pendingContent' => $inputPendingContent,
            'status' => $status,
            'explanation' => $explanation,
            'originText' => null,
            'tags' => null,
        ]);
    }
}
