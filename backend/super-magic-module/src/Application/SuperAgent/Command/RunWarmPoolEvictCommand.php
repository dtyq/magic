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
 * 手动触发 warm-pool 过期清理的命令行工具，方便调试。
 *
 * 用法:
 *   php bin/hyperf.php superagent:warm-pool-evict                       # 执行一次
 *   php bin/hyperf.php superagent:warm-pool-evict --limit=500           # 自定义批量大小
 *   php bin/hyperf.php superagent:warm-pool-evict --loop --times=10 --interval=5
 */
#[Command]
class RunWarmPoolEvictCommand extends HyperfCommand
{
    private const DEFAULT_LIMIT = 200;

    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('superagent:warm-pool-evict');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Manually trigger warm-pool eviction (same as WarmPoolEvictCrontab::execute)');
        $this->addOption('limit', null, InputOption::VALUE_OPTIONAL, 'Max rows to evict per tick', self::DEFAULT_LIMIT);
        $this->addOption('loop', 'l', InputOption::VALUE_NONE, 'Run in loop mode');
        $this->addOption('times', 't', InputOption::VALUE_OPTIONAL, 'Number of iterations in loop mode', 5);
        $this->addOption('interval', 'i', InputOption::VALUE_OPTIONAL, 'Seconds between iterations in loop mode', 5);
    }

    public function handle(): void
    {
        $appService = $this->container->get(WarmPoolSandboxAppService::class);

        $limit = max(1, (int) $this->input->getOption('limit'));
        $isLoop = $this->input->getOption('loop');
        $times = max(1, (int) $this->input->getOption('times'));
        $interval = max(1, (int) $this->input->getOption('interval'));

        // 打印当前配置
        $enabled = (bool) config('super-magic.warm_pool.enabled', false);
        $this->info('[Config] warm_pool.enabled=' . ($enabled ? 'true' : 'false')
            . ', limit=' . $limit);

        if (! $enabled) {
            $this->warn('warm_pool.enabled is false — set SUPER_MAGIC_WARM_POOL_ENABLED=true in .env');
            return;
        }

        if ($isLoop) {
            $this->info("Loop mode: {$times} iterations, interval {$interval}s");
            for ($i = 1; $i <= $times; ++$i) {
                $this->info("--- iteration {$i}/{$times} ---");
                $this->runOnce($appService, $limit);
                if ($i < $times) {
                    sleep($interval);
                }
            }
            $this->info('Loop finished.');
        } else {
            $this->runOnce($appService, $limit);
        }
    }

    private function runOnce(WarmPoolSandboxAppService $appService, int $limit): void
    {
        $start = microtime(true);
        try {
            $result = $appService->evictExpired($limit);
            $elapsedMs = round((microtime(true) - $start) * 1000, 2);

            $this->info("Evict done ({$elapsedMs} ms)");
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
