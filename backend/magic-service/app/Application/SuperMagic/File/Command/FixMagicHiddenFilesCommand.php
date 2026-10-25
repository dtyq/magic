<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Command;

use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\DbConnection\Db;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * 修复 .magic 目录及其后代文件的隐藏状态.
 *
 * 背景：
 *   .magic 曾经被错误地标记为隐藏目录（is_hidden=1），其下的所有文件/子目录
 *   也被一并设置为隐藏。现已将 .magic 根目录修正为 is_hidden=0，但后代节点
 *   仍需递归修复。
 *
 * 流程：
 *   1. 查询 file_name='.magic' 且 updated_at 匹配标记时间的根目录（仅处理本次手动修复过的那批）
 *   2. 对每个 .magic 目录递归收集所有后代 file_id（BFS，最大深度 10）
 *   3. 批量将 is_hidden=1 的后代更新为 is_hidden=0，updated_at 写入统一标记时间
 *
 * 使用方法：
 *   php bin/hyperf.php super-magic:fix-magic-hidden-files --dry-run
 *   php bin/hyperf.php super-magic:fix-magic-hidden-files
 *   php bin/hyperf.php super-magic:fix-magic-hidden-files --updated-at='2026-07-13 19:48:42' --limit=10
 */
#[Command]
class FixMagicHiddenFilesCommand extends HyperfCommand
{
    private const TABLE = 'magic_super_agent_task_files';

    private const DEFAULT_UPDATED_AT = '2026-07-13 19:48:42';

    private const BATCH_SIZE = 1000;

    public function __construct(
        protected ContainerInterface $container,
        protected StdoutLoggerInterface $logger,
        protected TaskFileRepositoryInterface $taskFileRepository,
    ) {
        parent::__construct('super-magic:fix-magic-hidden-files');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('修复 .magic 目录及其后代文件的隐藏状态（is_hidden -> 0）');
        $this->addOption('updated-at', 'u', InputOption::VALUE_OPTIONAL, '标记时间：用于过滤 .magic 根目录及写入 updated_at', self::DEFAULT_UPDATED_AT);
        $this->addOption('limit', 'l', InputOption::VALUE_OPTIONAL, '处理的 .magic 根目录数量上限', '10');
        $this->addOption('max-depth', null, InputOption::VALUE_OPTIONAL, '递归最大深度，防止无限循环', '10');
        $this->addOption('dry-run', 'd', InputOption::VALUE_NONE, '预览模式：只统计不实际更新');
    }

