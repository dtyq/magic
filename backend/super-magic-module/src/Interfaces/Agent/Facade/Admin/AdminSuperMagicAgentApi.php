<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade\Admin;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Agent\Service\AdminSuperMagicAgentAppService;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentMarketsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentVersionsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\ReviewAgentVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\AbstractSuperMagicApi;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class AdminSuperMagicAgentApi extends AbstractSuperMagicApi
{
    #[Inject]
    protected AdminSuperMagicAgentAppService $adminAgentAppService;

    /**
     * 管理后台：查询员工版本列表.
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_ADMIN_AI_AGENT], MagicOperationEnum::QUERY)]
    public function queryVersions(): array
    {
        $authorization = $this->getAuthorization();
        $requestDTO = QueryAgentVersionsRequestAdminDTO::fromRequest($this->request);

        return $this->adminAgentAppService->queryVersions($authorization, $requestDTO)->toArray();
    }

    /**
     * 管理后台：查询员工市场列表.
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_ADMIN_AI_AGENT], MagicOperationEnum::QUERY)]
    public function queryMarkets(): array
    {
        $authorization = $this->getAuthorization();
        $requestDTO = QueryAgentMarketsRequestAdminDTO::fromRequest($this->request);

        return $this->adminAgentAppService->queryMarkets($authorization, $requestDTO)->toArray();
    }

    /**
     * 审核员工版本.
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_ADMIN_AI_AGENT], MagicOperationEnum::EDIT)]
    public function reviewAgentVersion(int $id): array
    {
        $authorization = $this->getAuthorization();

        // 从请求创建DTO
        $requestDTO = ReviewAgentVersionRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        $this->adminAgentAppService->reviewAgentVersion($authorization, $id, $requestDTO);

        // 返回空数组
        return [];
    }

    /**
     * 根据员工code查询员工详情.
     * 权限后续去掉模式要改，兼容旧的使用方法.
     */
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODE], MagicOperationEnum::QUERY)]
    public function getDetailByCode(string $code): array
    {
        $authorization = $this->getAuthorization();

        // 调用应用服务层处理业务逻辑
        $responseDTO = $this->adminAgentAppService->getDetailByCode($authorization, $code);

        // 返回DTO数组
        return $responseDTO->toArray();
    }
}
