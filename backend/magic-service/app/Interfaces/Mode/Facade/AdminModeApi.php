<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\Facade;

use App\Application\Mode\DTO\ModeAggregateDTO;
use App\Application\Mode\Service\ModeAppService;
use App\Application\Mode\Service\ModeGroupAppService;
use App\Domain\Mode\Entity\DistributionTypeEnum;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Mode\Assembler\ModeApiAssembler;
use App\Interfaces\Mode\DTO\Request\CreateModeRequest;
use App\Interfaces\Mode\DTO\Request\UpdateModeRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class AdminModeApi extends AbstractApi
{
    public function __construct(
        private ModeAppService $modeAppService,
        private ModeGroupAppService $groupAppService
    ) {
    }

    /**
     * 获取模式列表.
     */
    public function getModes(RequestInterface $request)
    {
        $authorization = $this->getAuthorization();
        $page = new Page(
            (int) $request->input('page', 1),
            (int) $request->input('page_size', 20)
        );

        return $this->modeAppService->getModes($authorization, $page);
    }

    /**
     * 获取模式详情.
     */
    public function getMode(RequestInterface $request, string $id)
    {
        $authorization = $this->getAuthorization();
        return $this->modeAppService->getModeById($authorization, $id);
    }

    /**
     * 创建模式.
     */
    public function createMode(CreateModeRequest $request)
    {
        $authorization = $this->getAuthorization();
        $request->validated();
        $modeDTO = ModeApiAssembler::createRequestToModeDTO($request);
        return $this->modeAppService->createMode($authorization, $modeDTO);
    }

    /**
     * 更新模式.
     */
    public function updateMode(UpdateModeRequest $request, string $id)
    {
        $authorization = $this->getAuthorization();
        $request->validated();
        $modeDTO = ModeApiAssembler::updateRequestToModeDTO($request);
        $modeDTO->setId($id);
        return $this->modeAppService->updateMode($authorization, $modeDTO);
    }

    /**
     * 更新模式状态
     */
    public function updateModeStatus(RequestInterface $request, string $id)
    {
        $authorization = $this->getAuthorization();
        $status = (bool) $request->input('status', 1);

        $this->modeAppService->updateModeStatus($authorization, $id, $status);
    }

    /**
     * 获取默认模式.
     */
    public function getDefaultMode()
    {
        $authorization = $this->getAuthorization();
        return $this->modeAppService->getDefaultMode($authorization);
    }

    /**
     * 获取分组详情.
     */
    public function getGroupDetail(string $groupId): array
    {
        $authorization = $this->getAuthorization();
        $group = $this->groupAppService->getGroupById($authorization, $groupId);

        return $group ?: [];
    }

    /**
     * 获取分配类型选项.
     */
    public function getDistributionTypes(): array
    {
        return DistributionTypeEnum::getOptions();
    }

    public function saveModeConfig(RequestInterface $request, string $id)
    {
        $authorization = $this->getAuthorization();
        $modeAggregateDTO = new ModeAggregateDTO($request->all());
        $modeAggregateDTO->getMode()->setId($id);
        return $this->modeAppService->saveModeConfig($authorization, $modeAggregateDTO);
    }
}
