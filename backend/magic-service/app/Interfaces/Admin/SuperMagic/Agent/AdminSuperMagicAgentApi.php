<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\SuperMagic\Agent;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\SuperMagic\Agent\Service\AdminSuperMagicAgentAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\SuperMagic\Agent\DTO\Request\QueryAgentMarketsRequestAdminDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\QueryAgentVersionsRequestAdminDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\ReviewAgentVersionRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\UpdateAgentMarketCategoryRequestAdminDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\UpdateAgentMarketRequestAdminDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\UpdateAgentMarketSortOrderRequestAdminDTO;
use App\Interfaces\SuperMagic\Agent\Facade\AbstractSuperMagicApi;
use App\Interfaces\SuperMagic\Common\DTO\Request\ReindexVectorIndexRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class AdminSuperMagicAgentApi extends AbstractSuperMagicApi
{
    #[Inject]
    protected AdminSuperMagicAgentAppService $adminAgentAppService;

    /**
     * 管理后台：查询员工版本列表.
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_AGENT_REVIEW], MagicOperationEnum::QUERY)]
    public function queryVersions(): array
    {
        $authorization = $this->getAuthorization();
        $requestDTO = QueryAgentVersionsRequestAdminDTO::fromRequest($this->request);

        return $this->adminAgentAppService->queryVersions($authorization, $requestDTO)->toArray();
    }

    /**
     * 管理后台：查询员工市场列表.
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_AGENT_MARKET], MagicOperationEnum::QUERY)]
    public function queryMarkets(): array
    {
        $authorization = $this->getAuthorization();
        $requestDTO = QueryAgentMarketsRequestAdminDTO::fromRequest($this->request);

        return $this->adminAgentAppService->queryMarkets($authorization, $requestDTO)->toArray();
    }

    /**
     * Reconcile all Agent Market vector points.
     *
     * 可选参数 force_re_embedding：为 true 时，若向量集合维度与模型实际输出维度不一致，会删除集合并按实际维度重建后全量重灌。
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_AGENT_MARKET], MagicOperationEnum::EDIT)]
    public function reindexMarketVectors(): array
    {
        $requestDTO = ReindexVectorIndexRequestDTO::fromRequest($this->request);

        return $this->adminAgentAppService->reindexMarketVectors(
            $this->getAuthorization(),
            $requestDTO->getForceReEmbedding(),
        );
    }

    /**
     * 审核员工版本.
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_AGENT_REVIEW], MagicOperationEnum::EDIT)]
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
     * 管理后台：更新员工市场排序值.
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_AGENT_MARKET], MagicOperationEnum::EDIT)]
    public function updateMarketSortOrder(int $id): array
    {
        $authorization = $this->getAuthorization();
        $requestDTO = UpdateAgentMarketSortOrderRequestAdminDTO::fromRequest($this->request);

        $this->adminAgentAppService->updateMarketSortOrder($authorization, $id, $requestDTO->getSortOrder());
        return [];
    }

    /**
     * 按传入字段部分更新员工市场信息.
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_AGENT_MARKET], MagicOperationEnum::EDIT)]
    public function updateMarket(int $id): array
    {
        $authorization = $this->getAuthorization();
        $requestDTO = UpdateAgentMarketRequestAdminDTO::fromRequest($this->request);

        $this->adminAgentAppService->updateMarket($authorization, $id, $requestDTO);
        return [];
    }

    /**
     * 单独更新市场 Agent 分类。
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_AGENT_MARKET], MagicOperationEnum::EDIT)]
    public function updateMarketCategory(int $id): array
    {
        $authorization = $this->getAuthorization();
        $requestDTO = UpdateAgentMarketCategoryRequestAdminDTO::fromRequest($this->request);
        if (! $requestDTO->hasCategoryInput()) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'common.parameter_required', ['label' => 'category_ids']);
        }
        $this->adminAgentAppService->updateMarketCategory($authorization, $id, $requestDTO->getCategoryIds());
        return [];
    }

    /**
     * 根据员工code查询员工详情.
     * 权限后续去掉模式要改，兼容旧的使用方法.
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_AGENT_OFFICIAL, MagicResourceEnum::ADMIN_AI_MODE], MagicOperationEnum::QUERY)]
    public function getDetailByCode(string $code): array
    {
        $authorization = $this->getAuthorization();

        // 调用应用服务层处理业务逻辑
        $responseDTO = $this->adminAgentAppService->getDetailByCode($authorization, $code);

        // 返回DTO数组
        return $responseDTO->toArray();
    }
}
