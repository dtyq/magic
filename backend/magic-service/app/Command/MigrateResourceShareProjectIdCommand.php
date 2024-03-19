<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use Dtyq\SuperMagic\Domain\Share\Repository\Model\ResourceShareModel;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TopicModel;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class MigrateResourceShareProjectIdCommand extends HyperfCommand
{
    private const int BATCH_SIZE = 100;

    // ResourceType 常量
    private const int RESOURCE_TYPE_TOPIC = 5;

    private const int RESOURCE_TYPE_PROJECT = 12;

    private LoggerInterface $logger;

    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('migrate:resource-share-project-id');
        $this->logger = $container->get(LoggerFactory::class)->get('MigrateResourceShareProjectIdCommand');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('清洗 magic_resource_shares 表的 project_id 字段');
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, '预览模式，不实际更新数据');
        $this->addOption('limit', 'l', InputOption::VALUE_OPTIONAL, '限制处理的记录数量', 0);
    }

    public function handle(): int
    {
        $dryRun = $this->input->getOption('dry-run');
        $limit = (int) $this->input->getOption('limit');

        $this->line('开始清洗 magic_resource_shares 表的 project_id 字段...');
        $this->line('模式: ' . ($dryRun ? '预览模式（不会实际更新数据）' : '执行模式'));

        if ($limit > 0) {
            $this->line("限制处理记录数: {$limit}");
        }

        // 先统计需要处理的记录数
        $this->showStatistics();

        // 如果不是预览模式，需要用户确认
        if (! $dryRun && ! $this->confirm('确认要执行数据清洗吗？', false)) {
            $this->warn('已取消');
            return 0;
        }

        $startTime = microtime(true);

        try {
            // 处理项目类型
            $projectCount = $this->migrateProjectType($dryRun, $limit);
            $this->info("项目类型处理完成，共处理 {$projectCount} 条记录");

            // 处理话题类型
            $topicCount = $this->migrateTopicType($dryRun, $limit);
            $this->info("话题类型处理完成，共处理 {$topicCount} 条记录");

            $total = $projectCount + $topicCount;
            $duration = round(microtime(true) - $startTime, 2);

            $this->info("清洗完成，共处理 {$total} 条记录，耗时 {$duration} 秒");

            $this->logger->info('清洗 magic_resource_shares 表完成', [
                'project_count' => $projectCount,
                'topic_count' => $topicCount,
                'total' => $total,
                'duration' => $duration,
                'dry_run' => $dryRun,
            ]);

            return 0;
        } catch (Throwable $e) {
            $this->error('清洗失败: ' . $e->getMessage());
            $this->logger->error('清洗 magic_resource_shares 表失败', [
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
        $this->line('');
        $this->line('========== 数据统计 ==========');

        try {
            // 统计项目类型
            $projectTotal = ResourceShareModel::query()
                ->where('resource_type', self::RESOURCE_TYPE_PROJECT)
                ->count();

            $projectNeedMigrate = ResourceShareModel::query()
                ->where('resource_type', self::RESOURCE_TYPE_PROJECT)
                ->where(function ($query) {
                    $query->whereNull('project_id')
                        ->orWhere('project_id', 0);
                })
                ->count();

            $this->line("项目类型记录: 总计 {$projectTotal} 条，需要处理 {$projectNeedMigrate} 条");

            // 统计话题类型
            $topicTotal = ResourceShareModel::query()
                ->where('resource_type', self::RESOURCE_TYPE_TOPIC)
                ->count();

            $topicNeedMigrate = ResourceShareModel::query()
                ->where('resource_type', self::RESOURCE_TYPE_TOPIC)
                ->where(function ($query) {
                    $query->whereNull('project_id')
                        ->orWhere('project_id', 0);
                })
                ->count();

            $this->line("话题类型记录: 总计 {$topicTotal} 条，需要处理 {$topicNeedMigrate} 条");

            $totalNeedMigrate = $projectNeedMigrate + $topicNeedMigrate;
            $this->line("总计需要处理: {$totalNeedMigrate} 条记录");

            $this->line('================================');
            $this->line('');
        } catch (Throwable $e) {
            $this->warn('获取统计信息失败: ' . $e->getMessage());
        }
    }

    /**
     * 处理项目类型的记录
     * 项目类型：resource_id 就是 project_id.
     */
    private function migrateProjectType(bool $dryRun, int $limit): int
    {
        $this->line('开始处理项目类型记录...');

        // 查询需要更新的记录
        // 条件：resource_type = 12 且 (project_id IS NULL 或 project_id = 0)
        $query = ResourceShareModel::query()
            ->where('resource_type', self::RESOURCE_TYPE_PROJECT)
            ->where(function ($query) {
                $query->whereNull('project_id')
                    ->orWhere('project_id', 0);
            });

        if ($limit > 0) {
            $query->limit($limit);
        }

        $records = $query->get(['id', 'resource_id']);
        $count = $records->count();

        if ($count === 0) {
            $this->line('没有需要处理的项目类型记录');
            return 0;
        }

        $this->line("找到 {$count} 条需要处理的项目类型记录");

        if ($dryRun) {
            $this->line('预览模式，显示前 10 条记录：');
            $validCount = 0;
            $invalidCount = 0;
            foreach ($records->take(10) as $record) {
                $resourceId = $record->resource_id;
                if (is_numeric($resourceId)) {
                    $this->line("  ✓ ID: {$record->id}, resource_id: {$resourceId} => project_id: {$resourceId}");
                    ++$validCount;
                } else {
                    $this->warn("  ✗ ID: {$record->id}, resource_id: {$resourceId} (无效，将跳过)");
                    ++$invalidCount;
                }
            }
            $this->line("预览: {$validCount} 条有效，{$invalidCount} 条无效");
            return $count;
        }

        // 分批更新
        $processed = 0;
        $skipped = 0;
        foreach ($records->chunk(self::BATCH_SIZE) as $chunk) {
            Db::transaction(function () use ($chunk, &$processed, &$skipped) {
                foreach ($chunk as $record) {
                    // 验证 resource_id 是否是有效的数字
                    $resourceId = $record->resource_id;

                    // 如果 resource_id 不是纯数字，跳过
                    if (! is_numeric($resourceId)) {
                        $this->logger->warning('resource_id 不是有效的数字，跳过', [
                            'share_id' => $record->id,
                            'resource_id' => $resourceId,
                        ]);
                        ++$skipped;
                        continue;
                    }

                    ResourceShareModel::query()
                        ->where('id', $record->id)
                        ->update([
                            'project_id' => (int) $resourceId,
                            'updated_at' => date('Y-m-d H:i:s'),
                        ]);
                    ++$processed;
                }
            });

            $this->line("已处理 {$processed}/{$count} 条记录，跳过 {$skipped} 条");
        }

        $this->logger->info('项目类型记录处理完成', [
            'processed' => $processed,
            'skipped' => $skipped,
        ]);

        if ($skipped > 0) {
            $this->warn("跳过了 {$skipped} 条记录（resource_id 不是有效的数字）");
        }

        return $processed;
    }

    /**
     * 处理话题类型的记录
     * 话题类型：需要从 magic_super_agent_topics 表查询 project_id.
     */
    private function migrateTopicType(bool $dryRun, int $limit): int
    {
        $this->line('开始处理话题类型记录...');

        // 查询需要更新的记录
        // 条件：resource_type = 5 且 (project_id IS NULL 或 project_id = 0)
        $query = ResourceShareModel::query()
            ->where('resource_type', self::RESOURCE_TYPE_TOPIC)
            ->where(function ($query) {
                $query->whereNull('project_id')
                    ->orWhere('project_id', 0);
            });

        if ($limit > 0) {
            $query->limit($limit);
        }

        $records = $query->get(['id', 'resource_id']);
        $count = $records->count();

        if ($count === 0) {
            $this->line('没有需要处理的话题类型记录');
            return 0;
        }

        $this->line("找到 {$count} 条需要处理的话题类型记录");

        // 批量查询话题的 project_id
        $topicIds = $records->pluck('resource_id')->toArray();
        $topics = TopicModel::query()
            ->whereIn('id', $topicIds)
            ->get(['id', 'project_id'])
            ->keyBy('id');

        if ($dryRun) {
            $this->line('预览模式，显示前 10 条记录：');
            foreach ($records->take(10) as $record) {
                $topicId = (int) $record->resource_id;
                $projectId = $topics->get($topicId)->project_id ?? 0;
                $status = $topics->has($topicId) ? '✓' : '✗ (话题不存在)';
                $this->line("  ID: {$record->id}, topic_id: {$topicId} => project_id: {$projectId} {$status}");
            }
            return $count;
        }

        // 分批更新
        $processed = 0;
        $skipped = 0;
        foreach ($records->chunk(self::BATCH_SIZE) as $chunk) {
            Db::transaction(function () use ($chunk, $topics, &$processed, &$skipped) {
                foreach ($chunk as $record) {
                    try {
                        $topicId = (int) $record->resource_id;
                        $topic = $topics->get($topicId);

                        if (! $topic) {
                            $this->logger->warning('话题不存在，跳过', [
                                'share_id' => $record->id,
                                'topic_id' => $topicId,
                            ]);
                            ++$skipped;
                            continue;
                        }

                        $projectId = $topic->project_id ?? 0;
                        if ($projectId === 0) {
                            $this->logger->warning('话题的 project_id 为 0，跳过', [
                                'share_id' => $record->id,
                                'topic_id' => $topicId,
                            ]);
                            ++$skipped;
                            continue;
                        }

                        ResourceShareModel::query()
                            ->where('id', $record->id)
                            ->update([
                                'project_id' => $projectId,
                                'updated_at' => date('Y-m-d H:i:s'),
                            ]);
                        ++$processed;
                    } catch (Throwable $e) {
                        $this->logger->error('更新记录失败', [
                            'share_id' => $record->id,
                            'resource_id' => $record->resource_id,
                            'error' => $e->getMessage(),
                        ]);
                        ++$skipped;
                    }
                }
            });

            $this->line("已处理 {$processed}/{$count} 条记录，跳过 {$skipped} 条");
        }

        $this->logger->info('话题类型记录处理完成', [
            'processed' => $processed,
            'skipped' => $skipped,
        ]);

        if ($skipped > 0) {
            $this->warn("跳过了 {$skipped} 条记录（话题不存在或 project_id 为 0）");
        }

        return $processed;
    }
}
