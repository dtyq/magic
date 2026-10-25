<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MagicBase\Support;

use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\MagicBase\Entity\MagicBaseColumnEntity;
use App\Domain\MagicBase\Entity\MagicBaseRowEntity;
use App\Domain\MagicBase\Entity\MagicBaseRowPermissionEntity;
use App\Domain\MagicBase\Entity\MagicBaseTableEntity;
use App\Domain\MagicBase\Entity\ValueObject\ActorContext;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseAccessContext;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseColumnIndex;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseEntityCollection;
use App\Domain\MagicBase\Entity\ValueObject\MagicBasePermissionIndex;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseTableAccessContext;
use App\Domain\MagicBase\Exception\MagicBaseExceptionBuilder;
use App\Domain\MagicBase\Service\MagicBaseMetadataDomainService;
use App\Domain\MagicBase\Service\MagicBasePermissionDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowStorageResolverDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use LogicException;

readonly class MagicBaseAccessControl
{
    public function __construct(
        private MagicBaseMetadataDomainService $metadataDomainService,
        private MagicBasePermissionDomainService $permissionDomainService,
        private MagicBaseRowStorageResolverDomainService $rowStorageResolver,
        private ProjectDomainService $projectDomainService,
        private ProjectMemberDomainService $projectMemberDomainService,
        private MagicDepartmentUserDomainService $departmentUserDomainService,
        private MicroAppRepositoryInterface $microAppRepository,
        private PublishedMicroAppFileAccessService $publishedMicroAppFileAccessService,
    ) {
    }

    public function assertMicroAppActive(int $projectId): void
    {
        $microApp = $this->microAppRepository->findByProjectIdWithTrashed($projectId);
        if ($microApp !== null && $microApp->getDeletedAt() !== null) {
            MagicBaseExceptionBuilder::resourceNotFound('微应用');
        }
    }

    public function requireReadableTable(MagicUserAuthorization $authorization, int $projectId, int $tableId): MagicBaseTableAccessContext
    {
        $this->requireReadableProject($authorization, $projectId);
        $context = $this->loadTableContext($authorization, $projectId, $tableId);
        if (! $this->canReadTable($context)) {
            $this->forbidden('magicbase.table_read_denied');
        }
        return $context;
    }

    public function canReadTable(MagicBaseTableAccessContext $context): bool
    {
        return $this->permissionDomainService->canReadTable(
            $context->getActor(),
            $context->getTable(),
            $context->getAccess()->getTablePermissions(),
            $context->getAccess()->isManager()
        );
    }

    public function filterReadableTables(MagicUserAuthorization $authorization, int $projectId, MagicBaseEntityCollection $tables): MagicBaseEntityCollection
    {
        $actor = $this->buildActorContext($authorization, $projectId);
        $projectAdmins = $this->metadataDomainService->listProjectAdmins($authorization->getOrganizationCode(), $projectId);
        $projectManager = $this->hasProjectDataAdminRole($authorization, $projectId);
        $readable = [];
        foreach ($tables as $table) {
            if (! $table instanceof MagicBaseTableEntity) {
                continue;
            }
            $tableId = (int) $table->getId();
            $permissions = $this->metadataDomainService->listTablePermissions($authorization->getOrganizationCode(), $tableId);
            $admins = $this->metadataDomainService->listTableAdmins($authorization->getOrganizationCode(), $tableId);
            $manager = $projectManager || $this->permissionDomainService->isManager($actor, $projectAdmins, $admins, $permissions);
            if ($this->permissionDomainService->canReadTable($actor, $this->enrichTableScope($table), $permissions, $manager)) {
                $readable[] = $table;
            }
        }
        return new MagicBaseEntityCollection($readable);
    }

    public function requireInsertableTable(MagicUserAuthorization $authorization, int $projectId, int $tableId): MagicBaseTableAccessContext
    {
        $context = $this->requireDataWritableTable($authorization, $projectId, $tableId);
        if (! $this->permissionDomainService->canInsertTable(
            $context->getActor(),
            $context->getTable(),
            $context->getAccess()->getTablePermissions(),
            $context->getAccess()->isManager()
        )) {
            $this->forbidden('magicbase.row_insert_denied');
        }
        return $context;
    }

    /** 业务数据写入可使用发布授权；表结构和权限管理仍要求协作角色。 */
    public function requireDataWritableTable(MagicUserAuthorization $authorization, int $projectId, int $tableId): MagicBaseTableAccessContext
    {
        $this->requireProjectRole($authorization, $projectId, MemberRole::EDITOR, 'magicbase.project_data_access_denied', true);
        return $this->loadTableContext($authorization, $projectId, $tableId);
    }

    public function requireWritableTable(MagicUserAuthorization $authorization, int $projectId, int $tableId): MagicBaseTableAccessContext
    {
        $this->requireWritableProject($authorization, $projectId);
        return $this->loadTableContext($authorization, $projectId, $tableId);
    }

    public function requireTableManager(MagicUserAuthorization $authorization, int $projectId, int $tableId): MagicBaseTableAccessContext
    {
        $this->requireManageableProject($authorization, $projectId);
        return $this->loadTableContext($authorization, $projectId, $tableId);
    }

    public function requireProjectManager(MagicUserAuthorization $authorization, int $projectId): ActorContext
    {
        $this->requireManageableProject($authorization, $projectId);
        return $this->buildActorContext($authorization, $projectId);
    }

    /**
     * Determine whether the real logged-in user is a micro-app data administrator.
     *
     * This intentionally does not use the share runtime actor. A share token
     * proves access to the shared project, but it must never make the share
     * creator look like the current user for administrator checks.
     */
    public function isProjectDataAdmin(MagicUserAuthorization $authorization, int $projectId): bool
    {
        return $this->hasProjectDataAdminRole($authorization, $projectId);
    }

    public function requireReadableProject(MagicUserAuthorization $authorization, int $projectId): void
    {
        $this->requireProjectRole($authorization, $projectId, MemberRole::VIEWER, 'magicbase.project_access_denied', true);
    }

    public function requireWritableProject(MagicUserAuthorization $authorization, int $projectId): void
    {
        $this->requireProjectRole($authorization, $projectId, MemberRole::EDITOR, 'magicbase.project_edit_denied');
    }

    public function requireManageableProject(MagicUserAuthorization $authorization, int $projectId): void
    {
        $this->requireProjectRole($authorization, $projectId, MemberRole::MANAGE, 'magicbase.project_manage_denied');
    }

    public function requireReadableRow(MagicUserAuthorization $authorization, MagicBaseTableAccessContext $context, int $recordId): MagicBaseRowEntity
    {
        $row = $this->getRowOrFail($authorization, $context->getProjectId(), $context->getTableId(), $recordId);
        if (! $this->permissionDomainService->canReadRow(
            $context->getActor(),
            $row,
            $context->getTable(),
            $context->getAccess()->getRowPermissions((int) $row->getRecordId()),
            $context->getAccess()->isManager()
        )) {
            $this->forbidden('magicbase.row_read_denied');
        }
        return $row;
    }

    public function requireEditableRow(MagicUserAuthorization $authorization, MagicBaseTableAccessContext $context, int $recordId): MagicBaseRowEntity
    {
        $row = $this->getRowOrFail($authorization, $context->getProjectId(), $context->getTableId(), $recordId);
        if (! $this->permissionDomainService->canEditRow(
            $context->getActor(),
            $row,
            $context->getTable(),
            $context->getAccess()->getRowPermissions((int) $row->getRecordId()),
            $context->getAccess()->isManager()
        )) {
            $this->forbidden('magicbase.row_edit_denied');
        }
        return $row;
    }

    public function requireDeletableRow(MagicUserAuthorization $authorization, MagicBaseTableAccessContext $context, int $recordId): MagicBaseRowEntity
    {
        $row = $this->getRowOrFail($authorization, $context->getProjectId(), $context->getTableId(), $recordId);
        if (! $this->permissionDomainService->canDeleteRow(
            $context->getActor(),
            $row,
            $context->getTable(),
            $context->getAccess()->getRowPermissions((int) $row->getRecordId()),
            $context->getAccess()->isManager()
        )) {
            $this->forbidden('magicbase.row_delete_denied');
        }
        return $row;
    }

    /**
     * @param list<string> $fieldKeys dynamic row field keys to be edited
     */
    public function assertEditableColumns(MagicBaseTableAccessContext $context, MagicBaseRowEntity $row, array $fieldKeys): void
    {
        foreach ($fieldKeys as $fieldKey) {
            $column = $context->getAccess()->getColumns()->get($fieldKey);
            if (! $column instanceof MagicBaseColumnEntity) {
                MagicBaseExceptionBuilder::resourceNotFound('字段');
            }
            if (! $this->permissionDomainService->canEditColumn(
                $context->getActor(),
                $row,
                $column,
                $context->getAccess()->getColumnPermissions((int) $column->getId()),
                $context->getAccess()->isManager()
            )) {
                $this->forbidden('magicbase.column_edit_denied');
            }
        }
    }

    public function filterReadableRows(MagicBaseTableAccessContext $context, MagicBaseEntityCollection $rows): MagicBaseEntityCollection
    {
        $readable = [];
        foreach ($rows as $row) {
            if (! $row instanceof MagicBaseRowEntity) {
                continue;
            }
            if ($this->permissionDomainService->canReadRow(
                $context->getActor(),
                $row,
                $context->getTable(),
                $context->getAccess()->getRowPermissions((int) $row->getRecordId()),
                $context->getAccess()->isManager()
            )) {
                $readable[] = $row;
            }
        }
        return new MagicBaseEntityCollection($readable);
    }

    /**
     * @return list<int>
     */
    public function getStaticReadableRecordIds(MagicBaseTableAccessContext $context): array
    {
        $recordIds = [];
        foreach ($context->getAccess()->getRowPermissionsByRecord() as $recordId => $permissions) {
            foreach ($permissions as $permission) {
                if (! $permission instanceof MagicBaseRowPermissionEntity) {
                    continue;
                }
                if ($this->permissionDomainService->matchSubject($permission, $context->getActor()) && $permission->getCanRead()) {
                    $recordIds[] = (int) $recordId;
                    break;
                }
            }
        }

        return array_values(array_unique(array_filter($recordIds, static fn (int $recordId): bool => $recordId > 0)));
    }

    public function loadTableContext(MagicUserAuthorization $authorization, int $projectId, int $tableId): MagicBaseTableAccessContext
    {
        $actor = $this->buildActorContext($authorization, $projectId);
        $table = $this->getTableOrFail($authorization, $projectId, $tableId);
        $table = $this->enrichTableScope($table);
        $access = $this->loadAccessContext($authorization, $projectId, $tableId, $actor);

        return new MagicBaseTableAccessContext($projectId, $tableId, $actor, $table, $access);
    }

    private function buildActorContext(MagicUserAuthorization $authorization, int $projectId): ActorContext
    {
        $shareActor = MagicBaseRuntimeProjectAccessContext::getShareActor($projectId);
        if ($shareActor !== null) {
            return $this->createActorContext($shareActor['user_id'], $shareActor['organization_code']);
        }

        return $this->createActorContext($authorization->getId(), $authorization->getOrganizationCode());
    }

    private function createActorContext(string $userId, string $organizationCode): ActorContext
    {
        if ($userId === '') {
            return new ActorContext('', $organizationCode, []);
        }

        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);
        $departmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userId, true);
        return new ActorContext($userId, $organizationCode, $departmentIds);
    }

    private function loadAccessContext(MagicUserAuthorization $authorization, int $projectId, int $tableId, ActorContext $actor): MagicBaseAccessContext
    {
        $projectAdmins = $this->metadataDomainService->listProjectAdmins($authorization->getOrganizationCode(), $projectId);
        $tableAdmins = $this->metadataDomainService->listTableAdmins($authorization->getOrganizationCode(), $tableId);
        $tablePermissions = $this->metadataDomainService->listTablePermissions($authorization->getOrganizationCode(), $tableId);
        $columnPermissions = $this->metadataDomainService->listColumnPermissions($authorization->getOrganizationCode(), $tableId);
        $rowPermissions = $this->metadataDomainService->listRowPermissions($authorization->getOrganizationCode(), $tableId);
        $isManager = $this->hasProjectDataAdminRole($authorization, $projectId)
            || $this->permissionDomainService->isManager($actor, $projectAdmins, $tableAdmins, $tablePermissions);

        return new MagicBaseAccessContext(
            $this->getColumnsByKey($authorization, $tableId),
            $tablePermissions,
            $projectAdmins,
            $tableAdmins,
            MagicBasePermissionIndex::fromCollection($columnPermissions, 'column_id'),
            MagicBasePermissionIndex::fromCollection($rowPermissions, 'record_id'),
            $isManager,
        );
    }

    private function enrichTableScope(MagicBaseTableEntity $table): MagicBaseTableEntity
    {
        if ($table->getCreatedBy() === '') {
            $table->setOwnerDepartmentIds([]);
            return $table;
        }

        $dataIsolation = DataIsolation::simpleMake($table->getOrganizationCode(), $table->getCreatedBy());
        $table->setOwnerDepartmentIds($this->departmentUserDomainService->getDepartmentIdsByUserId(
            $dataIsolation,
            $table->getCreatedBy(),
            true
        ));
        return $table;
    }

    private function getColumnsByKey(MagicUserAuthorization $authorization, int $tableId): MagicBaseColumnIndex
    {
        $columns = [];
        foreach ($this->metadataDomainService->listColumns($authorization->getOrganizationCode(), $tableId) as $column) {
            if ($column instanceof MagicBaseColumnEntity) {
                $columns[$column->getColumnKey()] = $column;
            }
        }
        return new MagicBaseColumnIndex($columns);
    }

    private function getTableOrFail(MagicUserAuthorization $authorization, int $projectId, int $tableId): MagicBaseTableEntity
    {
        $table = $this->metadataDomainService->getTable($authorization->getOrganizationCode(), $projectId, $tableId);
        if ($table === null) {
            MagicBaseExceptionBuilder::resourceNotFound('数据表');
        }
        return $table;
    }

    private function getRowOrFail(MagicUserAuthorization $authorization, int $projectId, int $tableId, int $recordId): MagicBaseRowEntity
    {
        $row = $this->rowStorageResolver->getRow($authorization->getOrganizationCode(), $projectId, $tableId, $recordId);
        if ($row === null || $row->getDeleted()) {
            MagicBaseExceptionBuilder::resourceNotFound('记录');
        }
        return $row;
    }

    private function forbidden(string $label): void
    {
        MagicBaseExceptionBuilder::accessDenied($label);
    }

    private function requireProjectRole(
        MagicUserAuthorization $authorization,
        int $projectId,
        MemberRole $requiredRole,
        string $deniedMessage,
        bool $allowRuntimeAccess = false,
    ): ProjectEntity {
        $project = $this->getProjectOrFail($projectId);
        if ($allowRuntimeAccess && MagicBaseRuntimeProjectAccessContext::hasShareAccess($projectId)) {
            return $project;
        }
        if (! $this->isSameOrganization($authorization, $project)) {
            $this->forbidden($deniedMessage);
        }
        if ($this->isProjectOwner($authorization, $project)) {
            return $project;
        }

        $member = $this->projectMemberDomainService->getMemberByProjectAndUser($projectId, $authorization->getId());
        if ($member !== null && $member->getRole()->isHigherOrEqualThan($requiredRole)) {
            return $project;
        }

        $dataIsolation = DataIsolation::simpleMake($authorization->getOrganizationCode(), $authorization->getId());
        $departmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $authorization->getId(), true);
        foreach ($this->projectMemberDomainService->getMembersByProjectAndDepartmentIds($projectId, $departmentIds) as $departmentMember) {
            if ($departmentMember->getRole()->isHigherOrEqualThan($requiredRole)) {
                return $project;
            }
        }

        // 发布授权只用于应用数据操作，不转换为协作者或管理员。
        if ($allowRuntimeAccess
            && $this->publishedMicroAppFileAccessService->canAccessProject(
                $projectId,
                $authorization->getId(),
                $authorization->getOrganizationCode()
            )) {
            return $project;
        }

        $this->forbidden($deniedMessage);
        throw new LogicException('Unreachable');
    }

    /**
     * Project editors are MagicBase data administrators, but permission
     * management still requires the project's manage role.
     */
    private function hasProjectDataAdminRole(MagicUserAuthorization $authorization, int $projectId): bool
    {
        $project = $this->getProjectOrFail($projectId);
        if (! $this->isSameOrganization($authorization, $project)) {
            return false;
        }
        if ($authorization->getId() === '') {
            return false;
        }
        if ($this->isProjectOwner($authorization, $project)) {
            return true;
        }

        $member = $this->projectMemberDomainService->getMemberByProjectAndUser($projectId, $authorization->getId());
        if ($member !== null && $member->getRole()->isHigherOrEqualThan(MemberRole::EDITOR)) {
            return true;
        }

        $dataIsolation = DataIsolation::simpleMake($authorization->getOrganizationCode(), $authorization->getId());
        $departmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $authorization->getId(), true);
        foreach ($this->projectMemberDomainService->getMembersByProjectAndDepartmentIds($projectId, $departmentIds) as $departmentMember) {
            if ($departmentMember->getRole()->isHigherOrEqualThan(MemberRole::EDITOR)) {
                return true;
            }
        }

        return false;
    }

    private function getProjectOrFail(int $projectId): ProjectEntity
    {
        $this->assertMicroAppActive($projectId);

        $projects = $this->projectDomainService->getProjectsByIds([$projectId]);
        foreach ($projects as $project) {
            if ($project instanceof ProjectEntity && $project->getId() === $projectId) {
                return $project;
            }
        }

        MagicBaseExceptionBuilder::resourceNotFound('项目');
        throw new LogicException('Unreachable');
    }

    private function isSameOrganization(MagicUserAuthorization $authorization, ProjectEntity $project): bool
    {
        return $project->getUserOrganizationCode() === ''
            || $project->getUserOrganizationCode() === $authorization->getOrganizationCode();
    }

    private function isProjectOwner(MagicUserAuthorization $authorization, ProjectEntity $project): bool
    {
        return in_array($authorization->getId(), [$project->getUserId(), $project->getCreatedUid()], true);
    }
}
