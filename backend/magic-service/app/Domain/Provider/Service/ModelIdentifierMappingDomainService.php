<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\Entity\ModelIdentifierMappingEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\ProviderModelType;
use App\Domain\Provider\Entity\ValueObject\Query\ModelIdentifierMappingQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\ModelIdentifierMappingRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\OfficialOrganizationUtil;

class ModelIdentifierMappingDomainService
{
    /**
     * 注入映射仓储和模型仓储，集中编排映射业务规则。
     */
    public function __construct(
        private readonly ModelIdentifierMappingRepositoryInterface $mappingRepository,
        private readonly ProviderModelRepositoryInterface $providerModelRepository,
    ) {
    }

    /**
     * 将模型标识替换为当前启用映射的目标标识。
     */
    public function replaceModelIdentifier(ProviderDataIsolation $dataIsolation, string $modelId): string
    {
        return $this->mappingRepository->findActiveTargetModelId($dataIsolation, $modelId) ?? $modelId;
    }

    /**
     * 查询映射组并按组聚合源模型标识。
     */
    public function queryGroups(ProviderDataIsolation $dataIsolation, ModelIdentifierMappingQuery $query, Page $page): array
    {
        $this->assertOfficialOrganization($dataIsolation);
        return $this->mappingRepository->queryGroups($dataIsolation, $query, $page);
    }

