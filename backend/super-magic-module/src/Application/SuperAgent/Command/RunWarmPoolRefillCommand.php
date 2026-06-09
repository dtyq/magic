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
 * 手动触发 warm-pool refill 的命令行工具，方便调试。
 *
 * 用法:
 *   php bin/hyperf.php superagent:warm-pool-refill           # 执行一次
 *   php bin/hyperf.php superagent:warm-pool-refill --loop    # 循环执行
 *   php bin/hyperf.php superagent:warm-pool-refill --loop --times=20 --interval=3
 */
#[Command]
class RunWarmPoolRefillCommand extends HyperfCommand
{
    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('superagent:warm-pool-refill');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Manually trigger warm-pool refill (same as WarmPoolRefillCrontab::execute)');
        $this->addOption('loop', 'l', InputOption::VALUE_NONE, 'Run in loop mode');
        $this->addOption('times', 't', InputOption::VALUE_OPTIONAL, 'Number of iterations in loop mode', 5);
        $this->addOption('interval', 'i', InputOption::VALUE_OPTIONAL, 'Seconds between iterations in loop mode', 2);
    }

    public function handle(): void
    {
        $appService = $this->container->get(WarmPoolSandboxAppService::class);

        $isLoop = $this->input->getOption('loop');
        $times = max(1, (int) $this->input->getOption('times'));
        $interval = max(1, (int) $this->input->getOption('interval'));

        // 打印当前配置
        $enabled = (bool) config('super-magic.warm_pool.enabled', false);
        $targetSize = (int) config('super-magic.warm_pool.target_size', 10);
        $enableReadiness = (bool) config('super-magic.warm_pool.enable_readiness', true);
        $this->info('[Config] warm_pool.enabled=' . ($enabled ? 'true' : 'false')
            . ', target_size=' . $targetSize
            . ', enable_readiness=' . ($enableReadiness ? 'true' : 'false'));

        if (! $enabled) {
            $this->warn('warm_pool.enabled is false — set SUPER_MAGIC_WARM_POOL_ENABLED=true in .env');
            return;
        }
        if ($targetSize <= 0) {
            $this->warn('target_size <= 0, nothing to do');
            return;
        }

        if ($isLoop) {
            $this->info("Loop mode: {$times} iterations, interval {$interval}s");
            for ($i = 1; $i <= $times; ++$i) {
                $this->info("--- iteration {$i}/{$times} ---");
                $this->runOnce($appService, $targetSize);
                if ($i < $times) {
                    sleep($interval);
                }
            }
            $this->info('Loop finished.');
        } else {
            $this->runOnce($appService, $targetSize);
        }
    }

    private function runOnce(WarmPoolSandboxAppService $appService, int $targetSize): void
    {
        $start = microtime(true);
        try {
            $result = $appService->refill($targetSize);
            $elapsedMs = round((microtime(true) - $start) * 1000, 2);

            // 在控制台直接输出 refill 结果
            $this->info("Refill done ({$elapsedMs} ms)");
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
