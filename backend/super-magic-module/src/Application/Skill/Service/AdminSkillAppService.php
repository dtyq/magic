<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Service;

use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Application\Skill\Assembler\AdminSkillAssembler;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillMarketDomainService;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\QuerySkillMarketsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\QuerySkillVersionsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\ReviewSkillVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\QuerySkillMarketsResponseAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\QuerySkillVersionsResponseAdminDTO;

/**
 * 后台管理 Skill 应用服务.
 */
class AdminSkillAppService extends AbstractSkillAppService
{
    public function __construct(
        protected SkillDomainService $skillDomainService,
        protected SkillMarketDomainService $skillMarketDomainService,
        private readonly AdminSkillAssembler $adminSkillAssembler,
    ) {
    }

    public function queryVersions(
        RequestContext $requestContext,
        QuerySkillVersionsRequestAdminDTO $requestDTO
    ): QuerySkillVersionsResponseAdminDTO {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();

        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $result = $this->skillDomainService->queryVersions(
            $dataIsolation,
            $requestDTO->getReviewStatus(),
            $requestDTO->getPublishStatus(),
            $requestDTO->getPublishTargetType(),
            $requestDTO->getSourceType(),
            $requestDTO->getVersion(),
            $requestDTO->getSkillName(),
            $requestDTO->getOrganizationCode(),
            $requestDTO->getStartTime(),
            $requestDTO->getEndTime(),
            $requestDTO->getOrderBy(),
            $page
        );

        return $this->adminSkillAssembler->createQueryVersionsResponseDTO(
            $result['list'],
            $page,
            $result['total']
        );
    }

    public function queryMarkets(
        RequestContext $requestContext,
        QuerySkillMarketsRequestAdminDTO $requestDTO
    ): QuerySkillMarketsResponseAdminDTO {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();

        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $result = $this->skillMarketDomainService->queryAdminMarkets(
            $requestDTO->getPublishStatus(),
            $requestDTO->getOrganizationCode(),
            $requestDTO->getName18n(),
            $requestDTO->getPublisherType(),
            $requestDTO->getSkillCode(),
            $requestDTO->getStartTime(),
            $requestDTO->getEndTime(),
            $requestDTO->getOrderBy(),
            $page
        );

        return $this->adminSkillAssembler->createQueryMarketsResponseDTO(
            $result['list'],
            $page,
            $result['total']
        );
    }

    /**
     * 审核技能版本.
     */
    public function reviewSkillVersion(RequestContext $requestContext, int $id, ReviewSkillVersionRequestDTO $requestDTO): void
    {
        // 创建数据隔离对象
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());

        // 调用领域服务处理业务逻辑
        $this->skillDomainService->reviewSkillVersion(
            $dataIsolation,
            $id,
            $requestDTO->getAction(),
            $requestDTO->getPublisherType()
        );
    }
}
