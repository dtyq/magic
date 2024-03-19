<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Bootstrap\Service\Initializer;

use App\Application\Kernel\MagicPermission;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\OrganizationEnvironment\Repository\Persistence\Model\OrganizationModel;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Persistence\Model\OrganizationAdminModel;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use App\Domain\Permission\Service\RoleDomainService;
use Carbon\Carbon;
use Hyperf\DbConnection\Db;

class PermissionInitializer
{
    public function __construct(
        private readonly OrganizationAdminDomainService $organizationAdminDomainService,
        private readonly RoleDomainService $roleDomainService,
        private readonly OrganizationDomainService $organizationDomainService,
    ) {
    }

    /**
     * @return array{
     *   success:bool,
     *   organization_admin_role:string,
     *   permission_group:string,
     *   is_idempotent_replay:bool
     * }
     */
    public function initialize(string $organizationCode, string $userId, string $magicId): array
    {
        $changed = false;
        $changed = $this->ensureOrganizationCreatorInfo($organizationCode, $userId);
        $changed = $this->ensureOrganizationAdminEnabled($organizationCode, $userId, $magicId) || $changed;

        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);
        if (! $this->organizationAdminDomainService->isOrganizationAdmin($dataIsolation, $userId)) {
            $this->organizationAdminDomainService->grant(
                dataIsolation: $dataIsolation,
                userId: $userId,
                grantorUserId: $userId,
                remarks: 'bootstrap 初始化组织管理员',
                isOrganizationCreator: true
            );
            $changed = true;
        }

        $permissionIsolation = PermissionDataIsolation::create($organizationCode, $userId);
        $expectedPermissionGroup = $this->resolveOrganizationAdminPermissionGroup($organizationCode);
        $roleEntity = $this->roleDomainService->getByName($permissionIsolation, RoleDomainService::ORGANIZATION_ADMIN_ROLE_NAME);

        $needRoleSync = $roleEntity === null
            || count($roleEntity->getPermissions()) !== 1
            || ! in_array($expectedPermissionGroup, $roleEntity->getPermissions(), true)
            || ! $roleEntity->hasUser($userId)
            || ! $roleEntity->isEnabled()
            || $roleEntity->getIsDisplay() !== 0;

        if ($needRoleSync) {
            $this->roleDomainService->addOrganizationAdmin($permissionIsolation, [$userId]);
            $changed = true;
        }

        return [
            'success' => true,
            'organization_admin_role' => RoleDomainService::ORGANIZATION_ADMIN_ROLE_NAME,
            'permission_group' => $expectedPermissionGroup,
            'is_idempotent_replay' => ! $changed,
        ];
    }

    private function ensureOrganizationCreatorInfo(string $organizationCode, string $userId): bool
    {
        $organization = OrganizationModel::query()
            ->where('magic_organization_code', $organizationCode)
            ->first();

        if ($organization === null) {
            return false;
        }

        $changed = false;
        if (empty((string) $organization->creator_id)) {
            $organization->creator_id = $userId;
            $changed = true;
        }
        if (empty((string) $organization->contact_user)) {
            $organization->contact_user = '管理员';
            $changed = true;
        }
        if ($changed) {
            $organization->updated_at = Carbon::now();
            $organization->save();
        }

        return $changed;
    }

    private function ensureOrganizationAdminEnabled(string $organizationCode, string $userId, string $magicId): bool
    {
        /** @var null|array{id:int,status:int,deleted_at:null|string,magic_id:null|string,is_organization_creator:int,granted_at:null|string} $admin */
        $admin = Db::table('magic_organization_admins')
            ->where('organization_code', $organizationCode)
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->first();

        if ($admin === null) {
            return false;
        }

        $updateData = [];
        if ((int) ($admin['status'] ?? 0) !== OrganizationAdminModel::STATUS_ENABLED) {
            $updateData['status'] = OrganizationAdminModel::STATUS_ENABLED;
        }
        if (($admin['deleted_at'] ?? null) !== null) {
            $updateData['deleted_at'] = null;
        }
        if (empty((string) ($admin['magic_id'] ?? ''))) {
            $updateData['magic_id'] = $magicId;
        }
        if ((int) ($admin['is_organization_creator'] ?? 0) !== 1) {
            $updateData['is_organization_creator'] = 1;
        }
        if (empty((string) ($admin['granted_at'] ?? ''))) {
            $updateData['granted_at'] = date('Y-m-d H:i:s');
        }

        if ($updateData !== []) {
            $updateData['updated_at'] = date('Y-m-d H:i:s');
            Db::table('magic_organization_admins')
                ->where('id', $admin['id'])
                ->update($updateData);
        }

        return $updateData !== [];
    }

    private function resolveOrganizationAdminPermissionGroup(string $organizationCode): string
    {
        $officialOrganization = (string) config('service_provider.office_organization', '');
        if ($officialOrganization !== '' && $officialOrganization === $organizationCode) {
            return MagicPermission::PLATFORM_PERMISSIONS;
        }

        $organization = $this->organizationDomainService->getByCode($organizationCode);
        if ($organization && $organization->getType() === 1) {
            return MagicPermission::PERSON_PERMISSIONS;
        }

        return MagicPermission::ALL_PERMISSIONS;
    }
}