    public function handle(): void
    {
        $updatedAt = (string) $this->input->getOption('updated-at');
        $limit = (int) $this->input->getOption('limit');
        $maxDepth = (int) $this->input->getOption('max-depth');
        $dryRun = (bool) $this->input->getOption('dry-run');

        $this->showHeader($updatedAt, $limit, $maxDepth, $dryRun);

        try {
            // Step 1: 查询 .magic 根目录
            $magicDirs = $this->findMagicRootDirs($updatedAt, $limit);

            if (empty($magicDirs)) {
                $this->warn(sprintf('未找到 file_name=".magic" 且 updated_at="%s" 的记录，结束。', $updatedAt));
                return;
            }

            $this->info(sprintf('找到 %d 个 .magic 根目录待处理', count($magicDirs)));

            // Step 2: 递归收集所有后代 file_id
            $allDescendantIds = [];
            $perDirStats = [];

            foreach ($magicDirs as $dir) {
                $dirId = (int) $dir['file_id'];
                $descendantIds = $this->taskFileRepository->getAllDescendantIds($dirId, 0, $maxDepth);
                $perDirStats[$dirId] = count($descendantIds);
                foreach ($descendantIds as $id) {
                    $allDescendantIds[$id] = $id;
                }
                $this->line(sprintf('  目录 file_id=%d -> %d 个后代', $dirId, count($descendantIds)));
            }

            $uniqueIds = array_values($allDescendantIds);
            $totalUnique = count($uniqueIds);
            $this->info(sprintf('汇总去重后共 %d 个后代文件/目录待检查', $totalUnique));

            if ($totalUnique === 0) {
                $this->info('没有后代需要处理，结束。');
                return;
            }

            // Step 3: 统计当前仍为隐藏的数量
            $hiddenCount = Db::table(self::TABLE)
                ->whereIn('file_id', $uniqueIds)
                ->where('is_hidden', 1)
                ->whereNull('deleted_at')
                ->count();

            $this->info(sprintf('其中当前 is_hidden=1 的有 %d 条', $hiddenCount));

            if ($hiddenCount === 0) {
                $this->info('所有后代已是非隐藏状态，无需更新，结束。');
                return;
            }

            if ($dryRun) {
                $this->warn(sprintf('[预览模式] 将把 %d 条记录的 is_hidden 更新为 0，updated_at 写入 "%s"', $hiddenCount, $updatedAt));
                return;
            }

            // Step 4: 分批更新
            $totalAffected = 0;
            $chunks = array_chunk($uniqueIds, self::BATCH_SIZE);

            foreach ($chunks as $chunk) {
                // Keep this maintenance write on the same repository path as
                // online mutations.  It publishes one precise update event
                // per changed node and commits the journal/head counters in
                // the same transaction as is_hidden.
                $affected = $this->taskFileRepository->batchUpdateIsHidden(
                    $chunk,
                    false,
                    $updatedAt
                );
                $totalAffected += $affected;
            }

            $this->info(sprintf('✅ 完成！共更新 %d 条记录（is_hidden: 1 -> 0, updated_at: %s）', $totalAffected, $updatedAt));
            $this->logger->info('FixMagicHiddenFilesCommand completed', [
                'magic_dirs' => count($magicDirs),
                'total_descendants' => $totalUnique,
                'hidden_before' => $hiddenCount,
                'updated' => $totalAffected,
                'updated_at' => $updatedAt,
                'per_dir' => json_encode($perDirStats, JSON_UNESCAPED_UNICODE),
            ]);

            // Step 5: 验证
            $remainingHidden = Db::table(self::TABLE)
                ->whereIn('file_id', $uniqueIds)
                ->where('is_hidden', 1)
                ->whereNull('deleted_at')
                ->count();

            if ($remainingHidden === 0) {
                $this->info('✅ 验证通过：没有剩余的 is_hidden=1 记录');
            } else {
                $this->warn(sprintf('⚠️ 验证失败：仍有 %d 条 is_hidden=1 记录', $remainingHidden));
            }
        } catch (Throwable $e) {
            $this->error(sprintf('❌ 执行失败：%s', $e->getMessage()));
            $this->logger->error('FixMagicHiddenFilesCommand failed', [
                'exception' => $e,
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * 显示命令头部信息.
     */
    private function showHeader(string $updatedAt, int $limit, int $maxDepth, bool $dryRun): void
    {
        $this->info('');
        $this->info('==========================================');
        $this->info('.magic 目录隐藏状态修复工具');
        $this->info('==========================================');
        $this->info(sprintf('标记时间 updated_at: %s', $updatedAt));
        $this->info(sprintf('根目录数量上限 limit: %d', $limit));
        $this->info(sprintf('递归最大深度 max-depth: %d', $maxDepth));
        $this->info(sprintf('数据表: %s', self::TABLE));
        if ($dryRun) {
            $this->warn('运行模式：预览模式（dry-run），不会实际修改数据');
        } else {
            $this->info('运行模式：执行模式，将实际修改数据');
            $this->warn('⚠️  执行前请确认已备份相关数据！');
        }
        $this->info('');
    }

    /**
     * 查询 .magic 根目录列表.
     *
     * @return array<int, array<string, mixed>>
     */
    private function findMagicRootDirs(string $updatedAt, int $limit): array
    {
        return Db::table(self::TABLE)
            ->where('file_name', '.magic')
            ->whereNull('deleted_at')
            ->where('updated_at', $updatedAt)
            ->limit($limit)
            ->get(['file_id', 'project_id', 'file_name'])
            ->map(static fn ($item) => (array) $item)
            ->toArray();
    }
}
