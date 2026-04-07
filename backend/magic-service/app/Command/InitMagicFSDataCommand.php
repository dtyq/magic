<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\DbConnection\Db;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class InitMagicFSDataCommand extends HyperfCommand
{
    public function __construct(
        protected ContainerInterface $container,
        protected StdoutLoggerInterface $logger,
    ) {
        parent::__construct('init:magicfs-data');
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('初始化 MagicFS 文件系统数据（元数据版本号和闭包表索引）');
        $this->addOption('type', 't', InputOption::VALUE_OPTIONAL, '初始化类型：all(全部), metadata-version(元数据版本), tree-indexes(闭包表)', 'all');
        $this->addOption('force', 'f', InputOption::VALUE_NONE, '强制重新生成（会清空现有数据）');
        $this->addOption('batch-size', 'b', InputOption::VALUE_OPTIONAL, '批处理大小（用于 metadata-version）', '1000');
    }

    public function handle()
    {
        try {
            $type = $this->input->getOption('type');

            $this->logger->info('========================================');
            $this->logger->info('MagicFS 文件系统数据初始化');
            $this->logger->info('========================================');

            // 根据类型执行不同的初始化
            switch ($type) {
                case 'metadata-version':
                    return $this->initMetadataVersion();
                case 'tree-indexes':
                    return $this->initTreeIndexes();
                case 'all':
                    // 先初始化元数据版本，再初始化闭包表
                    $result1 = $this->initMetadataVersion();
                    if ($result1 !== 0) {
                        return $result1;
                    }
                    $this->logger->info('');
                    return $this->initTreeIndexes();
                default:
                    $this->logger->error("未知的类型: {$type}");
                    $this->logger->info('可用类型: all, metadata-version, tree-indexes');
                    return 1;
            }
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'MagicFS 数据初始化失败: %s, file:%s line:%s',
                $e->getMessage(),
                $e->getFile(),
                $e->getLine()
            ));
            return 1;
        }
    }

    /**
     * 初始化元数据版本号.
     */
    protected function initMetadataVersion(): int
    {
        try {
            $this->logger->info('');
            $this->logger->info('【1/2】初始化元数据版本号');
            $this->logger->info('----------------------------------------');

            $batchSize = (int) $this->input->getOption('batch-size');

            // 检查是否有需要更新的数据
            $needUpdateCount = Db::table('magic_super_agent_task_files')
                ->where('metadata_version', 1)
                ->where('latest_version', '>', 1)
                ->whereNull('deleted_at')
                ->count();

            if ($needUpdateCount === 0) {
                $this->logger->info('✓ 所有文件的 metadata_version 已正确初始化，无需更新');
                return 0;
            }

            $this->logger->info("发现 {$needUpdateCount} 条记录需要更新");
            $this->logger->info("批处理大小: {$batchSize}");

            // 批量更新
            $totalProcessed = 0;
            $batchCount = 0;

            while (true) {
                // 每次更新一批记录
                $affectedRows = Db::update(
                    'UPDATE magic_super_agent_task_files 
                     SET metadata_version = latest_version 
                     WHERE metadata_version = 1 
                     AND latest_version > 1
                     AND deleted_at IS NULL
                     LIMIT ?',
                    [$batchSize]
                );

                if ($affectedRows === 0) {
                    break;
                }

                $totalProcessed += $affectedRows;
                ++$batchCount;

                $this->logger->info("  批次 {$batchCount}：更新了 {$affectedRows} 条记录（累计: {$totalProcessed}）");

                // 短暂休眠，避免占用太多数据库资源
                usleep(100000); // 100ms
            }

            $this->logger->info("✅ 元数据版本号初始化完成！共更新 {$totalProcessed} 条记录");
            return 0;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '初始化元数据版本号失败: %s, file:%s line:%s',
                $e->getMessage(),
                $e->getFile(),
                $e->getLine()
            ));
            return 1;
        }
    }

    /**
     * 初始化文件树闭包表索引.
     */
    protected function initTreeIndexes(): int
    {
        try {
            $this->logger->info('');
            $this->logger->info('【2/2】初始化文件树闭包表索引');
            $this->logger->info('----------------------------------------');

            $force = $this->input->getOption('force');

            // 检查闭包表是否已有数据
            $count = Db::table('magic_super_agent_file_tree_indexes')->count();
            if ($count > 0 && ! $force) {
                $this->logger->warning("闭包表已有 {$count} 条数据");
                $this->logger->warning('如需重新生成，请使用 --force 选项');
                return 0;
            }

            if ($force && $count > 0) {
                $this->logger->warning("强制模式：即将清空现有的 {$count} 条数据");
                Db::table('magic_super_agent_file_tree_indexes')->truncate();
                $this->logger->info('✓ 已清空闭包表数据');
            }

            // 步骤1：插入每个节点到自己的记录（distance = 0）
            $this->insertSelfReferences();

            // 步骤2：插入直接父子关系（distance = 1）
            $this->insertDirectParentChild();

            // 步骤3：迭代插入更远的祖先关系
            $this->insertAncestorRelations();

            // 统计结果
            $totalCount = Db::table('magic_super_agent_file_tree_indexes')->count();
            $this->logger->info("✅ 闭包表索引生成完成！总计 {$totalCount} 条记录");

            // 验证数据正确性
            $this->validateData();

            return 0;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '初始化文件树索引失败: %s, file:%s line:%s',
                $e->getMessage(),
                $e->getFile(),
                $e->getLine()
            ));
            return 1;
        }
    }

    /**
     * 步骤1：插入每个节点到自己的记录（distance = 0）.
     */
    protected function insertSelfReferences(): void
    {
        $this->logger->info('步骤1：插入节点自身记录...');

        $sql = '
            INSERT INTO magic_super_agent_file_tree_indexes 
                (ancestor_id, descendant_id, distance, organization_code, created_at, updated_at)
            SELECT 
                file_id, file_id, 0, organization_code, NOW(), NOW()
            FROM magic_super_agent_task_files
            WHERE deleted_at IS NULL
        ';

        $affected = Db::affectingStatement($sql);
        $this->logger->info("✓ 插入了 {$affected} 条节点自身记录");
    }

    /**
     * 步骤2：插入直接父子关系（distance = 1）.
     */
    protected function insertDirectParentChild(): void
    {
        $this->logger->info('步骤2：插入直接父子关系...');

        $sql = '
            INSERT INTO magic_super_agent_file_tree_indexes 
                (ancestor_id, descendant_id, distance, organization_code, created_at, updated_at)
            SELECT 
                f.parent_id, f.file_id, 1, f.organization_code, NOW(), NOW()
            FROM magic_super_agent_task_files f
            WHERE f.deleted_at IS NULL 
                AND f.parent_id IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM magic_super_agent_file_tree_indexes i
                    WHERE i.ancestor_id = f.parent_id 
                        AND i.descendant_id = f.file_id
                )
        ';

        $affected = Db::affectingStatement($sql);
        $this->logger->info("✓ 插入了 {$affected} 条直接父子关系记录");
    }

    /**
     * 步骤3：迭代插入更远的祖先关系.
     */
    protected function insertAncestorRelations(): void
    {
        $this->logger->info('步骤3：迭代插入更远的祖先关系...');

        $iteration = 1;
        $maxIterations = 100; // 防止死循环
        $totalInserted = 0;

        while ($iteration <= $maxIterations) {
            $sql = '
                INSERT INTO magic_super_agent_file_tree_indexes 
                    (ancestor_id, descendant_id, distance, organization_code, created_at, updated_at)
                SELECT 
                    i1.ancestor_id, 
                    i2.descendant_id, 
                    i1.distance + i2.distance, 
                    i1.organization_code,
                    NOW(), 
                    NOW()
                FROM magic_super_agent_file_tree_indexes i1
                JOIN magic_super_agent_file_tree_indexes i2 
                    ON i1.descendant_id = i2.ancestor_id 
                    AND i1.organization_code = i2.organization_code
                WHERE i2.distance = 1
                    AND NOT EXISTS (
                        SELECT 1 FROM magic_super_agent_file_tree_indexes i3
                        WHERE i3.ancestor_id = i1.ancestor_id 
                            AND i3.descendant_id = i2.descendant_id
                            AND i3.organization_code = i1.organization_code
                    )
            ';

            $affectedRows = Db::affectingStatement($sql);
            $totalInserted += $affectedRows;

            if ($affectedRows > 0) {
                $this->logger->info("  迭代 {$iteration}：插入了 {$affectedRows} 条记录");
            }

            // 如果没有新记录插入，说明已完成
            if ($affectedRows === 0) {
                $this->logger->info("✓ 完成 {$iteration} 次迭代，共插入 {$totalInserted} 条祖先关系记录");
                break;
            }

            ++$iteration;
        }

        if ($iteration > $maxIterations) {
            $this->logger->warning("⚠️  达到最大迭代次数 {$maxIterations}，可能存在循环引用");
        }
    }

    /**
     * 验证数据正确性.
     */
    protected function validateData(): void
    {
        $this->logger->info('验证数据正确性...');

        // 验证1：检查每个节点都有到自己的记录
        $missingSelf = Db::select('
            SELECT COUNT(*) as count
            FROM magic_super_agent_task_files f
            WHERE f.deleted_at IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM magic_super_agent_file_tree_indexes i
                    WHERE i.ancestor_id = f.file_id 
                        AND i.descendant_id = f.file_id 
                        AND i.distance = 0
                )
        ');

        $missingSelfCount = $missingSelf[0]['count'] ?? 0;
        if ($missingSelfCount > 0) {
            $this->logger->error("⚠️  发现 {$missingSelfCount} 个节点缺少自身记录");
        } else {
            $this->logger->info('✓ 所有节点都有自身记录');
        }

        // 验证2：检查有父节点的文件都有到父节点的记录
        $missingParent = Db::select('
            SELECT COUNT(*) as count
            FROM magic_super_agent_task_files f
            WHERE f.deleted_at IS NULL 
                AND f.parent_id IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM magic_super_agent_file_tree_indexes i
                    WHERE i.ancestor_id = f.parent_id 
                        AND i.descendant_id = f.file_id 
                        AND i.distance = 1
                )
        ');

        $missingParentCount = $missingParent[0]['count'] ?? 0;
        if ($missingParentCount > 0) {
            $this->logger->error("⚠️  发现 {$missingParentCount} 个节点缺少父节点记录");
        } else {
            $this->logger->info('✓ 所有节点都有正确的父子关系');
        }

        // 验证3：查看各距离的记录分布
        $distribution = Db::select('
            SELECT 
                distance,
                COUNT(*) as count
            FROM magic_super_agent_file_tree_indexes
            GROUP BY distance
            ORDER BY distance
        ');

        $this->logger->info('距离分布统计：');
        foreach ($distribution as $row) {
            $distance = is_array($row) ? $row['distance'] : $row->distance;
            $count = is_array($row) ? $row['count'] : $row->count;
            $this->logger->info("  距离 {$distance}: {$count} 条记录");
        }

        if ($missingSelfCount === 0 && $missingParentCount === 0) {
            $this->logger->info('✅ 数据验证通过');
        } else {
            $this->logger->warning('⚠️  数据验证发现问题，请检查');
        }
    }
}
