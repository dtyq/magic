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
use function Hyperf\Coroutine\parallel;

#[ApiResponse('low_code')]
class SuperAgentMemoryApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface          $request,
        protected ValidatorFactoryInterface $validator,
        protected LongTermMemoryAppService  $longTermMemoryAppService,
    )
    {
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
        ];

        $validatedParams = $this->checkParams($requestData, $rules);
        $metadata = $this->parseMetadata($validatedParams['metadata']);

        $dto = new CreateMemoryDTO([
            'content' => '',
            'pendingContent' => $validatedParams['memory'],
            'explanation' => $validatedParams['explanation'],
            'memoryType' => MemoryType::MANUAL_INPUT->value,
            'status' => MemoryStatus::PENDING->value,
            'tags' => $validatedParams['tags'] ?? [],
            'orgId' => $metadata->getOrganizationCode(),
            'appId' => AgentConstant::SUPER_MAGIC_CODE,
            'projectId' => $metadata->getProjectId() ?: null,
            'userId' => $metadata->getUserId(),
            'expiresAt' => null,
        ]);

        $memoryId = $this->longTermMemoryAppService->createMemory($dto);

        return ['memory_id' => $memoryId, 'success' => true];
    }

    /**
     * 更新记忆.
     */
    public function updateMemory(string $id): array
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

        // 如果有pendingContent，需要根据当前记忆状态设置新状态
        $newStatus = null;
        if (isset($validatedParams['memory']) && $validatedParams['memory'] !== null) {
            // 获取当前记忆状态
            $currentMemory = $this->longTermMemoryAppService->getMemory($id);
            if ($currentMemory && $currentMemory->getStatus()->value === 'active') {
                $newStatus = 'pending_revision'; // 已生效的记忆有新内容时，改为待修订
            }
            // 如果当前是pending状态，保持不变（不设置newStatus）
        }

        $dto = new UpdateMemoryDTO([
            'pendingContent' => $validatedParams['memory'] ?? null,
            'status' => $newStatus,
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
            'message' => '记忆删除成功',
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
            throw new InvalidArgumentException('参数验证失败: ' . implode(', ', $validator->errors()->all()));
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
        if (!$this->longTermMemoryAppService->isMemoryBelongToUser(
            $memoryId,
            $metadata->getOrganizationCode(),
            AgentConstant::SUPER_MAGIC_CODE,
            $metadata->getUserId()
        )) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, '记忆不存在或无权限访问');
        }
    }
}
