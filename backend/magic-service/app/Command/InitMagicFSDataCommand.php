<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Contract\StdoutLoggerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class InitMagicFSDataCommand extends HyperfCommand
{
    public function __construct(
        protected StdoutLoggerInterface $logger,
        protected TaskFileRepositoryInterface $taskFileRepository,
    ) {
        parent::__construct('init:magicfs-data');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('初始化 MagicFS 元数据版本');
        $this->addOption('batch-size', 'b', InputOption::VALUE_OPTIONAL, '批处理大小', '1000');
    }

    public function handle(): int
    {
        $batchSize = filter_var(
            $this->input->getOption('batch-size'),
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1, 'max_range' => 10000]]
        );
        if ($batchSize === false) {
            $this->logger->error('--batch-size 必须是 1 到 10000 之间的整数');
            return self::FAILURE;
        }

        try {
            $this->logger->info('========================================');
            $this->logger->info('MagicFS 元数据版本初始化');
            $this->logger->info('========================================');

            $this->backfillMetadataVersions($batchSize);

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'MagicFS 元数据版本初始化失败: %s, file:%s line:%s',
                $e->getMessage(),
                $e->getFile(),
                $e->getLine()
            ));
            return self::FAILURE;
        }
    }

    private function backfillMetadataVersions(int $batchSize): void
    {
        $this->logger->info('');
        $this->logger->info('回填元数据版本号');
        $this->logger->info('----------------------------------------');

        // The repository keeps each file update, head revision and journal
        // snapshot in the same transaction. The separate
        // magicfs:initialize-file-tree-heads command must be run once before
        // backfilling existing installations.
        $totalProcessed = $this->taskFileRepository->backfillMagicFSMetadataVersions($batchSize);
        if ($totalProcessed === 0) {
            $this->logger->info('✓ 所有文件的 metadata_version 已正确初始化，无需更新');
            return;
        }

        $this->logger->info("✅ 元数据版本号回填完成！共更新 {$totalProcessed} 条记录");
    }
}
