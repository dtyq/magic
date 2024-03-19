<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Domain\Permission\Repository\Persistence\Model\RoleModel;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;

#[Command]
class MigrateAdminAiPermissionToWorkspaceCommand extends HyperfCommand
{
    private const int DEFAULT_BATCH_SIZE = 200;

    /**
     * @var array<string, string>
     */
    private const array RESOURCE_MAPPING = [
        'admin.ai.model_management' => 'workspace.ai.model_management',
        'admin.ai.image_generation' => 'workspace.ai.image_generation',
    ];

    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('permission:migrate-admin-ai-to-workspace-ai');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('将角色权限中的 admin.ai.* 迁移为 workspace.ai.*（不兼容旧键）');
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, '预览模式，不实际写入数据库');
        $this->addOption('organization-code', null, InputOption::VALUE_OPTIONAL, '仅处理指定组织');
        $this->addOption('batch-size', null, InputOption::VALUE_OPTIONAL, '批处理大小', self::DEFAULT_BATCH_SIZE);
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->input->getOption('dry-run');
        $organizationCode = (string) ($this->input->getOption('organization-code') ?? '');
        $batchSize = max(1, (int) $this->input->getOption('batch-size'));

        $query = RoleModel::query();
        if ($organizationCode !== '') {
            $query->where('organization_code', $organizationCode);
        }

        $total = (clone $query)->count();
        if ($total === 0) {
            $this->info('未找到可处理的角色数据');
            return 0;
        }

        $this->line(sprintf(
            '开始迁移 permission_key: total=%d, dry_run=%s, org=%s, batch_size=%d',
            $total,
            $dryRun ? 'true' : 'false',
            $organizationCode === '' ? 'ALL' : $organizationCode,
            $batchSize
        ));

        if (! $dryRun && ! $this->confirm('将写入数据库，是否继续？', false)) {
            $this->warn('已取消');
            return 0;
        }

        $processed = 0;
        $updatedRoles = 0;
        $replacedPermissionKeys = 0;

        $query->orderBy('id')->chunk($batchSize, function ($roles) use (&$processed, &$updatedRoles, &$replacedPermissionKeys, $dryRun) {
            foreach ($roles as $role) {
                ++$processed;

                $originalPermissions = $role->getPermissions();
                [$migratedPermissions, $replacedCount] = $this->migratePermissions($originalPermissions);
                $replacedPermissionKeys += $replacedCount;

                if ($migratedPermissions === $originalPermissions) {
                    continue;
                }

                ++$updatedRoles;
                if (! $dryRun) {
                    $role->setPermissions($migratedPermissions);
                    $role->save();
                }
            }

            $this->line(sprintf(
                '处理进度: %d, 将更新/已更新角色: %d, 替换权限键数: %d',
                $processed,
                $updatedRoles,
                $replacedPermissionKeys
            ));
        });

        $this->info(sprintf(
            '迁移完成: processed=%d, %s=%d, replaced_permission_keys=%d',
            $processed,
            $dryRun ? 'would_update_roles' : 'updated_roles',
            $updatedRoles,
            $replacedPermissionKeys
        ));
        $this->line('如需同步角色标签，请执行: php bin/hyperf.php permission:backfill-role-tags --dry-run');

        return 0;
    }

    /**
     * @param array<int, mixed> $permissions
     * @return array{0: array<int, mixed>, 1: int}
     */
    private function migratePermissions(array $permissions): array
    {
        $replacedCount = 0;
        $normalized = [];
        $dedup = [];

        foreach ($permissions as $permissionKey) {
            $nextPermission = $permissionKey;
            if (is_string($permissionKey) && $permissionKey !== '') {
                $migrated = $this->mapPermissionKey($permissionKey);
                if ($migrated !== $permissionKey) {
                    ++$replacedCount;
                }
                $nextPermission = $migrated;
            }

            if (is_string($nextPermission)) {
                if (isset($dedup[$nextPermission])) {
                    continue;
                }
                $dedup[$nextPermission] = true;
            }

            $normalized[] = $nextPermission;
        }

        return [$normalized, $replacedCount];
    }

    private function mapPermissionKey(string $permissionKey): string
    {
        foreach (self::RESOURCE_MAPPING as $legacyResource => $newResource) {
            if ($permissionKey === $legacyResource) {
                return $newResource;
            }

            $prefix = $legacyResource . '.';
            if (str_starts_with($permissionKey, $prefix)) {
                return $newResource . substr($permissionKey, strlen($legacyResource));
            }
        }

        return $permissionKey;
    }
}
