<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\Facade;

use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Collaboration\Service\ResourceCollaborationAppService;
use Dtyq\SuperMagic\Application\Skill\Collaboration\SkillResourceAdapter;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchUpdateMembersRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateMembersRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateProjectMembersRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\ProjectMembersResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Skill 协作者接口。
 *
 * 对外暴露 Skill 协作者的查询、新增、删除和改权能力。
 */
#[ApiResponse('low_code')]
class SkillCollaboratorApi extends AbstractApi
{
    #[Inject]
    protected ResourceCollaborationAppService $resourceCollaborationAppService;

    #[Inject]
    protected SkillResourceAdapter $skillResourceAdapter;

    /**
     * 注入 Skill 协作者接口所需的请求对象。
     */
    public function __construct(protected RequestInterface $request)
    {
        parent::__construct($request);
    }

    /**
     * 查询 Skill 协作者列表。
     */
    public function index(string $code): array
    {
        $result = $this->resourceCollaborationAppService->getCollaborators(
            $this->skillResourceAdapter,
            $this->getAuthorization(),
            $code
        );

        return ProjectMembersResponseDTO::fromMemberData($result['users'], $result['departments'])->toArray();
    }

    /**
     * 新增 Skill 协作者。
     */
    public function store(string $code): array
    {
        $requestDTO = CreateMembersRequestDTO::fromRequest($this->request);
        $result = $this->resourceCollaborationAppService->addCollaborators(
            $this->skillResourceAdapter,
            $this->getAuthorization(),
            $code,
            $requestDTO->getMembers()
        );

        return ProjectMembersResponseDTO::fromMemberData($result['users'], $result['departments'])->toArray();
    }

    /**
     * 更新 Skill 协作者角色。
     */
    public function update(string $code): array
    {
        $requestDTO = BatchUpdateMembersRequestDTO::fromRequest($this->request);
        $this->resourceCollaborationAppService->updateCollaboratorRoles(
            $this->skillResourceAdapter,
            $this->getAuthorization(),
            $code,
            $requestDTO->getMembers()
        );

        return [];
    }

    /**
     * 删除 Skill 协作者。
     */
    public function destroy(string $code): array
    {
        $requestDTO = UpdateProjectMembersRequestDTO::fromRequest($this->request);
        $this->resourceCollaborationAppService->removeCollaborators(
            $this->skillResourceAdapter,
            $this->getAuthorization(),
            $code,
            $requestDTO->getMembers()
        );

        return [];
    }
}
