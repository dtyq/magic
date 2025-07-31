<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceArchiveStatus;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetWorkspaceTopicsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveWorkspaceRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\WorkspaceListRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use Throwable;

#[ApiResponse('low_code')]
class WorkspaceApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected WorkspaceAppService $workspaceAppService,
        protected TopicAppService $topicAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * 获取工作区列表.
     */
    public function getWorkspaceList(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setAuthorization($this->request->header('authorization', ''));
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = WorkspaceListRequestDTO::fromRequest($this->request);

        // 调用应用服务
        return $this->workspaceAppService->getWorkspaceList($requestContext, $requestDTO)->toArray();
    }

    /**
     * 获取工作区详情.
     */
    public function getWorkspaceDetail(RequestContext $requestContext, string $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 调用应用服务
        return $this->workspaceAppService->getWorkspaceDetail($requestContext, (int) $id)->toArray();
    }

    /**
     * 获取工作区下的话题列表.
     */
    public function getWorkspaceTopics(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $dto = GetWorkspaceTopicsRequestDTO::fromRequest($this->request);

        return $this->workspaceAppService->getWorkspaceTopics(
            $requestContext,
            $dto
        )->toArray();
    }

    public function createWorkspace(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = SaveWorkspaceRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        return $this->workspaceAppService->createWorkspace($requestContext, $requestDTO)->toArray();
    }

    public function updateWorkspace(RequestContext $requestContext, string $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = SaveWorkspaceRequestDTO::fromRequest($this->request);
        $requestDTO->id = $id;

        // 调用应用服务层处理业务逻辑
        return $this->workspaceAppService->updateWorkspace($requestContext, $requestDTO)->toArray();
    }

    /**
     * 保存工作区（创建或更新）.
     * 接口层负责处理HTTP请求和响应，不包含业务逻辑.
     * @throws Throwable
     */
    public function saveWorkspace(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = SaveWorkspaceRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        return $this->workspaceAppService->saveWorkspace($requestContext, $requestDTO)->toArray();
    }

    /**
     * 删除工作区（逻辑删除）.
     * 接口层负责处理HTTP请求和响应，不包含业务逻辑.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 操作结果
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     */
    public function deleteWorkspace(RequestContext $requestContext, string $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 调用应用服务层处理业务逻辑
        $this->workspaceAppService->deleteWorkspace($requestContext, (int) $id);

        // 返回规范化的响应结果
        return ['id' => $id];
    }

    /**
     * 设置工作区归档状态.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 操作结果
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     */
    public function setArchived(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 获取请求参数
        $workspaceIds = $this->request->input('workspace_ids', []);
        $isArchived = (int) $this->request->input('is_archived', WorkspaceArchiveStatus::NotArchived->value);

        // 调用应用服务层设置归档状态
        $result = $this->workspaceAppService->setWorkspaceArchived($requestContext, $workspaceIds, $isArchived);

        // 返回规范化的响应结果
        return [
            'success' => $result,
        ];
    }
}
