<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Application\LongTermMemory\Service\LongTermMemoryAppService;
use App\Domain\LongTermMemory\DTO\CreateMemoryDTO;
use App\Domain\LongTermMemory\DTO\UpdateMemoryDTO;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryStatus;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryType;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\ShadowCode\ShadowCode;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use InvalidArgumentException;

use function Hyperf\Translation\trans;

#[ApiResponse('low_code')]
class SuperAgentMemoryApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected ValidatorFactoryInterface $validator,
        protected LongTermMemoryAppService $longTermMemoryAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * 创建记忆.
     */
    public function createMemory(): array
    {
        // 校验沙箱 Token
        $this->validateSandboxToken();

        $requestData = $this->getRequestData();

        $rules = [
            'explanation' => 'required|string',
            'memory' => 'required|string',
            'tags' => 'array',
            'metadata' => 'required|array',
            'immediate_effect' => 'boolean|nullable',
            'project_id' => 'nullable|string',
        ];

        $validatedParams = $this->checkParams($requestData, $rules);
        $metadata = $this->parseMetadata($validatedParams['metadata']);

        // 根据 immediate_effect 参数决定记忆状态和内容设置
        $immediateEffect = (bool) ($validatedParams['immediate_effect'] ?? false);

        if ($immediateEffect) {
            // 立即生效：记忆内容直接放入content，状态为active
            $content = $validatedParams['memory'];
            $pendingContent = null;
            $status = MemoryStatus::ACTIVE->value;
            $enabled = true; // active状态的记忆默认启用
        } else {
            // 默认行为：记忆内容放入pendingContent，状态为pending
            $content = '';
            $pendingContent = $validatedParams['memory'];
            $status = MemoryStatus::PENDING->value;
            $enabled = false; // pending状态的记忆默认不启用
        }

        $dto = new CreateMemoryDTO([
            'content' => $content,
            'pendingContent' => $pendingContent,
            'explanation' => $validatedParams['explanation'],
            'memoryType' => MemoryType::MANUAL_INPUT->value,
            'status' => $status,
            'enabled' => $enabled,
            'tags' => $validatedParams['tags'] ?? [],
            'orgId' => $metadata->getOrganizationCode(),
            'appId' => AgentConstant::SUPER_MAGIC_CODE,
            'projectId' => $validatedParams['project_id'] ?? $metadata->getProjectId() ?: null,
            'userId' => $metadata->getUserId(),
            'expiresAt' => null,
        ]);

        $memoryId = $this->longTermMemoryAppService->createMemory($dto);

        return ['memory_id' => $memoryId, 'success' => true];
    }

    /**
     * Agent更新记忆的核心逻辑.
     */
    public function agentUpdateMemory(string $id): array
    {
        // 校验沙箱 Token
        $this->validateSandboxToken();

        $requestData = $this->getRequestData();

        $rules = [
            'explanation' => 'string',
            'memory' => 'string',
            'tags' => 'array',
            'metadata' => 'required|array',
        ];

        $validatedParams = $this->checkParams($requestData, $rules);
        $metadata = $this->parseMetadata($validatedParams['metadata']);

        // 检查权限
        $this->checkMemoryPermission($id, $metadata);

        // 构建更新DTO，状态转换由领域服务自动处理
        $dto = new UpdateMemoryDTO([
            'pendingContent' => $validatedParams['memory'] ?? null,
            'explanation' => $validatedParams['explanation'] ?? null,
            'tags' => $validatedParams['tags'] ?? null,
            'metadata' => $validatedParams['metadata'] ?? null,
        ]);

        $this->longTermMemoryAppService->updateMemory($id, $dto);

        return ['success' => true];
    }

    /**
     * 删除记忆.
     */
    public function deleteMemory(string $id): array
    {
        // 校验沙箱 Token
        $this->validateSandboxToken();

        $requestData = $this->getRequestData();

        $rules = [
            'metadata' => 'required|array',
        ];

        $validatedParams = $this->checkParams($requestData, $rules);
        $metadata = $this->parseMetadata($validatedParams['metadata']);

        // 检查权限
        $this->checkMemoryPermission($id, $metadata);

        $this->longTermMemoryAppService->deleteMemory($id);

        return [
            'success' => true,
            'message' => trans('long_term_memory.api.memory_deleted_successfully'),
        ];
    }

    /**
     * 校验请求参数.
     *
     * @throws InvalidArgumentException
     */
    protected function checkParams(array $params, array $rules): array
    {
        $validator = $this->validator->make($params, $rules);

        if ($validator->fails()) {
            throw new InvalidArgumentException(trans('long_term_memory.api.parameter_validation_failed', ['errors' => implode(', ', $validator->errors()->all())]));
        }

        return $validator->validated();
    }

    /**
     * 获取请求数据（处理混淆）.
     */
    private function getRequestData(): array
    {
        // 查看是否混淆
        $isConfusion = $this->request->input('obfuscated', false);
        if ($isConfusion) {
            // 混淆处理
            $rawData = ShadowCode::unShadow($this->request->input('data', ''));
            return json_decode($rawData, true);
        }

        return $this->request->all();
    }

    /**
     * 解析metadata.
     */
    private function parseMetadata(array $metadataArray): MessageMetadata
    {
        return MessageMetadata::fromArray($metadataArray);
    }

    /**
     * 检查记忆权限.
     */
    private function checkMemoryPermission(string $memoryId, MessageMetadata $metadata): void
    {
        if (! $this->longTermMemoryAppService->isMemoryBelongToUser(
            $memoryId,
            $metadata->getOrganizationCode(),
            AgentConstant::SUPER_MAGIC_CODE,
            $metadata->getUserId()
        )) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, trans('long_term_memory.api.memory_not_belong_to_user'));
        }
    }
}
