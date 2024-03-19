<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Command;

use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\DbConnection\Db;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * 分享模块数据迁移命令：将旧的分享类型系统迁移到新的分享类型系统
 *
 * 背景说明：
 * 1. 在 magic_resource_shares 表中新增了两个字段：
 *    - share_range（分享范围）
 *    - share_project（是否分享整个项目）
 *
 * 2. share_type 的业务逻辑发生了重大变化：
 *    原来：1=仅自己可访问, 2=组织内可访问, 3=指定部门/成员可访问, 4=互联网可访问
 *    现在：2=团队内分享, 4=公开访问, 5=密码保护
 *
 * 3. resource_type 的业务逻辑变化：
 *    原来：12=Project（项目）
 *    现在：12已废弃，使用 13=FileCollection + share_project=true 表示项目分享
 *
 * 4. resource_type 完整类型说明：
 *    5  = Topic（话题）
 *    12 = Project（项目）- 【已废弃，需迁移为 13 + share_project=true】
 *    13 = FileCollection（文件集）
 *    15 = File（单文件）
 *
 * 迁移规则（6条核心规则）：
 * 规则1：share_type=4 且 password不为空 → share_type=5, is_password_enabled=true
 * 规则2：share_type=2 → share_type=2, share_range='all'
 * 规则3：share_type=1 → 软删除（deleted_at=timestamp）
 * 规则4：share_type=4 且 password为空 → share_type=4（保持不变）
 * 规则5：resource_type=12（Project）→ resource_type=13（FileCollection）+ share_project=true
 * 规则6：同步 is_password_enabled 字段
 *
 * 使用方法：
 *   php bin/hyperf.php share:migrate-share-type-data
 *   php bin/hyperf.php share:migrate-share-type-data --dry-run
 *   php bin/hyperf.php share:migrate-share-type-data --show-details
 */
#[Command]
class MigrateShareTypeDataCommand extends HyperfCommand
{
    public function __construct(
        protected ContainerInterface $container,
        protected StdoutLoggerInterface $logger
    ) {
        parent::__construct('share:migrate-share-type-data');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('迁移分享类型数据：将旧的分享类型系统迁移到新的分享类型系统');
        $this->addOption('dry-run', 'd', InputOption::VALUE_NONE, '仅显示将要执行的操作，不实际执行');
        $this->addOption('show-details', null, InputOption::VALUE_NONE, '显示详细的执行信息');
    }

