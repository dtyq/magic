<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Service;

use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Application\Skill\Assembler\AdminSkillAssembler;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillMarketDomainService;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillVersionDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\QuerySkillMarketsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\QuerySkillVersionsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\ReviewOrganizationSkillVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\ReviewSkillVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\UpdateSkillMarketRequestAdminDTO;
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
        protected SkillVersionDomainService $skillVersionDomainService,
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
        $result = $this->skillVersionDomainService->queryVersions(
            $dataIsolation,
            $requestDTO->getReviewStatus(),
            $requestDTO->getPublishStatus(),
            PublishTargetType::filterValues($requestDTO->getPublishTargetType()),
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
     * 查询当前组织内待审核/已审核的 Skill 版本。
     * 仅包含发布到组织或指定成员范围的版本，不包含市场发布版本。
     */
    public function queryOrganizationVersions(
        RequestContext $requestContext,
        QuerySkillVersionsRequestAdminDTO $requestDTO
    ): QuerySkillVersionsResponseAdminDTO {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $publishTargetTypes = PublishTargetType::resolveOrganizationReviewFilterValues($requestDTO->getPublishTargetType());

        if ($publishTargetTypes === []) {
            return $this->adminSkillAssembler->createQueryVersionsResponseDTO([], $page, 0);
        }

        $result = $this->skillVersionDomainService->queryVersions(
            $dataIsolation,
            $requestDTO->getReviewStatus(),
            $requestDTO->getPublishStatus(),
            $publishTargetTypes,
            $requestDTO->getSourceType(),
            $requestDTO->getVersion(),
            $requestDTO->getPackageName(),
            $requestDTO->getSkillName(),
            $dataIsolation->getCurrentOrganizationCode(),
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

    /**
     * 组织后台审核 Skill 版本，按 action 分发通过或拒绝逻辑。
     */
    public function reviewOrganizationVersion(RequestContext $requestContext, int $id, ReviewOrganizationSkillVersionRequestDTO $requestDTO): void
    {
        if ($requestDTO->isApproved()) {
            $this->approveOrganizationVersion($requestContext, $id, $requestDTO->getReviewRemark());
            return;
        }

        $this->rejectOrganizationVersion($requestContext, $id, $requestDTO->getReviewRemark());
    }

    /**
     * 组织后台审核通过 Skill 版本，并按发布目标同步组织内可见范围。
     */
    public function approveOrganizationVersion(RequestContext $requestContext, int $id, ?string $reviewRemark = null): void
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());

        Db::beginTransaction();
        try {
            $versionEntity = $this->skillVersionDomainService->reviewOrganizationSkillVersion(
                $dataIsolation,
                $id,
                ReviewStatus::APPROVED,
                $reviewRemark
            );
            $skillEntity = $this->skillDomainService->findSkillByCode($dataIsolation, $versionEntity->getCode());
            $this->syncOrganizationSkillScope($dataIsolation, $skillEntity, $versionEntity);
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }
    }

    /**
     * 组织后台审核拒绝 Skill 版本，不改变当前生效版本和可见范围。
     */
    public function rejectOrganizationVersion(RequestContext $requestContext, int $id, ?string $reviewRemark = null): void
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());

        $this->skillVersionDomainService->reviewOrganizationSkillVersion(
            $dataIsolation,
            $id,
            ReviewStatus::REJECTED,
            $reviewRemark
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
     * 按传入字段部分更新 Skill 市场信息.
     */
    public function updateMarket(RequestContext $requestContext, int $id, UpdateSkillMarketRequestAdminDTO $requestDTO): void
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        $dataIsolation->disabled();

        if (! $requestDTO->hasUpdates()) {
            return;
        }

        if (! $this->skillMarketDomainService->updateInfoById($id, $requestDTO->getUpdatePayload())) {
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

            $this->saveSkillVisibility(
                $dataIsolation,
                $marketSkill->getSkillCode(),
                VisibilityType::SPECIFIC,
                [$creatorId]
            );
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
        $this->skillVersionDomainService->reviewSkillVersion(
            $dataIsolation,
            $id,
            $requestDTO->getAction(),
            $requestDTO->getPublisherType(),
            $requestDTO->getReviewRemark()
        );
    }

    /**
     * 将审核通过的组织内发布范围同步到资源可见性表。
     */
    private function syncOrganizationSkillScope(
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        SkillVersionEntity $versionEntity
    ): void {
        $publishTargetType = $versionEntity->getPublishTargetType();

        $this->skillDomainService->deleteUserSkillOwnershipsExceptUser(
            $dataIsolation,
            $skillEntity->getCode(),
            $skillEntity->getCreatorId()
        );
        $this->skillMarketDomainService->updateAllPublishStatusBySkillCode(
            $skillEntity->getCode(),
            PublishStatus::OFFLINE->value
        );

        if ($publishTargetType === PublishTargetType::ORGANIZATION) {
            $this->saveSkillVisibility($dataIsolation, $skillEntity->getCode(), VisibilityType::ALL);
            return;
        }

        $publishTargetValue = $versionEntity->getPublishTargetValue();
        $userIds = array_values(array_unique(array_merge(
            [$skillEntity->getCreatorId()],
            $publishTargetValue?->getUserIds() ?? []
        )));

        $this->saveSkillVisibility(
            $dataIsolation,
            $skillEntity->getCode(),
            VisibilityType::SPECIFIC,
            $userIds,
            $publishTargetValue?->getDepartmentIds() ?? []
        );
    }

    private function saveSkillVisibility(
        SkillDataIsolation $dataIsolation,
        string $code,
        VisibilityType $visibilityType,
        array $userIds = [],
        array $departmentIds = []
    ): void {
        $this->resourceVisibilityDomainService->saveVisibilityByPrincipals(
            $this->createPermissionDataIsolation($dataIsolation),
            ResourceVisibilityResourceType::SKILL,
            $code,
            $visibilityType,
            $userIds,
            $departmentIds
        );
    }
}
