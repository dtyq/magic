<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Application\Kernel\MagicPermission;
use App\Domain\Permission\Repository\Persistence\Model\RoleModel;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class BackfillRolePermissionTagCommand extends HyperfCommand
{
    private const int DEFAULT_BATCH_SIZE = 200;

    public function __construct(
        protected ContainerInterface $container,
        private readonly MagicPermissionInterface $magicPermission,
    ) {
        parent::__construct('permission:backfill-role-tags');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('按最新菜单映射回填 magic_roles.permission_tag（不修改 permission_key）');
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
            '开始回填 permission_tag: total=%d, dry_run=%s, org=%s, batch_size=%d',
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
        $updated = 0;
        $invalidPermissionCount = 0;

        $query->orderBy('id')->chunk($batchSize, function ($roles) use (&$processed, &$updated, &$invalidPermissionCount, $dryRun) {
            foreach ($roles as $role) {
                ++$processed;

                $permissions = $role->getPermissions();
                [$newTags, $invalidCount] = $this->calculateTags($permissions);
                $invalidPermissionCount += $invalidCount;

                $normalizedCurrent = $this->normalizeTags($role->getPermissionTag());
                $normalizedNew = $this->normalizeTags($newTags);

                if ($normalizedCurrent === $normalizedNew) {
                    continue;
                }

                ++$updated;
                if (! $dryRun) {
                    $role->setPermissionTag($normalizedNew === [] ? null : $normalizedNew);
                    $role->save();
                }
            }

            $this->line(sprintf(
                '处理进度: %d, 将更新/已更新: %d, 无效权限键: %d',
                $processed,
                $updated,
                $invalidPermissionCount
            ));
        });

        $this->info(sprintf(
            '回填完成: processed=%d, %s=%d, invalid_permission_keys=%d',
            $processed,
            $dryRun ? 'would_update' : 'updated',
            $updated,
            $invalidPermissionCount
        ));

        return 0;
    }

    /**
     * @param array<int, mixed> $permissions
     * @return array{0: array<int, string>, 1: int}
     */
    private function calculateTags(array $permissions): array
    {
        $tags = [];
        $invalidPermissionCount = 0;

        foreach ($permissions as $permissionKey) {
            if (! is_string($permissionKey) || $permissionKey === '') {
                ++$invalidPermissionCount;
                continue;
            }

            if (
                $permissionKey === MagicPermission::ALL_PERMISSIONS
                || $permissionKey === MagicPermission::PERSON_PERMISSIONS
                || $permissionKey === MagicPermission::PLATFORM_PERMISSIONS
            ) {
                continue;
            }

            try {
                $parsed = $this->magicPermission->parsePermission($permissionKey);
                $moduleLabel = $this->magicPermission->getResourceModule($parsed['resource']);
                if ($moduleLabel !== '') {
                    $tags[$moduleLabel] = $moduleLabel;
                }
            } catch (Throwable) {
                ++$invalidPermissionCount;
            }
        }

        return [array_values($tags), $invalidPermissionCount];
    }

    /**
     * @param null|array<int, mixed> $tags
     * @return array<int, string>
     */
    private function normalizeTags(?array $tags): array
    {
        if (! is_array($tags) || $tags === []) {
            return [];
        }

        $normalized = [];
        foreach ($tags as $tag) {
            if (is_string($tag) && $tag !== '') {
                $normalized[$tag] = $tag;
            }
        }

        $values = array_values($normalized);
        sort($values);
        return $values;
    }
}
