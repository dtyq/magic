<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentPlaybookAppService;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\CreatePlaybookRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\ReorderPlaybooksRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\UpdatePlaybookRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\PlaybookListItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class SuperMagicAgentPlaybookApi extends AbstractApi
{
    #[Inject]
    protected SuperMagicAgentPlaybookAppService $superMagicAgentPlaybookAppService;

    public function __construct(
        protected RequestInterface $request,
    ) {
        parent::__construct($request);
    }

    /**
     * 创建员工 Playbook.
     */
    public function createPlaybook(string $code): array
    {
        $authorization = $this->getAuthorization();

        // 从请求创建DTO
        $requestDTO = CreatePlaybookRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        $agentPlaybookEntity = $this->superMagicAgentPlaybookAppService->createPlaybook($authorization, $code, $requestDTO);

        // 返回空数组
        return [
            'id' => (string) $agentPlaybookEntity->getId(),
        ];
    }

    /**
     * 更新员工 Playbook.
     */
    public function updatePlaybook(string $code, int $playbookId): array
    {
        $authorization = $this->getAuthorization();

        // 从请求创建DTO
        $requestDTO = UpdatePlaybookRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        $this->superMagicAgentPlaybookAppService->updatePlaybook($authorization, $code, $playbookId, $requestDTO);

        // 返回空数组
        return [];
    }

    /**
     * 删除员工 Playbook.
     */
    public function deletePlaybook(string $code, int $playbookId): array
    {
        $authorization = $this->getAuthorization();

        // 调用应用服务层处理业务逻辑
        $this->superMagicAgentPlaybookAppService->deletePlaybook($authorization, $code, $playbookId);

        // 返回空数组
        return [];
    }

    /**
     * 获取员工的场景列表.
     */
    public function getAgentPlaybooks(string $code): array
    {
        $authorization = $this->getAuthorization();

        // 获取 enabled 查询参数
        $enabled = $this->request->input('enabled');
        $enabledBool = null;
        if ($enabled !== null) {
            $enabledBool = filter_var($enabled, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        }

        // 调用应用服务层处理业务逻辑
        $playbooks = $this->superMagicAgentPlaybookAppService->getAgentPlaybooks($authorization, $code, $enabledBool);

        // 转换为数组格式
        return array_map(fn (PlaybookListItemDTO $dto) => $dto->toArray(), $playbooks);
    }

    /**
     * 根据 ID 获取 Playbook 详情.
     */
    public function getPlaybook(int $playbookId): array
    {
        $authorization = $this->getAuthorization();

        // 调用应用服务层处理业务逻辑
        $playbook = $this->superMagicAgentPlaybookAppService->getPlaybookById($authorization, $playbookId);

        // 返回数组格式
        return $playbook->toArray();
    }

    /**
     * 切换员工 Playbook 启用/禁用状态.
     */
    public function togglePlaybookEnabled(string $code, int $playbookId): array
    {
        $authorization = $this->getAuthorization();

        // 直接从请求获取 enabled 参数
        $enabled = $this->request->input('enabled');
        if ($enabled === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'common.parameter_required', ['label' => 'enabled']);
        }
        $enabledBool = filter_var($enabled, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($enabledBool === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.parameter_invalid', ['label' => 'enabled']);
        }

        // 调用应用服务层处理业务逻辑
        $this->superMagicAgentPlaybookAppService->togglePlaybookEnabled($authorization, $code, $playbookId, $enabledBool);

        // 返回空数组
        return [];
    }

    /**
     * 批量重排序员工 Playbook.
     */
    public function reorderPlaybooks(string $code): array
    {
        $authorization = $this->getAuthorization();

        // 从请求创建DTO
        $requestDTO = ReorderPlaybooksRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        $this->superMagicAgentPlaybookAppService->reorderPlaybooks($authorization, $code, $requestDTO);

        // 返回空数组
        return [];
    }
}
