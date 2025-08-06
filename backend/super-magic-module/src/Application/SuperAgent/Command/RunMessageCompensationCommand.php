<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Command;

use Dtyq\SuperMagic\Application\SuperAgent\Crontab\MessageCompensationCrontab;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * Run Message Compensation Command
 * 手动运行消息补偿任务的命令.
 */
#[Command]
class RunMessageCompensationCommand extends HyperfCommand
{
    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('superagent:compensation');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Run message compensation task manually');
        $this->addOption('loop', 'l', InputOption::VALUE_NONE, 'Run in loop mode (every 5 seconds)');
        $this->addOption('times', 't', InputOption::VALUE_OPTIONAL, 'Number of times to run (only in loop mode)', 10);
    }

    public function handle(): void
    {
        $messageCompensationCrontab = $this->container->get(MessageCompensationCrontab::class);

        $isLoop = $this->input->getOption('loop');
        $times = (int) $this->input->getOption('times');

        if ($isLoop) {
            $this->info('开始循环运行消息补偿任务...');
            $this->info("将运行 {$times} 次，每次间隔 5 秒");

            for ($i = 1; $i <= $times; ++$i) {
                $this->info("--- 第 {$i} 次运行 ---");
                $startTime = microtime(true);

                try {
                    $messageCompensationCrontab->execute();
                    $executionTime = round((microtime(true) - $startTime) * 1000, 2);
                    $this->info("执行完成，耗时: {$executionTime}ms");
                } catch (Throwable $e) {
                    $this->error('执行失败: ' . $e->getMessage());
                }

                if ($i < $times) {
                    $this->info('等待 5 秒...');
                    sleep(5);
                }
            }

            $this->info('循环运行完成！');
        } else {
            $this->info('运行消息补偿任务...');
            $startTime = microtime(true);

            try {
                $messageCompensationCrontab->execute();
                $executionTime = round((microtime(true) - $startTime) * 1000, 2);
                $this->info("任务执行完成，耗时: {$executionTime}ms");
            } catch (Throwable $e) {
                $this->error('任务执行失败: ' . $e->getMessage());
            }
        }
    }
}
