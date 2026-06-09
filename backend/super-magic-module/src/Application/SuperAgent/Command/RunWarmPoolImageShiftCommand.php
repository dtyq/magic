<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Command;

use Dtyq\SuperMagic\Application\SuperAgent\Service\WarmPoolSandboxAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\SandboxImageChangedEvent;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * 手动触发 warm-pool agent 镜像漂移检测的命令行工具，方便调试。
 *
 * 用法:
 *   php bin/hyperf.php superagent:warm-pool-image-shift             # 执行一次
 *   php bin/hyperf.php superagent:warm-pool-image-shift --loop      # 循环执行
 *   php bin/hyperf.php superagent:warm-pool-image-shift --loop --times=10 --interval=2
 */
#[Command]
class RunWarmPoolImageShiftCommand extends HyperfCommand
{
    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('superagent:warm-pool-image-shift');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Manually trigger warm-pool image-shift detection (same as WarmPoolImageShiftCrontab::execute)');
        $this->addOption('loop', 'l', InputOption::VALUE_NONE, 'Run in loop mode');
        $this->addOption('times', 't', InputOption::VALUE_OPTIONAL, 'Number of iterations in loop mode', 5);
        $this->addOption('interval', 'i', InputOption::VALUE_OPTIONAL, 'Seconds between iterations in loop mode', 2);
    }

    public function handle(): void
    {
        $appService = $this->container->get(WarmPoolSandboxAppService::class);
        $eventDispatcher = $this->container->get(EventDispatcherInterface::class);

        $isLoop = $this->input->getOption('loop');
        $times = max(1, (int) $this->input->getOption('times'));
        $interval = max(1, (int) $this->input->getOption('interval'));

        // 打印当前配置
        $enabled = (bool) config('super-magic.warm_pool.enabled', false);
        $this->info('[Config] warm_pool.enabled=' . ($enabled ? 'true' : 'false'));

        if (! $enabled) {
            $this->warn('warm_pool.enabled is false — set SUPER_MAGIC_WARM_POOL_ENABLED=true in .env');
            return;
        }

        if ($isLoop) {
            $this->info("Loop mode: {$times} iterations, interval {$interval}s");
            for ($i = 1; $i <= $times; ++$i) {
                $this->info("--- iteration {$i}/{$times} ---");
                $this->runOnce($appService, $eventDispatcher);
                if ($i < $times) {
                    sleep($interval);
                }
            }
            $this->info('Loop finished.');
        } else {
            $this->runOnce($appService, $eventDispatcher);
        }
    }

    private function runOnce(
        WarmPoolSandboxAppService $appService,
        EventDispatcherInterface $eventDispatcher
    ): void {
        $start = microtime(true);
        try {
            $shift = $appService->detectImageGenerationShift();
            if ($shift === null) {
                $elapsedMs = round((microtime(true) - $start) * 1000, 2);
                $this->info("No image shift detected ({$elapsedMs} ms)");
                return;
            }

            $currentAgent = (string) $shift['current_agent_image'];
            $currentAgfs = (string) $shift['current_agfs_image'];
            if ($currentAgent === '' || $currentAgfs === '') {
                $this->warn('Detected shift but failed to read latest image(s); skip dispatch/invalidate.');
                return;
            }

            $this->info(sprintf(
                '[ImageShift] agent: %s -> %s | agfs: %s -> %s',
                (string) ($shift['previous_agent_image'] ?? ''),
                $currentAgent,
                (string) ($shift['previous_agfs_image'] ?? ''),
                $currentAgfs
            ));

            try {
                $eventDispatcher->dispatch(new SandboxImageChangedEvent(
                    (string) ($shift['previous_agent_image'] ?? ''),
                    $currentAgent,
                    (string) ($shift['previous_agfs_image'] ?? ''),
                    $currentAgfs
                ));
                $this->info('Event SandboxImageChangedEvent dispatched.');
            } catch (Throwable $e) {
                $this->error('Failed to dispatch event: ' . $e->getMessage());
            }

            $result = $appService->invalidateStaleImageGeneration($currentAgent, $currentAgfs);
            $elapsedMs = round((microtime(true) - $start) * 1000, 2);
            $this->info("Invalidate done ({$elapsedMs} ms)");
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
