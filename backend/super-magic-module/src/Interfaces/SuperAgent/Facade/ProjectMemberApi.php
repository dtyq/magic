<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectMemberAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetCollaborationProjectListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectMembersRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectPinRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectShortcutRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Project Member API.
 */
#[ApiResponse('low_code')]
class ProjectMemberApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly ProjectMemberAppService $projectMemberAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * 获取协作项目列表.
     */
    public function getCollaborationProjects(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = GetCollaborationProjectListRequestDTO::fromRequest($this->request);

        return $this->projectMemberAppService->getCollaborationProjects($requestContext, $requestDTO);
    }

    /**
     * 更新项目成员.
     */
    public function updateMembers(RequestContext $requestContext, string $id): array
    {
        // Set user authorization and context data
        $userAuthorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($userAuthorization);
        $requestContext->setUserId($userAuthorization->getId());
        $requestContext->setOrganizationCode($userAuthorization->getOrganizationCode());

        // 1. 转换为RequestDTO并自动验证（包含路由参数project_id）
        $requestDTO = UpdateProjectMembersRequestDTO::fromRequest($this->request);
        $requestDTO->setProjectId($id);

        // 2. 委托给Application层处理
        $this->projectMemberAppService->updateProjectMembers($requestContext, $requestDTO);

        return [];
    }

    /**
     * 获取项目成员.
     */
    public function getMembers(RequestContext $requestContext, string $id): array
    {
        // Set user authorization and context data
        $userAuthorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($userAuthorization);
        $requestContext->setUserId($userAuthorization->getId());
        $requestContext->setOrganizationCode($userAuthorization->getOrganizationCode());

        // Create and set DataIsolation
        $dataIsolation = DataIsolation::create(
            $userAuthorization->getOrganizationCode(),
            $userAuthorization->getId()
        );
        $requestContext->setDataIsolation($dataIsolation);

        // 委托给Application层处理
        $responseDTO = $this->projectMemberAppService->getProjectMembers($requestContext, (int) $id);

        // 返回DTO转换后的数组格式
        return ['members' => $responseDTO->toArray()];
    }

    /**
     * 更新项目置顶状态.
     */
    public function updateProjectPin(RequestContext $requestContext, string $project_id): array
    {
        // Set user authorization and context data
        $userAuthorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($userAuthorization);
        $requestContext->setUserId($userAuthorization->getId());
        $requestContext->setOrganizationCode($userAuthorization->getOrganizationCode());

        // 1. 转换为RequestDTO并自动验证
        $requestDTO = UpdateProjectPinRequestDTO::fromRequest($this->request);

        // 2. 委托给Application层处理
        $this->projectMemberAppService->updateProjectPin($requestContext, (int) $project_id, $requestDTO);

        return [];
    }

    /**
     * 获取协作项目创建者列表.
     */
    public function getCollaborationProjectCreators(RequestContext $requestContext): array
    {
        // Set user authorization and context data
        $userAuthorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($userAuthorization);
        $requestContext->setUserId($userAuthorization->getId());
        $requestContext->setOrganizationCode($userAuthorization->getOrganizationCode());

        // Create and set DataIsolation
        $dataIsolation = DataIsolation::create(
            $userAuthorization->getOrganizationCode(),
            $userAuthorization->getId()
        );
        $requestContext->setDataIsolation($dataIsolation);

        // 委托给Application层处理
        $responseDTO = $this->projectMemberAppService->getCollaborationProjectCreators($requestContext);

        // 返回DTO转换后的数组格式
        return $responseDTO->toArray();
    }

    /**
     * Update project shortcut.
     */
    public function updateProjectShortcut(RequestContext $requestContext, string $project_id): array
    {
        // Set user authorization and context data
        $userAuthorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($userAuthorization);
        $requestContext->setUserId($userAuthorization->getId());
        $requestContext->setOrganizationCode($userAuthorization->getOrganizationCode());

        // 1. 转换为RequestDTO并自动验证
        $requestDTO = UpdateProjectShortcutRequestDTO::fromRequest($this->request);

        // 2. 委托给Application层处理
        $this->projectMemberAppService->updateProjectShortcut($requestContext, (int) $project_id, $requestDTO);

        return [];
    }
}
