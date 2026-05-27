<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Command;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WarmPoolSandboxEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WarmPoolSandboxDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * 手动从 warm-pool 中获取（claim）一台 ready 沙箱，便于调试闭环测试。
 *
 * 用法:
 *   php bin/hyperf.php superagent:warm-pool-acquire
 *   php bin/hyperf.php superagent:warm-pool-acquire --release          # 声领后立刻回滚为 ready
 *   php bin/hyperf.php superagent:warm-pool-acquire --times=3 --release
 *   php bin/hyperf.php superagent:warm-pool-acquire --user-id=u1 --project-id=p1
 */
#[Command]
class RunWarmPoolAcquireCommand extends HyperfCommand
{
    public function __construct(protected ContainerInterface $container)
    {
        parent::__construct('superagent:warm-pool-acquire');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Manually claim one ready sandbox from the warm pool (debug / closed-loop test)');
        $this->addOption('user-id', 'u', InputOption::VALUE_OPTIONAL, 'user_id stamped on the claim', 'cli-test-user');
        $this->addOption('project-id', 'p', InputOption::VALUE_OPTIONAL, 'project_id stamped on the claim', 'cli-test-project');
        $this->addOption('image', null, InputOption::VALUE_OPTIONAL, 'agent_image to claim against (default: gateway latest)');
        $this->addOption('times', 't', InputOption::VALUE_OPTIONAL, 'How many sandboxes to acquire in this run', 1);
        $this->addOption('release', 'r', InputOption::VALUE_NONE, 'Release the claim back to ready after acquiring (avoid draining pool)');
    }

    public function handle(): void
    {
        $domain = $this->container->get(WarmPoolSandboxDomainService::class);
        $gateway = $this->container->get(SandboxGatewayInterface::class);

        $userId = (string) $this->input->getOption('user-id');
        $projectId = (string) $this->input->getOption('project-id');
        $times = max(1, (int) $this->input->getOption('times'));
        $release = (bool) $this->input->getOption('release');
        $image = (string) ($this->input->getOption('image') ?? '');

        if ($image === '') {
            $image = $gateway->getLatestAgentImage();
        }
        if ($image === '') {
            $this->error('Unable to resolve agent image (gateway returned empty and no --image given)');
            return;
        }

        $available = $domain->countAvailableForImage($image);
        $this->info("[Config] image={$image}, available_ready={$available}, request={$times}, release=" . ($release ? 'true' : 'false'));

        $acquired = 0;
        $released = 0;
        $missed = 0;
        $rows = [];

        for ($i = 1; $i <= $times; ++$i) {
            $start = microtime(true);
            try {
                $entity = $domain->claimOneReady($image, $userId, $projectId);
            } catch (Throwable $e) {
                $this->error("claimOneReady #{$i} threw: " . $e->getMessage());
                continue;
            }
            $elapsedMs = round((microtime(true) - $start) * 1000, 2);

            if ($entity === null) {
                ++$missed;
                $this->warn("#{$i} no ready sandbox available ({$elapsedMs} ms)");
                continue;
            }

            ++$acquired;
            $rows[] = $this->describe($entity, $elapsedMs);

            if ($release && $entity->getId() !== null) {
                $ok = $domain->releaseClaim($entity->getId());
                if ($ok) {
                    ++$released;
                }
                $this->line("  → release id={$entity->getId()} " . ($ok ? 'ok' : 'noop'));
            }
        }

        if (! empty($rows)) {
            $this->table(['#', 'id', 'sandbox_id', 'sandbox_name', 'agent_image', 'elapsed_ms'], $rows);
        }

        $remaining = $domain->countAvailableForImage($image);
        $this->info("[Result] acquired={$acquired}, released={$released}, missed={$missed}, available_ready_after={$remaining}");

        if ($acquired > 0 && ! $release) {
            $this->warn('Claimed rows were NOT released — they now belong to user_id=' . $userId . ', project_id=' . $projectId);
            $this->warn('Use --release next time, or run superagent:warm-pool-refill to top up.');
        }
    }

    /**
     * @return array<int,string>
     */
    private function describe(WarmPoolSandboxEntity $entity, float $elapsedMs): array
    {
        static $idx = 0;
        ++$idx;
        return [
            (string) $idx,
            (string) ($entity->getId() ?? ''),
            $entity->getSandboxId(),
            (string) ($entity->getSandboxName() ?? ''),
            (string) ($entity->getAgentImage() ?? ''),
            (string) $elapsedMs,
        ];
    }
}
