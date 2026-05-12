<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use Dtyq\SuperMagic\Application\Agent\Assembler\AdminSuperMagicAgentAssembler;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentMarketDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentVersionDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentMarketsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentVersionsRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\ReviewAgentVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\ReviewOrganizationAgentVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\UpdateAgentMarketRequestAdminDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\GetEmployeeDetailResponseDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\QueryAgentMarketsResponseAdminDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\QueryAgentVersionsResponseAdminDTO;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

/**
 * 后台管理 Agent 应用服务.
 */
class AdminSuperMagicAgentAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected SuperMagicAgentVersionDomainService $superMagicAgentVersionDomainService;

    #[Inject]
    protected SuperMagicAgentMarketDomainService $superMagicAgentMarketDomainService;

    #[Inject]
    protected AdminSuperMagicAgentAssembler $adminSuperMagicAgentAssembler;

    /**
     * 管理后台：分页查询员工（Agent）版本列表.
     */
    public function queryVersions(
        Authenticatable $authorization,
        QueryAgentVersionsRequestAdminDTO $requestDTO
    ): QueryAgentVersionsResponseAdminDTO {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $dataIsolation->disabled();

        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $result = $this->superMagicAgentVersionDomainService->queryVersions(
            $dataIsolation,
            $requestDTO->getReviewStatus(),
            $requestDTO->getPublishStatus(),
            PublishTargetType::filterValues($requestDTO->getPublishTargetType()),
            $requestDTO->getVersion(),
            $requestDTO->getOrganizationCode(),
            $requestDTO->getNameI18n(),
            $requestDTO->getStartTime(),
            $requestDTO->getEndTime(),
            $requestDTO->getOrderBy(),
            $page
        );

        return $this->adminSuperMagicAgentAssembler->createQueryVersionsResponseDTO(
            $result['list'],
            $page,
            $result['total']
        );
    }

    /**
     * 管理后台：分页查询员工（Agent）市场列表.
     */
    public function queryMarkets(
        Authenticatable $authorization,
        QueryAgentMarketsRequestAdminDTO $requestDTO
    ): QueryAgentMarketsResponseAdminDTO {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $dataIsolation->disabled();

        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $result = $this->superMagicAgentMarketDomainService->queryAdminMarkets(
            $requestDTO->getPublishStatus(),
            $requestDTO->getOrganizationCode(),
            $requestDTO->getNameI18n(),
            $requestDTO->getPublisherType(),
            $requestDTO->getAgentCode(),
            $requestDTO->getStartTime(),
            $requestDTO->getEndTime(),
            $requestDTO->getOrderBy(),
            $page
        );

        return $this->adminSuperMagicAgentAssembler->createQueryMarketsResponseDTO(
            $result['list'],
            $page,
            $result['total']
        );
    }

    /**
     * 查询当前组织内待审核/已审核的数字员工版本。
     * 仅包含发布到组织或指定成员范围的版本，不包含市场发布版本。
     */
    public function queryOrganizationVersions(
        Authenticatable $authorization,
        QueryAgentVersionsRequestAdminDTO $requestDTO
    ): QueryAgentVersionsResponseAdminDTO {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $publishTargetTypes = PublishTargetType::resolveOrganizationReviewFilterValues($requestDTO->getPublishTargetType());

        if ($publishTargetTypes === []) {
            return $this->adminSuperMagicAgentAssembler->createQueryVersionsResponseDTO([], $page, 0);
        }

        $result = $this->superMagicAgentVersionDomainService->queryVersions(
            $dataIsolation,
            $requestDTO->getReviewStatus(),
            $requestDTO->getPublishStatus(),
            $publishTargetTypes,
            $requestDTO->getVersion(),
            $dataIsolation->getCurrentOrganizationCode(),
            $requestDTO->getNameI18n(),
            $requestDTO->getStartTime(),
            $requestDTO->getEndTime(),
            $requestDTO->getOrderBy(),
            $page
        );

        return $this->adminSuperMagicAgentAssembler->createQueryVersionsResponseDTO(
            $result['list'],
            $page,
            $result['total']
        );
    }

    /**
     * 组织后台审核数字员工版本，按 action 分发通过或拒绝逻辑。
     */
    public function reviewOrganizationVersion(Authenticatable $authorization, int $id, ReviewOrganizationAgentVersionRequestDTO $requestDTO): void
    {
        if ($requestDTO->isApproved()) {
            $this->approveOrganizationVersion($authorization, $id, $requestDTO->getReviewRemark());
            return;
        }

        $this->rejectOrganizationVersion($authorization, $id, $requestDTO->getReviewRemark());
    }

    /**
     * 组织后台审核通过数字员工版本，并按发布目标同步组织内可见范围。
     */
    public function approveOrganizationVersion(Authenticatable $authorization, int $id, ?string $reviewRemark = null): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $modifier = $dataIsolation->getCurrentUserId();

        Db::beginTransaction();
        try {
            $versionEntity = $this->superMagicAgentVersionDomainService->reviewOrganizationAgentVersion(
                $dataIsolation,
                $id,
                ReviewStatus::APPROVED,
                $modifier,
                $reviewRemark
            );
            $agentEntity = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $versionEntity->getCode());
            $this->syncOrganizationAgentScope($dataIsolation, $agentEntity, $versionEntity);
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }
    }

    /**
     * 组织后台审核拒绝数字员工版本，不改变当前生效版本和可见范围。
     */
    public function rejectOrganizationVersion(Authenticatable $authorization, int $id, ?string $reviewRemark = null): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $this->superMagicAgentVersionDomainService->reviewOrganizationAgentVersion(
            $dataIsolation,
            $id,
            ReviewStatus::REJECTED,
            $dataIsolation->getCurrentUserId(),
            $reviewRemark
        );
    }

    /**
     * 更新员工市场排序值.
     */
    public function updateMarketSortOrder(Authenticatable $authorization, int $id, int $sortOrder): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $dataIsolation->disabled();

        if (! $this->superMagicAgentMarketDomainService->updateSortOrderById($id, $sortOrder)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
        }
    }

    /**
     * 按传入字段部分更新员工市场信息.
     */
    public function updateMarket(Authenticatable $authorization, int $id, UpdateAgentMarketRequestAdminDTO $requestDTO): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $dataIsolation->disabled();

        if (! $requestDTO->hasUpdates()) {
            return;
        }

        if (! $this->superMagicAgentMarketDomainService->updateInfoById($id, $requestDTO->getUpdatePayload())) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
        }
    }

    /**
     * 审核员工版本.
     */
    public function reviewAgentVersion(Authenticatable $authorization, int $id, ReviewAgentVersionRequestDTO $requestDTO): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 获取修改者
        $modifier = $dataIsolation->getCurrentUserId();

        // 调用 DomainService 审核版本
        $this->superMagicAgentVersionDomainService->reviewAgentVersion(
            $dataIsolation,
            $id,
            $requestDTO->getAction(),
            $modifier,
            $requestDTO->getPublisherType() ?: null,
            reviewRemark: $requestDTO->getReviewRemark()
        );
    }

    /**
     * 根据员工code查询员工详情.
     */
    public function getDetailByCode(Authenticatable $authorization, string $code): GetEmployeeDetailResponseDTO
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 查询 Agent 基本信息（不存在会抛出异常）
        $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);

        // 2. 更新 Agent 图标 URL（将路径转换为完整URL）
        $this->updateAgentEntityIcon($agent);

        // 3. 处理 prompt
        $prompt = $agent->getPrompt();

        // 4. 兼容旧数据
        $nameI18n = $agent->getNameI18n();
        $descriptionI18n = $agent->getDescriptionI18n();
        if (! $nameI18n) {
            foreach (LanguageEnum::getAllLanguageCodes() as $languageCode) {
                $nameI18n[$languageCode] = $agent->getName();
            }
        }
        if (! $descriptionI18n) {
            foreach (LanguageEnum::getAllLanguageCodes() as $languageCode) {
                $descriptionI18n[$languageCode] = $agent->getDescription();
            }
        }

        // 5. 构建响应 DTO
        return new GetEmployeeDetailResponseDTO(
            id: $agent->getId(),
            code: $agent->getCode(),
            versionCode: $agent->getVersionCode(),
            versionId: $agent->getVersionId() ? (string) $agent->getVersionId() : null,
            name: $agent->getI18nName($dataIsolation->getLanguage()),
            description: $agent->getI18nDescription($dataIsolation->getLanguage()),
            nameI18n: $nameI18n,
            roleI18n: $descriptionI18n,
            descriptionI18n: $agent->getDescriptionI18n(),
            icon: $agent->getIcon(),
            iconType: $agent->getIconType(),
            prompt: $prompt,
            enabled: $agent->getEnabled() ?? false,
            sourceType: $agent->getSourceType()->value,
            pinnedAt: $agent->getPinnedAt(),
            projectId: $agent->getProjectId(),
            createdAt: $agent->getCreatedAt(),
            updatedAt: $agent->getUpdatedAt()
        );
    }

    /**
     * 将审核通过的组织内发布范围同步到资源可见性表。
     */
    private function syncOrganizationAgentScope(
        SuperMagicAgentDataIsolation $dataIsolation,
        SuperMagicAgentEntity $agentEntity,
        AgentVersionEntity $versionEntity
    ): void {
        $this->superMagicAgentDomainService->offlineMarketPublishings($dataIsolation, $agentEntity->getCode());

        if ($versionEntity->getPublishTargetType() === PublishTargetType::ORGANIZATION) {
            $this->saveAgentVisibility($dataIsolation, $agentEntity->getCode(), VisibilityType::ALL);
            return;
        }

        $publishTargetValue = $versionEntity->getPublishTargetValue();
        $userIds = array_values(array_unique(array_merge(
            [$agentEntity->getCreator()],
            $publishTargetValue?->getUserIds() ?? []
        )));

        $this->saveAgentVisibility(
            $dataIsolation,
            $agentEntity->getCode(),
            VisibilityType::SPECIFIC,
            $userIds,
            $publishTargetValue?->getDepartmentIds() ?? []
        );
    }

    private function saveAgentVisibility(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code,
        VisibilityType $visibilityType,
        array $userIds = [],
        array $departmentIds = []
    ): void {
        $this->resourceVisibilityDomainService->saveVisibilityByPrincipals(
            $this->createPermissionDataIsolation($dataIsolation),
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
            $code,
            $visibilityType,
            $userIds,
            $departmentIds
        );
    }
}
