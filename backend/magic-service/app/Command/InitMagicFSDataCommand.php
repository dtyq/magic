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
        $this->setDescription('初始化 MagicFS 文件系统数据（元数据版本号）');
        $this->addOption('batch-size', 'b', InputOption::VALUE_OPTIONAL, '批处理大小', '1000');
    }

    public function handle()
    {
        try {
            $this->logger->info('========================================');
            $this->logger->info('MagicFS 文件系统数据初始化');
            $this->logger->info('========================================');

            return $this->initMetadataVersion();
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
            $this->logger->info('初始化元数据版本号');
            $this->logger->info('----------------------------------------');

            $batchSize = (int) $this->input->getOption('batch-size');

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

            $totalProcessed = 0;
            $batchCount = 0;

            while (true) {
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
}
