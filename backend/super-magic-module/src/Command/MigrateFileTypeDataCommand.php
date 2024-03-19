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
 * 分享模块文件类型数据迁移命令：统一使用多文件类型(type=13).
 *
 * 背景说明：
 * 1. 产品层面已经不区分单文件和多文件了，用户可以自由选择任意数量的文件
 * 2. 但后端还保留着 type=15（单文件）和 type=13（多文件）两种类型
 * 3. 多文件适配器本身就支持 1 个文件，所以可以统一使用 type=13
 *
 * 迁移目标：
 * - 彻底废弃 type=15（单文件类型）
 * - 统一使用 type=13（多文件类型）
 * - 简化代码逻辑，降低维护成本
 *
 * 迁移规则：
 * - 将 resource_type=15 改为 resource_type=13
 *
 * 使用方法：
 *   php bin/hyperf.php share:migrate-file-type-data
 *   php bin/hyperf.php share:migrate-file-type-data --dry-run
 *   php bin/hyperf.php share:migrate-file-type-data --show-details
 */
#[Command]
class MigrateFileTypeDataCommand extends HyperfCommand
{
    public function __construct(
        protected ContainerInterface $container,
        protected StdoutLoggerInterface $logger
    ) {
        parent::__construct('share:migrate-file-type-data');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('迁移文件类型数据：将 type=15（单文件）统一迁移为 type=13（多文件）');
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
            // 显示当前数据分布
            $this->showDataDistribution();

            $this->info('开始执行迁移...');
            $this->info('');

            // 迁移 type=15 → type=13
            $this->migrateFileType($dryRun, $verbose);

            // 显示迁移后的数据分布
            if (! $dryRun) {
                $this->info('');
                $this->showDataDistribution();
            }

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
        $this->info('文件类型数据迁移工具');
        $this->info('==========================================');
        $this->info('说明：将 type=15（单文件）统一迁移为 type=13（多文件）');
        $this->info('数据表：magic_resource_shares');
        $this->info('');
        if ($dryRun) {
            $this->warn('运行模式：预览模式（dry-run），不会实际修改数据');
        } else {
            $this->info('运行模式：执行模式，将实际修改数据');
            $this->warn('⚠️  重要提示：执行前请务必备份数据库！');
        }
        $this->info('');
    }

    /**
     * 显示当前数据分布.
     */
    private function showDataDistribution(): void
    {
        $this->info('当前数据分布：');

        // 按 resource_type 统计
        $typeDistribution = Db::table('magic_resource_shares')
            ->select('resource_type', Db::raw('COUNT(*) as count'))
            ->whereNull('deleted_at')
            ->groupBy('resource_type')
            ->orderBy('resource_type')
            ->get();

        $this->info('  按 resource_type 统计：');
        foreach ($typeDistribution as $row) {
            $typeName = $this->getResourceTypeName($row->resource_type);
            $this->line(sprintf('    - type=%d (%s): %d 条', $row->resource_type, $typeName, $row->count));
        }

        // 统计 type=15 的数量
        $type15Count = Db::table('magic_resource_shares')
            ->where('resource_type', 15)
            ->whereNull('deleted_at')
            ->count();

        if ($type15Count > 0) {
            $this->warn(sprintf('  ⚠️  发现 %d 条 type=15（单文件）记录，需要迁移', $type15Count));
        }

        $this->info('');
    }

    /**
     * 获取 resource_type 的名称.
     */
    private function getResourceTypeName(int $type): string
    {
        return match ($type) {
            5 => '话题',
            12 => '项目',
            13 => '多文件',
            15 => '单文件',
            default => '未知',
        };
    }

    /**
     * 迁移 type=15 → type=13
     * 说明：将所有 type=15（单文件）迁移为 type=13（多文件）
     * 操作：
     *   - resource_type: 15 → 13
     *   - 其他字段保持不变
     * 原因：
     *   - 产品层面已经不区分单文件和多文件了
     *   - 多文件适配器本身就支持 1 个文件
     *   - 统一使用 type=13 可以简化代码逻辑.
     */
    private function migrateFileType(bool $dryRun, bool $verbose): void
    {
        $this->info('迁移 type=15 → type=13');
        $this->info('说明：将所有 type=15（单文件）迁移为 type=13（多文件），统一文件分享类型');

        $query = Db::table('magic_resource_shares')
            ->where('resource_type', 15)
            ->whereNull('deleted_at');

        $count = $query->count();

        if ($count === 0) {
            $this->line('   没有需要迁移的记录');
            $this->info('');
            return;
        }

        $this->info("   找到 {$count} 条需要迁移的记录");

        if ($verbose) {
            // 统计文件数量分布
            $fileCountDistribution = Db::table('magic_resource_shares')
                ->select(Db::raw('JSON_LENGTH(extra->\'$.file_ids\') as file_count'), Db::raw('COUNT(*) as count'))
                ->where('resource_type', 15)
                ->whereNull('deleted_at')
                ->groupBy('file_count')
                ->orderBy('file_count')
                ->get();

            $this->line('      文件数量分布：');
            foreach ($fileCountDistribution as $row) {
                $fileCount = $row->file_count ?? 0;
                $this->line(sprintf('        - %d 个文件: %d 条记录', $fileCount, $row->count));
            }

            // 显示前 10 条记录
            $records = $query->limit(10)->get(['id', 'resource_id', 'share_code']);
            $this->line('      前 10 条记录：');
            foreach ($records as $record) {
                $this->line(sprintf(
                    '        - ID: %d, ResourceID: %d, ShareCode: %s',
                    $record->id,
                    $record->resource_id,
                    $record->share_code
                ));
            }
            if ($count > 10) {
                $this->line(sprintf('        ... 还有 %d 条记录', $count - 10));
            }
        }

        if ($dryRun) {
            $this->line('   [预览] 将执行以下操作：');
            $this->line('      - resource_type: 15 → 13');
            $this->line('      - 其他字段保持不变');
            $this->line('');
            $this->line('   预期结果：');
            $this->line('      - 所有单文件分享将变为多文件分享');
            $this->line('      - 多文件适配器支持 1 个文件，功能不受影响');
            $this->line('      - 前端可以统一使用 type=13');
        } else {
            $affected = $query->update([
                'resource_type' => 13,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

            $this->info("   成功迁移 {$affected} 条记录");

            // 验证迁移结果
            $remainingType15 = Db::table('magic_resource_shares')
                ->where('resource_type', 15)
                ->whereNull('deleted_at')
                ->count();

            if ($remainingType15 === 0) {
                $this->info('   ✅ 验证通过：没有剩余的 type=15 记录');
            } else {
                $this->warn("   ⚠️  验证失败：还有 {$remainingType15} 条 type=15 记录");
            }
        }

        $this->info('');
    }
}
