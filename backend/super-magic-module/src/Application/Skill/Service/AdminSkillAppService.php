<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Service;

use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityConfig;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityUser;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Application\Skill\Assembler\AdminSkillAssembler;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillMarketDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\QuerySkillMarketsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\QuerySkillVersionsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\ReviewSkillVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\QuerySkillMarketsResponseAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\QuerySkillVersionsResponseAdminDTO;
use Hyperf\DbConnection\Db;
use Throwable;

/**
 * 后台管理 Skill 应用服务.
 */
class AdminSkillAppService extends AbstractSkillAppService
{
    public function __construct(
        protected SkillDomainService $skillDomainService,
        protected SkillMarketDomainService $skillMarketDomainService,
        private readonly ResourceVisibilityDomainService $resourceVisibilityDomainService,
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
            $requestDTO->getPackageName(),
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
            $requestDTO->getNameI18n(),
            $requestDTO->getPublisherType(),
            $requestDTO->getSkillCode(),
            $requestDTO->getPackageName(),
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
     * 更新 Skill 市场排序值.
     */
    public function updateMarketSortOrder(RequestContext $requestContext, int $id, int $sortOrder): void
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();

        if (! $this->skillMarketDomainService->updateSortOrderById($id, $sortOrder)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
        }
    }

    /**
     * 下架 Skill 市场条目.
     */
    public function offlineMarket(RequestContext $requestContext, int $id): void
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();

        Db::beginTransaction();
        try {
            $marketSkill = $this->skillMarketDomainService->offlineById($dataIsolation, $id);

            if ($marketSkill === null) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
            }

            $skillEntity = $this->skillDomainService->findSkillByCode($dataIsolation, $marketSkill->getSkillCode());

            $creatorId = $skillEntity->getCreatorId();

            if ($creatorId === '') {
                ExceptionBuilder::throw(
                    SuperMagicErrorCode::OperationFailed,
                    'common.operation_failed'
                );
            }

            $this->skillDomainService->deleteUserSkillOwnershipsExceptUser($dataIsolation, $marketSkill->getSkillCode(), $creatorId);

            $this->saveSkillVisibility($dataIsolation, $marketSkill->getSkillCode(), [$creatorId]);
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }
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

    /**
     * 将 Skill 可见范围覆盖为指定用户.
     *
     * @param array<string> $userIds
     */
    private function saveSkillVisibility(SkillDataIsolation $dataIsolation, string $code, array $userIds): void
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $visibilityConfig = new VisibilityConfig();
        $visibilityConfig->setVisibilityType(VisibilityType::SPECIFIC);

        foreach (array_values(array_unique($userIds)) as $userId) {
            $visibilityUser = new VisibilityUser();
            $visibilityUser->setId($userId);
            $visibilityConfig->addUser($visibilityUser);
        }

        $this->resourceVisibilityDomainService->saveVisibilityConfig(
            $permissionDataIsolation,
            ResourceVisibilityResourceType::SKILL,
            $code,
            $visibilityConfig
        );
    }
}