    /**
     * 查询映射组详情，不存在时返回用户可理解的业务错误。
     */
    public function getGroup(ProviderDataIsolation $dataIsolation, string $groupId): array
    {
        $this->assertOfficialOrganization($dataIsolation);
        $rows = $this->mappingRepository->getByGroupId($dataIsolation, $groupId);
        if ($rows === []) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.group_not_found');
        }
        return $this->assembleGroup($rows);
    }

    /**
     * 校验并保存映射组。
     */
    public function saveGroup(
        ProviderDataIsolation $dataIsolation,
        string $groupName,
        array $sourceModelIds,
        string $targetModelId,
        ?string $groupId = null,
    ): array {
        $this->assertOfficialOrganization($dataIsolation);
        $this->validateGroup($dataIsolation, $groupName, $sourceModelIds, $targetModelId, $groupId);
        $groupId ??= IdGenerator::getUniqueId32();
        $rows = $this->mappingRepository->saveGroup(
            $dataIsolation,
            $groupId,
            $groupName,
            $targetModelId,
            $sourceModelIds,
        );
        return $this->assembleGroup($rows);
    }

    /**
     * 校验并更新单个映射组状态，启用前重新确认目标模型仍可用。
     */
    public function updateStatus(ProviderDataIsolation $dataIsolation, string $groupId, int $status): void
    {
        $this->assertOfficialOrganization($dataIsolation);
        $this->validateStatus($status);
        $rows = $this->mappingRepository->getByGroupId($dataIsolation, $groupId);
        $this->assertExistingGroup($rows);
        if ($status === Status::Enabled->value) {
            $this->validateTargetModels($dataIsolation, [$rows[0]->getTargetModelId()]);
        }
        $this->mappingRepository->updateGroupStatus($dataIsolation, $groupId, $status);
    }

    /**
     * 批量更新映射组状态，并批量获取目标模型数据进行校验。
     */
    public function batchUpdateStatus(ProviderDataIsolation $dataIsolation, array $groupIds, ?int $status): void
    {
        $this->assertOfficialOrganization($dataIsolation);
        $this->assertBatchIds($groupIds);
        if ($status === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.status_required');
        }
        $this->validateStatus($status);
        $groups = $this->mappingRepository->getByGroupIds($dataIsolation, $groupIds);
        $this->assertExistingGroups($groupIds, $groups);
        if ($status === Status::Enabled->value) {
            $targetModelIds = [];
            foreach ($groups as $rows) {
                $targetModelIds[] = $rows[0]->getTargetModelId();
            }
            $this->validateTargetModels($dataIsolation, $targetModelIds);
        }
        $this->mappingRepository->updateGroupsStatus($dataIsolation, $groupIds, $status);
    }

    /**
     * 删除单个映射组。
     */
    public function deleteGroup(ProviderDataIsolation $dataIsolation, string $groupId): void
    {
        $this->assertOfficialOrganization($dataIsolation);
        $this->assertExistingGroup($this->mappingRepository->getByGroupId($dataIsolation, $groupId));
        $this->mappingRepository->deleteGroup($dataIsolation, $groupId);
    }

    /**
     * 批量删除映射组。
     */
    public function batchDelete(ProviderDataIsolation $dataIsolation, array $groupIds): void
    {
        $this->assertOfficialOrganization($dataIsolation);
        $this->assertBatchIds($groupIds);
        $this->assertExistingGroups($groupIds, $this->mappingRepository->getByGroupIds($dataIsolation, $groupIds));
        $this->mappingRepository->deleteGroups($dataIsolation, $groupIds);
    }

    /**
     * 查询官方组织下全部可用模型候选项，供源模型和目标模型共用。
     */
    public function modelOptions(ProviderDataIsolation $dataIsolation, string $keyword = ''): array
    {
        $this->assertOfficialOrganization($dataIsolation);
        return $this->providerModelRepository->queryAvailableModelOptions($dataIsolation, trim($keyword));
    }

    /**
     * 校验保存请求的业务约束和源标识冲突。
     */
    public function validateGroup(
        ProviderDataIsolation $dataIsolation,
        string $groupName,
        array $sourceModelIds,
        string $targetModelId,
        ?string $groupId = null,
    ): void {
        if ($groupName === '') {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.group_name_required');
        }
        if (mb_strlen($groupName) > 100) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.group_name_too_long');
        }
        if ($sourceModelIds === []) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.source_models_required');
        }
        if (count($sourceModelIds) > 100) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.source_models_too_many');
        }
        foreach (array_merge($sourceModelIds, [$targetModelId]) as $modelId) {
            if ($modelId === '' || mb_strlen($modelId) > 100) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.model_id_invalid');
            }
        }
        if (in_array($targetModelId, $sourceModelIds, true)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.source_target_same');
        }

        $currentGroupRows = $groupId === null ? [] : $this->mappingRepository->getByGroupId($dataIsolation, $groupId);
        $currentGroupRowIds = array_values(array_filter(array_map(
            static fn (ModelIdentifierMappingEntity $row): ?int => $row->getId(),
            $currentGroupRows,
        )));
        $conflicts = $this->mappingRepository->findConflictingSourceModelIds(
            $dataIsolation,
            array_merge($sourceModelIds, [$targetModelId]),
            $groupId,
            $currentGroupRowIds,
        );
        $sourceConflicts = array_values(array_intersect($sourceModelIds, $conflicts));
        if ($sourceConflicts !== []) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.source_model_conflict', [
                'model_ids' => implode('、', $sourceConflicts),
            ]);
        }

        $models = $this->providerModelRepository->getAvailableByModelIds($dataIsolation, [$targetModelId]);
        $targetModel = $models[$targetModelId][0] ?? null;
        if ($targetModel === null || ! $targetModel->getStatus()->isEnabled()) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.target_model_unavailable');
        }
        if ($targetModel->getType() === ProviderModelType::DYNAMIC) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.target_model_dynamic');
        }

        if (in_array($targetModelId, $conflicts, true)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.target_model_used_as_source');
        }
    }

    /**
     * 校验当前请求是否来自官方组织。
     */
    public function assertOfficialOrganization(ProviderDataIsolation $dataIsolation): void
    {
        if (! OfficialOrganizationUtil::isOfficialOrganization($dataIsolation->getCurrentOrganizationCode())) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.official_organization_only');
        }
    }

    /**
     * 校验映射组状态只能是启用或停用。
     */
    public function validateStatus(int $status): void
    {
        if (! in_array($status, [Status::Disabled->value, Status::Enabled->value], true)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.invalid_status');
        }
    }

    /**
     * 批量校验目标模型，确保启用后的调用不会立即失败。
     */
    public function validateTargetModels(ProviderDataIsolation $dataIsolation, array $targetModelIds): void
    {
        $targetModelIds = array_values(array_unique(array_filter($targetModelIds)));
        if ($targetModelIds === []) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.valid_groups_required');
        }

        $models = $this->providerModelRepository->getAvailableByModelIds($dataIsolation, $targetModelIds);
        foreach ($targetModelIds as $targetModelId) {
            $targetModel = $models[$targetModelId][0] ?? null;
            if ($targetModel === null || ! $targetModel->getStatus()->isEnabled()) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.target_model_unavailable_for_group', [
                    'model_id' => $targetModelId,
                ]);
            }
            if ($targetModel->getType() === ProviderModelType::DYNAMIC) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.target_model_dynamic_for_group', [
                    'model_id' => $targetModelId,
                ]);
            }
        }
    }

    /**
     * @param ModelIdentifierMappingEntity[] $rows
     */
    private function assembleGroup(array $rows): array
    {
        $first = $rows[0];
        return [
            'group_id' => $first->getGroupId(),
            'group_name' => $first->getGroupName(),
            'source_model_ids' => array_map(static fn ($row): string => $row->getSourceModelId(), $rows),
            'target_model_id' => $first->getTargetModelId(),
            'status' => $first->getStatus()->value,
            'created_at' => $first->getCreatedAt()?->format('Y-m-d H:i:s'),
            'updated_at' => $first->getUpdatedAt()?->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * 校验批量操作数量，避免一次请求影响过多映射组。
     */
    private function assertBatchIds(array $groupIds): void
    {
        if ($groupIds === []) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.groups_required');
        }
        if (count($groupIds) > 100) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.groups_too_many');
        }
    }

    /**
     * 校验单个映射组查询结果。
     */
    private function assertExistingGroup(array $rows): void
    {
        if ($rows === []) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.group_not_found');
        }
    }

    /**
     * 校验批量操作中的映射组是否全部存在。
     */
    private function assertExistingGroups(array $groupIds, array $groups): void
    {
        if (array_diff($groupIds, array_keys($groups)) !== []) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.model_identifier_mapping.groups_partial_missing');
        }
    }
}