    public function handle(): void
    {
        $dryRun = $this->input->getOption('dry-run');
        $verbose = $this->input->getOption('show-details');

        $this->showHeader($dryRun);

        $startTime = microtime(true);
        $this->info('开始时间：' . date('Y-m-d H:i:s'));
        $this->info('');

        try {
            $this->info('开始执行迁移规则...');
            $this->info('');

            // 规则1：迁移 share_type=4 + password不为空（密码保护）
            $this->migrateRule1($dryRun, $verbose);

            // 规则2：迁移 share_type=2（组织内可访问）
            $this->migrateRule2($dryRun, $verbose);

            // 规则3：软删除 share_type=1（仅自己可访问）
            $this->migrateRule3($dryRun, $verbose);

            // 规则4：迁移 share_type=4 + password为空（公开访问）
            $this->migrateRule4($dryRun, $verbose);

            // 规则5：迁移 resource_type=12（Project）→ resource_type=13（FileCollection）+ share_project=true
            $this->migrateRule5($dryRun, $verbose);

            // 规则6：同步 is_password_enabled 字段
            $this->migrateRule6($dryRun, $verbose);

            $endTime = microtime(true);
            $duration = round($endTime - $startTime, 2);

            $this->info('');
            $this->info('==========================================');
            if ($dryRun) {
                $this->info('预览完成（dry-run 模式，未实际执行任何操作）');
            } else {
                $this->info('迁移完成！');
            }
            $this->info('结束时间：' . date('Y-m-d H:i:s'));
            $this->info('总耗时：' . $duration . ' 秒');
        } catch (Throwable $e) {
            $endTime = microtime(true);
            $duration = round($endTime - $startTime, 2);

            $this->error('');
            $this->error('迁移失败：' . $e->getMessage());
            $this->error('失败时间：' . date('Y-m-d H:i:s'));
            $this->error('已耗时：' . $duration . ' 秒');
            $this->logger->error('迁移失败', [
                'exception' => $e,
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * 显示命令头部信息.
     */
    private function showHeader(bool $dryRun): void
    {
        $this->info('');
        $this->info('分享类型数据迁移工具');
        $this->info('==========================================');
        $this->info('说明：将旧的分享类型系统迁移到新的分享类型系统');
        $this->info('数据表：magic_resource_shares');
        $this->info('');
        if ($dryRun) {
            $this->warn('运行模式：预览模式（dry-run），不会实际修改数据');
        } else {
            $this->info('运行模式：执行模式，将实际修改数据');
        }
        $this->info('');
    }

    /**
     * 规则1：迁移 share_type=4 + password不为空（密码保护）
     * 说明：原来的 share_type=4（互联网可访问）且设置了密码的分享，
     *       需要迁移为 share_type=5（密码保护）类型
     * 操作：
     *   - share_type: 4 → 5
     *   - password: 保持不变（用户无需重新设置密码）
     *   - is_password_enabled: 设置为 true（启用密码保护）
     *   - share_range: 设置为 NULL（非团队分享类型）
     *   - target_ids: 清空为空数组（非团队分享不需要指定成员）.
     */
    private function migrateRule1(bool $dryRun, bool $verbose): void
    {
        $this->info('规则1：迁移 share_type=4 + password不为空（密码保护）');
        $this->info('说明：将原来的 share_type=4（互联网可访问）且设置了密码的分享，迁移为 share_type=5（密码保护）类型');

        $query = Db::table('magic_resource_shares')
            ->where('share_type', 4)
            ->whereNotNull('password')
            ->where('password', '!=', '')
            ->whereNull('deleted_at');

        $count = $query->count();

        if ($count === 0) {
            $this->line('   没有需要迁移的记录');
            $this->info('');
            return;
        }

        $this->info("   找到 {$count} 条需要迁移的记录");

        if ($verbose) {
            $records = $query->get(['id', 'share_code', 'share_type', 'password']);
            foreach ($records as $record) {
                $this->line("      - ID: {$record->id}, ShareCode: {$record->share_code}");
            }
        }

        if ($dryRun) {
            $this->line('   [预览] 将执行以下操作：');
            $this->line('      - share_type: 4 → 5');
            $this->line('      - is_password_enabled: false → true');
            $this->line('      - share_range: 设置为 NULL');
            $this->line('      - target_ids: 清空为空数组');
        } else {
            $affected = $query->update([
                'share_type' => 5,
                'share_range' => null,
                'is_password_enabled' => true,
                'target_ids' => json_encode([]),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            $this->info("   成功迁移 {$affected} 条记录");
        }

        $this->info('');
    }

    /**
     * 规则2：迁移 share_type=2（组织内可访问）
     * 说明：原来的 share_type=2（组织内可访问）需要迁移为新的团队分享类型
     *       并设置 share_range='all'（全团队成员）
     * 操作：
     *   - share_type: 2 → 2（保持不变）
     *   - share_range: 设置为 'all'（全团队成员）
     *   - password: 清空为 NULL（团队分享不支持密码保护）
     *   - is_password_enabled: 设置为 false（禁用密码保护）
     *   - target_ids: 清空为空数组（share_range='all' 时不需要指定成员）.
     */
    private function migrateRule2(bool $dryRun, bool $verbose): void
    {
        $this->info('规则2：迁移 share_type=2（组织内可访问）');
        $this->info('说明：将原来的 share_type=2（组织内可访问）迁移为新的团队分享类型，并设置 share_range=all（全团队成员）');

        $query = Db::table('magic_resource_shares')
            ->where('share_type', 2)
            ->whereNull('deleted_at');

        $count = $query->count();

        if ($count === 0) {
            $this->line('   没有需要迁移的记录');
            $this->info('');
            return;
        }

        $this->info("   找到 {$count} 条需要迁移的记录");

        if ($verbose) {
            $records = $query->get(['id', 'share_code', 'share_type', 'share_range']);
            foreach ($records as $record) {
                $this->line("      - ID: {$record->id}, ShareCode: {$record->share_code}, ShareRange: " . ($record->share_range ?? 'NULL'));
            }
        }

        if ($dryRun) {
            $this->line('   [预览] 将执行以下操作：');
            $this->line('      - share_type: 2 → 2（保持不变）');
            $this->line("      - share_range: 设置为 'all'（全团队成员）");
            $this->line('      - password: 清空为 NULL');
            $this->line('      - is_password_enabled: 设置为 false');
            $this->line('      - target_ids: 清空为空数组');
        } else {
            $affected = $query->update([
                'share_range' => 'all',
                'password' => null,
                'is_password_enabled' => false,
                'target_ids' => json_encode([]),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            $this->info("   成功迁移 {$affected} 条记录");
        }

        $this->info('');
    }

    /**
     * 规则3：软删除 share_type=1（仅自己可访问）
     * 说明：原来的 share_type=1（仅自己可访问）在新系统中已废弃，
     *       需要软删除这些分享记录
     * 操作：
     *   - deleted_at: 设置为当前时间戳（软删除）
     *   - updated_at: 更新为当前时间
     * 注意：软删除后，分享链接将失效，但历史统计数据会保留.
     */
    private function migrateRule3(bool $dryRun, bool $verbose): void
    {
        $this->info('规则3：软删除 share_type=1（仅自己可访问）');
        $this->info('说明：原来的 share_type=1（仅自己可访问）在新系统中已废弃，需要软删除这些分享记录');

        $query = Db::table('magic_resource_shares')
            ->where('share_type', 1)
            ->whereNull('deleted_at');

        $count = $query->count();

        if ($count === 0) {
            $this->line('   没有需要删除的记录');
            $this->info('');
            return;
        }

        $this->info("   找到 {$count} 条需要软删除的记录");

        if ($verbose) {
            $records = $query->get(['id', 'share_code', 'share_type']);
            foreach ($records as $record) {
                $this->line("      - ID: {$record->id}, ShareCode: {$record->share_code}");
            }
        }

        if ($dryRun) {
            $this->line('   [预览] 将执行以下操作：');
            $this->line('      - deleted_at: 设置为当前时间戳（软删除）');
            $this->warn('   注意：软删除后，分享链接将失效，但历史统计数据会保留');
        } else {
            $affected = $query->update([
                'deleted_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            $this->info("   成功软删除 {$affected} 条记录");
        }

        $this->info('');
    }

    /**
     * 规则4：迁移 share_type=4 + password为空（公开访问）
     * 说明：原来的 share_type=4（互联网可访问）且没有设置密码的分享，
     *       迁移为新的 share_type=4（公开访问）类型
     * 操作：
     *   - share_type: 4 → 4（保持不变）
     *   - share_range: 设置为 NULL（非团队分享类型）
     *   - password: 确保为 NULL（公开访问不需要密码）
     *   - is_password_enabled: 设置为 false（禁用密码保护）
     *   - target_ids: 清空为空数组（非团队分享不需要指定成员）.
     */
    private function migrateRule4(bool $dryRun, bool $verbose): void
    {
        $this->info('规则4：迁移 share_type=4 + password为空（公开访问）');
        $this->info('说明：将原来的 share_type=4（互联网可访问）且没有设置密码的分享，迁移为新的 share_type=4（公开访问）类型');

        $query = Db::table('magic_resource_shares')
            ->where('share_type', 4)
            ->where(function ($query) {
                $query->whereNull('password')
                    ->orWhere('password', '');
            })
            ->whereNull('deleted_at');

        $count = $query->count();

        if ($count === 0) {
            $this->line('   没有需要迁移的记录');
            $this->info('');
            return;
        }

        $this->info("   找到 {$count} 条需要迁移的记录");

        if ($verbose) {
            $records = $query->get(['id', 'share_code', 'share_type', 'password']);
            foreach ($records as $record) {
                $this->line("      - ID: {$record->id}, ShareCode: {$record->share_code}");
            }
        }

        if ($dryRun) {
            $this->line('   [预览] 将执行以下操作：');
            $this->line('      - share_type: 4 → 4（保持不变）');
            $this->line('      - share_range: 设置为 NULL');
            $this->line('      - password: 确保为 NULL');
            $this->line('      - is_password_enabled: 设置为 false');
            $this->line('      - target_ids: 清空为空数组');
        } else {
            $affected = $query->update([
                'share_range' => null,
                'password' => null,
                'is_password_enabled' => false,
                'target_ids' => json_encode([]),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            $this->info("   成功迁移 {$affected} 条记录");
        }

        $this->info('');
    }

    /**
     * 规则5：迁移 resource_type=12（Project）→ resource_type=13（FileCollection）+ share_project=true
     * 说明：原来的 resource_type=12（Project 项目）在新系统中已废弃，
     *       现在使用 resource_type=13（FileCollection 文件集）+ share_project=true 来表示项目分享
     * 操作：
     *   - resource_type: 12 → 13（FileCollection）
     *   - share_project: 设置为 true（标记为分享整个项目）
     *   - 其他字段保持不变（share_type、password、share_range 等）
     * 注意：
     *   - 此迁移确保所有旧的项目分享能在新系统中正常工作
     *   - share_project=true 会影响复制行为（复制整个项目而非单个文件）.
     */
    private function migrateRule5(bool $dryRun, bool $verbose): void
    {
        $this->info('规则5：迁移 resource_type=12（Project）→ resource_type=13（FileCollection）+ share_project=true');
        $this->info('说明：原来的 resource_type=12（Project 项目）在新系统中已废弃，现在使用 resource_type=13（FileCollection 文件集）+ share_project=true 来表示项目分享');

        $query = Db::table('magic_resource_shares')
            ->where('resource_type', 12)
            ->whereNull('deleted_at');

        $count = $query->count();

        if ($count === 0) {
            $this->line('   没有需要迁移的记录');
            $this->info('');
            return;
        }

        $this->info("   找到 {$count} 条需要迁移的记录");

        if ($verbose) {
            $records = $query->get(['id', 'share_code', 'resource_type', 'share_project']);
            foreach ($records as $record) {
                $this->line("      - ID: {$record->id}, ShareCode: {$record->share_code}, ShareProject: " . ($record->share_project ?? 'NULL'));
            }
        }

        if ($dryRun) {
            $this->line('   [预览] 将执行以下操作：');
            $this->line('      - resource_type: 12 → 13（FileCollection）');
            $this->line('      - share_project: 设置为 true（标记为分享整个项目）');
        } else {
            $affected = $query->update([
                'resource_type' => 13,
                'share_project' => true,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            $this->info("   成功迁移 {$affected} 条记录");
        }

        $this->info('');
    }

    /**
     * 规则6：同步 is_password_enabled 字段
     * 说明：确保所有记录的 is_password_enabled 字段与 share_type 和 password 保持一致
     *       处理可能存在的边缘情况（如迁移前已存在的异常数据）
     * 规则：
     *   - share_type=5 且 password不为空 → is_password_enabled=true
     *   - 其他情况 → is_password_enabled=false
     * 注意：此步骤只更新不一致的记录，避免不必要的更新操作.
     */
    private function migrateRule6(bool $dryRun, bool $verbose): void
    {
        $this->info('规则6：同步 is_password_enabled 字段');
        $this->info('说明：确保所有记录的 is_password_enabled 字段与 share_type 和 password 保持一致，处理可能存在的边缘情况');

        $query = Db::table('magic_resource_shares')
            ->whereNull('deleted_at')
            ->where(function ($query) {
                // share_type=5 但 is_password_enabled=false 的记录
                $query->where(function ($q) {
                    $q->where('share_type', 5)
                        ->whereNotNull('password')
                        ->where('password', '!=', '')
                        ->where('is_password_enabled', false);
                })
                // share_type!=5 但 is_password_enabled=true 的记录
                    ->orWhere(function ($q) {
                        $q->where('share_type', '!=', 5)
                            ->where('is_password_enabled', true);
                    });
            });

        $count = $query->count();

        if ($count === 0) {
            $this->line('   没有需要同步的记录');
            $this->info('');
            return;
        }

        $this->info("   找到 {$count} 条需要同步的记录");

        if ($verbose) {
            $records = $query->get(['id', 'share_code', 'share_type', 'is_password_enabled', 'password']);
            foreach ($records as $record) {
                $hasPassword = ! empty($record->password);
                $this->line("      - ID: {$record->id}, ShareCode: {$record->share_code}, ShareType: {$record->share_type}, IsPasswordEnabled: {$record->is_password_enabled}, HasPassword: " . ($hasPassword ? 'Yes' : 'No'));
            }
        }

        if ($dryRun) {
            $this->line('   [预览] 将执行以下操作：');
            $this->line('      - share_type=5 且 password不为空 → is_password_enabled=true');
            $this->line('      - 其他情况 → is_password_enabled=false');
        } else {
            $affected = Db::table('magic_resource_shares')
                ->whereNull('deleted_at')
                ->where(function ($query) {
                    $query->where(function ($q) {
                        $q->where('share_type', 5)
                            ->whereNotNull('password')
                            ->where('password', '!=', '')
                            ->where('is_password_enabled', false);
                    })
                        ->orWhere(function ($q) {
                            $q->where('share_type', '!=', 5)
                                ->where('is_password_enabled', true);
                        });
                })
                ->update([
                    'is_password_enabled' => Db::raw("CASE 
                        WHEN share_type = 5 AND password IS NOT NULL AND password != '' THEN 1 
                        ELSE 0 
                    END"),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);

            $this->info("   成功同步 {$affected} 条记录");
        }

        $this->info('');
    }
}
