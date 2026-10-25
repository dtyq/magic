<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\SuperMagic\Skill;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\SuperMagic\Skill\Service\AdminSkillAppService;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\SuperMagic\Common\DTO\Request\ReindexVectorIndexRequestDTO;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use App\Interfaces\SuperMagic\Skill\DTO\Request\QuerySkillMarketsRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\QuerySkillVersionsRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\ReviewSkillVersionRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\UpdateSkillMarketCategoryRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\UpdateSkillMarketRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\UpdateSkillMarketSortOrderRequestAdminDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class AdminSkillApi extends AbstractApi
{
    #[Inject]
    protected AdminSkillAppService $adminSkillAppService;

    /**
     * 查询技能版本列表.
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_REVIEW, MagicOperationEnum::QUERY)]
    public function queryVersions(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = QuerySkillVersionsRequestAdminDTO::fromRequest($this->request);

        return $this->adminSkillAppService->queryVersions($requestContext, $requestDTO)->toArray();
    }

    /**
     * 查询 Skill 市场列表.
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::QUERY)]
    public function queryMarkets(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = QuerySkillMarketsRequestAdminDTO::fromRequest($this->request);

        return $this->adminSkillAppService->queryMarkets($requestContext, $requestDTO)->toArray();
    }

    /**
     * 重建 Skill 市场向量索引.
     *
     * 可选参数 force_re_embedding：为 true 时，若向量集合维度与模型实际输出维度不一致，会删除集合并按实际维度重建后全量重灌。
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::EDIT)]
    public function reindexMarketVectors(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = ReindexVectorIndexRequestDTO::fromRequest($this->request);

        return $this->adminSkillAppService->reindexMarketVectors(
            $requestContext,
            $requestDTO->getForceReEmbedding(),
        );
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::EDIT)]
    public function repairSkillFileUrls(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $this->adminSkillAppService->repairSkillFileUrlsAsync($this->getAuthorization());
        return [];
    }

    /**
     * 审核技能版本.
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_REVIEW, MagicOperationEnum::EDIT)]
    public function reviewSkillVersion(RequestContext $requestContext, int $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 从请求创建DTO
        $requestDTO = ReviewSkillVersionRequestDTO::fromRequest($this->request);

        $this->adminSkillAppService->reviewSkillVersion($requestContext, $id, $requestDTO);
        return [];
    }

    /**
     * 更新 Skill 市场排序值.
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::EDIT)]
    public function updateMarketSortOrder(RequestContext $requestContext, int $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = UpdateSkillMarketSortOrderRequestAdminDTO::fromRequest($this->request);
        $this->adminSkillAppService->updateMarketSortOrder($requestContext, $id, $requestDTO->getSortOrder());

        return [];
    }

    /**
     * 按传入字段部分更新 Skill 市场信息.
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::EDIT)]
    public function updateMarket(RequestContext $requestContext, int $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = UpdateSkillMarketRequestAdminDTO::fromRequest($this->request);
        $this->adminSkillAppService->updateMarket($requestContext, $id, $requestDTO);

        return [];
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::EDIT)]
    public function updateMarketCategory(RequestContext $requestContext, int $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $requestDTO = UpdateSkillMarketCategoryRequestAdminDTO::fromRequest($this->request);
        $this->adminSkillAppService->updateMarketCategory($requestContext, $id, $requestDTO->getCategoryIds());
        return [];
    }

    /**
     * 下架 Skill 市场条目.
     */
    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::EDIT)]
    public function offlineMarket(RequestContext $requestContext, int $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $this->adminSkillAppService->offlineMarket($requestContext, $id);

        return [];
    }
}
