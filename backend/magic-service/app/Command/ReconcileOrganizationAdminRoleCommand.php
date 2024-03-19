<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Application\Kernel\MagicPermission;
use App\Domain\OrganizationEnvironment\Repository\Persistence\Model\OrganizationModel;
use App\Domain\Permission\Repository\Persistence\Model\OrganizationAdminModel;
use App\Domain\Permission\Repository\Persistence\Model\RoleModel;
use App\Domain\Permission\Repository\Persistence\Model\RoleUserModel;
use App\Domain\Permission\Service\RoleDomainService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

use function Hyperf\Support\now;

#[Command]
class ReconcileOrganizationAdminRoleCommand extends HyperfCommand
{
    private const int DEFAULT_BATCH_SIZE = 200;

    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('permission:reconcile-organization-admin-role');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('检查并补偿组织管理员表与 RBAC 角色关系，同步 ALL/PERSON/PLATFORM 权限组');
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, '预览模式，不实际写入数据库');
        $this->addOption('organization-code', null, InputOption::VALUE_OPTIONAL, '仅处理指定组织');
        $this->addOption('batch-size', null, InputOption::VALUE_OPTIONAL, '批处理大小', self::DEFAULT_BATCH_SIZE);
        $this->addOption('cleanup-orphans', null, InputOption::VALUE_NONE, '清理组织管理员角色中的冗余用户绑定');
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->input->getOption('dry-run');
        $organizationCode = (string) ($this->input->getOption('organization-code') ?? '');
        $batchSize = max(1, (int) $this->input->getOption('batch-size'));
        $cleanupOrphans = (bool) $this->input->getOption('cleanup-orphans');

        $query = OrganizationModel::query();
        if ($organizationCode !== '') {
            $query->where('magic_organization_code', $organizationCode);
        }

        $total = (clone $query)->count();
        if ($total === 0) {
            $this->info('未找到可处理的组织数据');
            return 0;
        }

        $this->line(sprintf(
            '开始检查组织管理员角色同步: total=%d, dry_run=%s, cleanup_orphans=%s, org=%s, batch_size=%d',
            $total,
            $dryRun ? 'true' : 'false',
            $cleanupOrphans ? 'true' : 'false',
            $organizationCode === '' ? 'ALL' : $organizationCode,
            $batchSize
        ));

        if (! $dryRun && ! $this->confirm('将写入数据库，是否继续？', false)) {
            $this->warn('已取消');
            return 0;
        }

        $processed = 0;
        $createdRoles = 0;
        $updatedRoles = 0;
        $addedRelations = 0;
        $removedRelations = 0;
        $staleRelations = 0;
        $duplicateRoleRows = 0;
        $failed = 0;

        $query->orderBy('id')->chunk($batchSize, function ($organizations) use (
            &$processed,
            &$createdRoles,
            &$updatedRoles,
            &$addedRelations,
            &$removedRelations,
            &$staleRelations,
            &$duplicateRoleRows,
            &$failed,
            $dryRun,
            $cleanupOrphans
        ) {
            foreach ($organizations as $organization) {
                ++$processed;

                $orgCode = (string) $organization->magic_organization_code;
                $orgType = (int) $organization->type;

                try {
                    $result = $this->reconcileOrganization($orgCode, $orgType, $dryRun, $cleanupOrphans);
                    $createdRoles += $result['created_roles'];
                    $updatedRoles += $result['updated_roles'];
                    $addedRelations += $result['added_relations'];
                    $removedRelations += $result['removed_relations'];
                    $staleRelations += $result['stale_relations'];
                    $duplicateRoleRows += $result['duplicate_role_rows'];

                    if ($result['duplicate_role_rows'] > 0) {
                        $this->warn(sprintf(
                            '组织存在重复 ORGANIZATION_ADMIN 角色: org=%s duplicate_rows=%d',
                            $orgCode,
                            $result['duplicate_role_rows']
                        ));
                    }
                } catch (Throwable $throwable) {
                    ++$failed;
                    $this->warn(sprintf(
                        '处理失败: org=%s error=%s',
                        $orgCode,
                        $throwable->getMessage()
                    ));
                }
            }

            $this->line(sprintf(
                '处理进度: %d, %s创建角色=%d, %s更新角色=%d, %s新增绑定=%d, %s移除绑定=%d, 仍有冗余绑定=%d, 重复角色行=%d, failed=%d',
                $processed,
                $dryRun ? '将' : '已',
                $createdRoles,
                $dryRun ? '将' : '已',
                $updatedRoles,
                $dryRun ? '将' : '已',
                $addedRelations,
                $dryRun ? '将' : '已',
                $removedRelations,
                $staleRelations,
                $duplicateRoleRows,
                $failed
            ));
        });

        $this->info(sprintf(
            '完成: processed=%d, %screated_roles=%d, %supdated_roles=%d, %sadded_relations=%d, %sremoved_relations=%d, stale_relations=%d, duplicate_role_rows=%d, failed=%d',
            $processed,
            $dryRun ? 'would_' : '',
            $createdRoles,
            $dryRun ? 'would_' : '',
            $updatedRoles,
            $dryRun ? 'would_' : '',
            $addedRelations,
            $dryRun ? 'would_' : '',
            $removedRelations,
            $staleRelations,
            $duplicateRoleRows,
            $failed
        ));

        return $failed > 0 ? 1 : 0;
    }

    /**
     * @return array{
     *   created_roles:int,
     *   updated_roles:int,
     *   added_relations:int,
     *   removed_relations:int,
     *   stale_relations:int,
     *   duplicate_role_rows:int
     * }
     */
    private function reconcileOrganization(string $organizationCode, int $organizationType, bool $dryRun, bool $cleanupOrphans): array
    {
        $expectedPermission = $this->getExpectedPermissionByOrganizationType($organizationCode, $organizationType);
        $activeAdminUserIds = $this->getActiveOrganizationAdminUserIds($organizationCode);

        $createdRoles = 0;
        $updatedRoles = 0;
        $addedRelations = 0;
        $removedRelations = 0;
        $staleRelations = 0;

        $roleModels = RoleModel::query()
            ->where('organization_code', $organizationCode)
            ->where('name', RoleDomainService::ORGANIZATION_ADMIN_ROLE_NAME)
            ->orderBy('id')
            ->get();

        $duplicateRoleRows = max(0, $roleModels->count() - 1);
        $roleModel = $roleModels->first();

        if ($roleModel === null && $activeAdminUserIds !== []) {
            ++$createdRoles;
            if (! $dryRun) {
                $roleModel = RoleModel::query()->create([
                    'name' => RoleDomainService::ORGANIZATION_ADMIN_ROLE_NAME,
                    'permission_key' => [$expectedPermission],
                    'organization_code' => $organizationCode,
                    'is_display' => 0,
                    'status' => RoleModel::STATUS_ENABLED,
                    'created_uid' => null,
                    'updated_uid' => null,
                ]);
            }
        }

        if ($roleModel !== null && $this->needUpdateRole($roleModel, $expectedPermission)) {
            ++$updatedRoles;
            if (! $dryRun) {
                $roleModel->setPermissions([$expectedPermission]);
                $roleModel->is_display = 0;
                $roleModel->status = RoleModel::STATUS_ENABLED;
                $roleModel->updated_at = now();
                $roleModel->save();
            }
        }

        if ($roleModel !== null) {
            $assignedUserIds = $this->getAssignedOrganizationAdminRoleUserIds($organizationCode, (int) $roleModel->id);

            $toAdd = array_values(array_diff($activeAdminUserIds, $assignedUserIds));
            $toRemove = array_values(array_diff($assignedUserIds, $activeAdminUserIds));

            $addedRelations = count($toAdd);
            if (! $dryRun && $toAdd !== []) {
                $this->insertRoleUsers($organizationCode, (int) $roleModel->id, $toAdd);
            }

            if ($cleanupOrphans) {
                $removedRelations = count($toRemove);
                if (! $dryRun && $toRemove !== []) {
                    RoleUserModel::query()
                        ->where('organization_code', $organizationCode)
                        ->where('role_id', $roleModel->id)
                        ->whereIn('user_id', $toRemove)
                        ->delete();
                }
            } else {
                $staleRelations = count($toRemove);
            }
        }

        return [
            'created_roles' => $createdRoles,
            'updated_roles' => $updatedRoles,
            'added_relations' => $addedRelations,
            'removed_relations' => $removedRelations,
            'stale_relations' => $staleRelations,
            'duplicate_role_rows' => $duplicateRoleRows,
        ];
    }

    private function getExpectedPermissionByOrganizationType(string $organizationCode, int $organizationType): string
    {
        $officialOrganization = (string) config('service_provider.office_organization', '');
        if ($officialOrganization !== '' && $officialOrganization === $organizationCode) {
            return MagicPermission::PLATFORM_PERMISSIONS;
        }

        return $organizationType === 1
            ? MagicPermission::PERSON_PERMISSIONS
            : MagicPermission::ALL_PERMISSIONS;
    }

    /**
     * @return array<int, string>
     */
    private function getActiveOrganizationAdminUserIds(string $organizationCode): array
    {
        $userIds = OrganizationAdminModel::query()
            ->where('organization_code', $organizationCode)
            ->where('status', OrganizationAdminModel::STATUS_ENABLED)
            ->pluck('user_id')
            ->toArray();

        return $this->normalizeUserIds($userIds);
    }

    /**
     * @return array<int, string>
     */
    private function getAssignedOrganizationAdminRoleUserIds(string $organizationCode, int $roleId): array
    {
        $userIds = RoleUserModel::query()
            ->where('organization_code', $organizationCode)
            ->where('role_id', $roleId)
            ->pluck('user_id')
            ->toArray();

        return $this->normalizeUserIds($userIds);
    }

    private function needUpdateRole(RoleModel $roleModel, string $expectedPermission): bool
    {
        $expectedPermissions = [$expectedPermission];
        $currentPermissions = $this->normalizePermissionKeys($roleModel->getPermissions());

        return $currentPermissions !== $expectedPermissions
            || (int) $roleModel->is_display !== 0
            || (int) $roleModel->status !== RoleModel::STATUS_ENABLED;
    }

    /**
     * @param array<int, string> $userIds
     */
    private function insertRoleUsers(string $organizationCode, int $roleId, array $userIds): void
    {
        $rows = [];
        foreach ($userIds as $userId) {
            $rows[] = [
                'role_id' => $roleId,
                'user_id' => $userId,
                'organization_code' => $organizationCode,
                'assigned_by' => null,
                'assigned_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if ($rows !== []) {
            RoleUserModel::query()->insert($rows);
        }
    }

    /**
     * @param array<int, mixed> $permissionKeys
     * @return array<int, string>
     */
    private function normalizePermissionKeys(array $permissionKeys): array
    {
        $normalized = [];
        foreach ($permissionKeys as $permissionKey) {
            if (is_string($permissionKey) && $permissionKey !== '') {
                $normalized[$permissionKey] = $permissionKey;
            }
        }

        $values = array_values($normalized);
        sort($values);
        return $values;
    }

    /**
     * @param array<int, mixed> $userIds
     * @return array<int, string>
     */
    private function normalizeUserIds(array $userIds): array
    {
        $normalized = [];
        foreach ($userIds as $userId) {
            if (is_string($userId) && $userId !== '') {
                $normalized[$userId] = $userId;
            }
        }

        return array_values($normalized);
    }
}
