<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Command;

use Dtyq\SuperMagic\Application\SuperAgent\Service\WarmPoolSandboxAppService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * 清理 warm-pool 中所有沙箱的命令行工具。
 *
 * 用法:
 *   php bin/hyperf.php superagent:warm-pool-drain           # 清理所有池中沙箱
 *   php bin/hyperf.php superagent:warm-pool-drain --force   # 跳过确认直接执行
 */
#[Command]
class RunWarmPoolDrainCommand extends HyperfCommand
{
    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('superagent:warm-pool-drain');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Drain (destroy) all warm-pool sandboxes');
        $this->addOption('force', 'f', InputOption::VALUE_NONE, 'Skip confirmation prompt');
    }

    public function handle(): void
    {
        $appService = $this->container->get(WarmPoolSandboxAppService::class);

        $isForce = $this->input->getOption('force');

        if (! $isForce) {
            $this->warn('This will destroy ALL sandboxes in the warm pool (creating / ready / dead).');
            $this->warn('Claimed sandboxes (active user sessions) will NOT be affected.');
            $confirm = $this->ask('Type "yes" to confirm');
            if ($confirm !== 'yes') {
                $this->info('Aborted.');
                return;
            }
        }

        $this->info('Draining warm-pool sandboxes...');

        $start = microtime(true);
        try {
            $result = $appService->drainAll();
            $elapsedMs = round((microtime(true) - $start) * 1000, 2);

            $this->info("Drain done ({$elapsedMs} ms)");
            $rows = [];
            foreach ($result as $k => $v) {
                $rows[] = [$k, is_array($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : (string) $v];
            }
            $this->table(['Key', 'Value'], $rows);
        } catch (Throwable $e) {
            $elapsedMs = round((microtime(true) - $start) * 1000, 2);
            $this->error("Failed ({$elapsedMs} ms): " . $e->getMessage());
            $this->line($e->getTraceAsString());
        }
    }
}
