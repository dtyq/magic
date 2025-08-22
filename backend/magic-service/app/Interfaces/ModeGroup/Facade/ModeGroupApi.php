<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModeGroup\Facade;

use App\Application\Mode\Service\ModeGroupAppService;
use App\Infrastructure\Core\AbstractApi;
use App\Interfaces\ModeGroup\Assembler\ModeGroupApiAssembler;
use App\Interfaces\ModeGroup\DTO\Request\CreateModeGroupRequest;
use App\Interfaces\ModeGroup\DTO\Request\UpdateModeGroupRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class ModeGroupApi extends AbstractApi
{
    public function __construct(
        RequestInterface $request,
        private ModeGroupAppService $modeGroupAppService
    ) {
        parent::__construct($request);
    }

    /**
     * 根据模式ID获取分组列表.
     */
    public function getGroupsByModeId(RequestInterface $request, string $modeId): array
    {
        $authorization = $this->getAuthorization();
        return $this->modeGroupAppService->getGroupsByModeId($authorization, $modeId);
    }

    /**
     * 获取分组详情.
     */
    public function getGroupDetail(RequestInterface $request, string $groupId): array
    {
        $authorization = $this->getAuthorization();
        $result = $this->modeGroupAppService->getGroupById($authorization, $groupId);

        if (! $result) {
            return [];
        }

        return $result;
    }

    /**
     * 创建分组.
     */
    public function createGroup(CreateModeGroupRequest $request): array
    {
        $authorization = $this->getAuthorization();
        $request->validated();
        $groupDTO = ModeGroupApiAssembler::createRequestToModeGroupDTO($request);
        return $this->modeGroupAppService->createGroup($authorization, $groupDTO);
    }

    /**
     * 更新分组.
     */
    public function updateGroup(UpdateModeGroupRequest $request, string $groupId): array
    {
        $authorization = $this->getAuthorization();
        $groupDTO = ModeGroupApiAssembler::updateRequestToModeGroupDTO($request);
        $groupDTO->setId($groupId);
        return $this->modeGroupAppService->updateGroup($authorization, $groupDTO);
    }

    /**
     * 删除分组.
     */
    public function deleteGroup(RequestInterface $request, string $groupId): array
    {
        $authorization = $this->getAuthorization();
        $this->modeGroupAppService->deleteGroup($authorization, $groupId);
        return ['success' => true];
    }
}
