<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\Facade;

use App\Application\Mode\DTO\Admin\AdminModeAggregateDTO;
use App\Application\Mode\Service\AdminModeAppService;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Auth\PermissionChecker;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Mode\DTO\Request\CreateModeRequest;
use App\Interfaces\Mode\DTO\Request\UpdateModeRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class AdminModeApi extends AbstractApi
{
    public function __construct(
        private AdminModeAppService $adminModeAppService
    ) {
    }

    /**
     * 获取模式列表.
     */
    public function getModes(RequestInterface $request)
    {
        $authorization = $this->getAuthorization();
        $this->checkAuth($authorization);
        $page = new Page(
            (int) $request->input('page', 1),
            (int) $request->input('page_size', 20)
        );

        return $this->adminModeAppService->getModes($authorization, $page);
    }

    /**
     * 获取模式详情.
     */
    public function getMode(RequestInterface $request, string $id)
    {
        $authorization = $this->getAuthorization();
        $this->checkAuth($authorization);
        return $this->adminModeAppService->getModeById($authorization, $id);
    }

    /**
     * 创建模式.
     */
    public function createMode(CreateModeRequest $request)
    {
        $authorization = $this->getAuthorization();
        $this->checkAuth($authorization);
        $request->validated();
        return $this->adminModeAppService->createMode($authorization, $request);
    }

    /**
     * 更新模式.
     */
    public function updateMode(UpdateModeRequest $request, string $id)
    {
        $authorization = $this->getAuthorization();
        $this->checkAuth($authorization);
        $request->validated();
        return $this->adminModeAppService->updateMode($authorization, $id, $request);
    }

    /**
     * 更新模式状态
     */
    public function updateModeStatus(RequestInterface $request, string $id)
    {
        $authorization = $this->getAuthorization();
        $this->checkAuth($authorization);
        $status = (bool) $request->input('status', 1);

        $this->adminModeAppService->updateModeStatus($authorization, $id, $status);
    }

    /**
     * 获取默认模式.
     */
    public function getDefaultMode()
    {
        $authorization = $this->getAuthorization();
        $this->checkAuth($authorization);
        return $this->adminModeAppService->getDefaultMode($authorization);
    }

    public function saveModeConfig(RequestInterface $request, string $id)
    {
        $authorization = $this->getAuthorization();
        $this->checkAuth($authorization);
        $modeAggregateDTO = new AdminModeAggregateDTO($request->all());
        $modeAggregateDTO->getMode()->setId($id);
        return $this->adminModeAppService->saveModeConfig($authorization, $modeAggregateDTO);
    }

    private function isCurrentOrganizationOfficial(): bool
    {
        $officialOrganization = config('service_provider.office_organization');
        $organizationCode = $this->getAuthorization()->getOrganizationCode();
        return $officialOrganization === $organizationCode;
    }

    private function checkAuth(MagicUserAuthorization $authenticatable)
    {
        $isCurrentOrganizationOfficial = $this->isCurrentOrganizationOfficial();
        $isOrganizationAdmin = PermissionChecker::isOrganizationAdmin($authenticatable->getOrganizationCode(), $authenticatable->getMobile());
        if (! $isCurrentOrganizationOfficial || ! $isOrganizationAdmin) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_AUTHORIZE);
        }
    }
}
