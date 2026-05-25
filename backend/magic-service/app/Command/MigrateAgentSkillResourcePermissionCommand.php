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
class MigrateAgentSkillResourcePermissionCommand extends HyperfCommand
{
    private const int DEFAULT_BATCH_SIZE = 200;

    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('permission:migrate-agent-skill-resource-keys');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('将角色权限中的 agent/skill 历史 resource_key 迁移为拆分后的目标资源 key');
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
            '开始迁移 agent/skill resource_key: total=%d, dry_run=%s, org=%s, batch_size=%d',
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
            $nextPermissions = [$permissionKey];
            if (is_string($permissionKey) && $permissionKey !== '') {
                $mappedPermissions = $this->mapPermissionKey($permissionKey);
                if ($mappedPermissions !== [$permissionKey]) {
                    ++$replacedCount;
                }
                $nextPermissions = $mappedPermissions;
            }

            foreach ($nextPermissions as $nextPermission) {
                if (is_string($nextPermission)) {
                    if (isset($dedup[$nextPermission])) {
                        continue;
                    }
                    $dedup[$nextPermission] = true;
                }

                $normalized[] = $nextPermission;
            }
        }

        return [$normalized, $replacedCount];
    }

    /**
     * @return string[]
     */
    private function mapPermissionKey(string $permissionKey): array
    {
        return match (true) {
            str_starts_with($permissionKey, 'platform.ai.agent_management.') => $this->mapAgentPermissionKey($permissionKey),
            str_starts_with($permissionKey, 'platform.ai.skill_management.') => $this->mapSkillPermissionKey($permissionKey),
            default => [$permissionKey],
        };
    }

    /**
     * @return string[]
     */
    private function mapAgentPermissionKey(string $permissionKey): array
    {
        $operation = substr($permissionKey, strlen('platform.ai.agent_management.'));

        return match ($operation) {
            'query' => [
                'platform.agent.official.query',
                'platform.agent.review.query',
                'platform.agent.market.query',
            ],
            'edit' => [
                'platform.agent.review.edit',
                'platform.agent.market.edit',
            ],
            default => [$permissionKey],
        };
    }

    /**
     * @return string[]
     */
    private function mapSkillPermissionKey(string $permissionKey): array
    {
        $operation = substr($permissionKey, strlen('platform.ai.skill_management.'));

        return match ($operation) {
            'query' => [
                'platform.skill.review.query',
                'platform.skill.market.query',
            ],
            'edit' => [
                'platform.skill.review.edit',
                'platform.skill.market.edit',
            ],
            default => [$permissionKey],
        };
    }
}
