<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Logger\LoggerFactory;
use Monolog\Handler\NullHandler;
use Monolog\Logger as MonologLogger;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class InitializeMagicFSFileTreeHeadsCommand extends HyperfCommand
{
    protected ?string $name = 'magicfs:initialize-file-tree-heads';

    public function __construct(
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly LoggerFactory $loggerFactory,
    ) {
        parent::__construct();
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Initialize durable MagicFS file-tree heads');
        $this->addOption(
            'batch-size',
            'b',
            InputOption::VALUE_REQUIRED,
            'Root file trees processed per batch (1-10000)',
            '1000'
        );
        $this->addOption(
            'keep-sql-log',
            null,
            InputOption::VALUE_NONE,
            'Keep the SQL audit log (every statement is written to stdout at info level)'
        );
    }

    public function handle(): int
    {
        $batchSize = filter_var(
            $this->input->getOption('batch-size'),
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1, 'max_range' => 10000]]
        );
        if ($batchSize === false) {
            $this->error('--batch-size must be an integer between 1 and 10000.');
            return self::FAILURE;
        }

        // 回填会为每棵文件树各发一条 SELECT/INSERT，SQL 审计日志会淹没命令输出，
        // 所以默认静音，跑完（含报错退出）立即还原。
        $restoreSqlLog = $this->input->getOption('keep-sql-log') ? null : $this->muteSqlLog();

        try {
            $result = $this->taskFileRepository->initializeFileTreeHeads($batchSize);
        } catch (Throwable $throwable) {
            $this->error(sprintf(
                'MagicFS file-tree head initialization failed: %s',
                $throwable->getMessage()
            ));
            return self::FAILURE;
        } finally {
            if ($restoreSqlLog !== null) {
                $restoreSqlLog();
            }
        }

        $this->info(sprintf(
            'Discovered %d file trees; initialized %d file-tree heads.',
            $result['discovered_file_trees'],
            $result['initialized_file_trees']
        ));

        return self::SUCCESS;
    }

    /**
     * 静音 SQL 审计日志：App\Listener\DbQueryExecutedListener 每条 SQL 都会以 info 级别
     * 打到 stdout（sql 通道没有单独配置，落到 default 的 handler）。LoggerFactory 在容器里
     * 是同一个实例，所以换掉 handler 就能掐掉监听器持有的那个 logger。
     *
     * @return callable(): void 还原原 handler
     */
    private function muteSqlLog(): callable
    {
        $logger = $this->loggerFactory->get('sql');
        if (! $logger instanceof MonologLogger) {
            return static function (): void {
            };
        }

        $handlers = $logger->getHandlers();
        $logger->setHandlers([new NullHandler()]);
        $this->info('SQL audit log is muted for this run; pass --keep-sql-log to keep it.');

        return static function () use ($logger, $handlers): void {
            $logger->setHandlers($handlers);
        };
    }
}
