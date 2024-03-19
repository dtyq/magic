<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * 数据迁移命令：将项目分享的表示方式统一为 resource_type=12，并补充所有记录的 extra 默认值
 *
 * 背景：
 * - 之前项目分享使用 resource_type=13 + share_project=true 表示
 * - 现在统一使用 resource_type=12 (Project) 表示
 *
 * 迁移规则：
 * 1. resource_type=13 + share_project=true → resource_type=12
 * 2. 所有类型的分享记录，如果 extra 为空，补充默认值
 */
#[Command]
class MigrateProjectShareResourceTypeCommand extends HyperfCommand
{
    // ResourceType 常量
    private const int RESOURCE_TYPE_PROJECT = 12;

    private const int RESOURCE_TYPE_FILE_COLLECTION = 13;

    private LoggerInterface $logger;

    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('migrate:project-share-resource-type');
        $this->logger = $container->get(LoggerFactory::class)->get('MigrateProjectShareResourceTypeCommand');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('迁移项目分享类型并补充所有记录的 extra 默认值');
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, '预览模式，不实际更新数据');
        $this->addOption('show-progress', null, InputOption::VALUE_NONE, '显示迁移进度');
    }

    public function handle(): int
    {
        $dryRun = $this->input->getOption('dry-run');
        $showProgress = $this->input->getOption('show-progress');

        $this->info('开始数据迁移...');
        $this->info('');

        if ($dryRun) {
            $this->warn('⚠️  预览模式：将显示要执行的操作，但不会实际修改数据');
            $this->info('');
        }

        try {
            // 显示统计信息
            $this->showStatistics();

            // 步骤1：迁移项目分享类型
            $projectTypeAffected = $this->migrateProjectShareResourceType($dryRun, $showProgress);

            // 步骤2：补充所有记录的 extra 默认值
            $extraAffected = $this->fillExtraDefaultValues($dryRun, $showProgress);

            $this->info('');
            $this->info('========== 迁移完成 ==========');
            $this->info("项目类型迁移: {$projectTypeAffected} 条");
            $this->info("Extra 补充: {$extraAffected} 条");
            $this->info('总计: ' . ($projectTypeAffected + $extraAffected) . ' 条');

            $this->logger->info('迁移完成', [
                'project_type_affected' => $projectTypeAffected,
                'extra_affected' => $extraAffected,
                'total' => $projectTypeAffected + $extraAffected,
                'dry_run' => $dryRun,
            ]);

            return 0;
        } catch (Throwable $e) {
            $this->error('迁移失败: ' . $e->getMessage());
            $this->logger->error('迁移失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return 1;
        }
    }

    /**
     * 显示统计信息.
     */
    private function showStatistics(): void
    {
        $this->line('========== 数据统计 ==========');

        try {
            // 统计需要迁移类型的记录数
            $needMigrateType = Db::table('magic_resource_shares')
                ->where('resource_type', self::RESOURCE_TYPE_FILE_COLLECTION)
                ->where('share_project', true)
                ->count();

            // 统计需要补充 extra 的记录数（所有类型）
            $needFillExtra = Db::table('magic_resource_shares')
                ->where(function ($query) {
                    $query->whereNull('extra')
                        ->orWhere('extra', '')
                        ->orWhere('extra', '[]')
                        ->orWhere('extra', '{}');
                })
                ->count();

            $this->line("需要迁移类型的记录数: {$needMigrateType} 条");
            $this->line("需要补充 extra 的记录数: {$needFillExtra} 条");
            $this->line('');
            $this->line('迁移规则:');
            $this->line('  1. resource_type=13 + share_project=true → resource_type=12');
            $this->line('  2. 所有类型如果 extra 为空，补充默认值');
            $this->line('================================');
            $this->line('');
        } catch (Throwable $e) {
            $this->warn('获取统计信息失败: ' . $e->getMessage());
        }
    }

    /**
     * 迁移项目分享的 resource_type（只处理类型转换，不处理 extra）.
     */
    private function migrateProjectShareResourceType(bool $dryRun, bool $showProgress): int
    {
        $this->line('');
        $this->line('========== 步骤1：迁移项目分享类型 ==========');

        // 查询需要迁移的记录
        $query = Db::table('magic_resource_shares')
            ->where('resource_type', self::RESOURCE_TYPE_FILE_COLLECTION)
            ->where('share_project', true);

        $count = $query->count();

        if ($count === 0) {
            $this->line('没有需要迁移类型的记录');
            return 0;
        }

        $this->line("找到 {$count} 条需要迁移类型的记录");

        if ($dryRun) {
            $this->line('预览模式，显示前 10 条记录：');
            $records = $query->limit(10)->get(['id', 'resource_id', 'resource_type', 'share_project', 'project_id']);
            foreach ($records as $record) {
                $recordArray = (array) $record;
                $this->line("  ✓ ID: {$recordArray['id']}, resource_id: {$recordArray['resource_id']}, resource_type: 13 → 12, project_id: {$recordArray['project_id']}");
            }
            return $count;
        }

        // 执行迁移（只更新 resource_type）
        if ($showProgress) {
            $this->line('执行类型迁移...');
        }

        $affected = Db::table('magic_resource_shares')
            ->where('resource_type', self::RESOURCE_TYPE_FILE_COLLECTION)
            ->where('share_project', true)
            ->update([
                'resource_type' => self::RESOURCE_TYPE_PROJECT,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

        $this->logger->info('项目类型迁移完成', [
            'affected' => $affected,
        ]);

        $this->info("✓ 成功迁移 {$affected} 条记录的类型");

        return $affected;
    }

    /**
     * 补充所有记录的 extra 默认值（所有类型，只要 extra 为空）.
     */
    private function fillExtraDefaultValues(bool $dryRun, bool $showProgress): int
    {
        $this->line('');
        $this->line('========== 步骤2：补充 Extra 默认值 ==========');

        // 查询所有 extra 为空的记录（所有类型）
        $query = Db::table('magic_resource_shares')
            ->where(function ($query) {
                $query->whereNull('extra')
                    ->orWhere('extra', '')
                    ->orWhere('extra', '[]')
                    ->orWhere('extra', '{}');
            });

        $count = $query->count();

        if ($count === 0) {
            $this->line('没有需要补充 extra 的记录');
            return 0;
        }

        $this->line("找到 {$count} 条需要补充 extra 的记录");

        if ($dryRun) {
            $this->line('预览模式，显示前 10 条记录：');
            $records = $query->limit(10)->get(['id', 'resource_id', 'resource_type', 'extra']);
            foreach ($records as $record) {
                $recordArray = (array) $record;
                $resourceType = $recordArray['resource_type'] ?? 'unknown';
                $this->line("  ✓ ID: {$recordArray['id']}, resource_id: {$recordArray['resource_id']}, resource_type: {$resourceType}, extra: [将补充默认值]");
            }
            return $count;
        }

        // 执行补充 extra 默认值
        if ($showProgress) {
            $this->line('执行 extra 补充...');
        }

        $affected = 0;
        $records = Db::table('magic_resource_shares')
            ->where(function ($query) {
                $query->whereNull('extra')
                    ->orWhere('extra', '')
                    ->orWhere('extra', '[]')
                    ->orWhere('extra', '{}');
            })
            ->get(['id']);

        $defaultExtra = json_encode([
            'allow_copy_project_files' => true,
            'view_file_list' => true,
            'hide_created_by_super_magic' => false,
            'show_original_info' => true,
            'allow_download_project_file' => true,
        ], JSON_UNESCAPED_UNICODE);

        foreach ($records as $record) {
            $recordArray = (array) $record;

            Db::table('magic_resource_shares')
                ->where('id', $recordArray['id'])
                ->update([
                    'extra' => $defaultExtra,
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);

            ++$affected;

            if ($showProgress && $affected % 100 === 0) {
                $this->line("已处理 {$affected}/{$count} 条记录");
            }
        }

        $this->logger->info('Extra 默认值补充完成', [
            'affected' => $affected,
        ]);

        $this->info("✓ 成功补充 {$affected} 条记录的 extra 默认值");

        return $affected;
    }
}
