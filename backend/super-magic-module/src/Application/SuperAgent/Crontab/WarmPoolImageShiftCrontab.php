<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Crontab;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WarmPoolSandboxAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\SandboxAgentImageChangedEvent;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Warm-pool image-shift detection crontab.
 *
 * Runs every second to detect agent image rollouts as fast as possible.
 * When a shift is detected, dispatches {@see SandboxAgentImageChangedEvent}
 * and best-effort invalidates stale entries directly (idempotent with the
 * event subscriber path).
 *
 * Disabled by default; enable via `super-magic.warm_pool.enabled = true`.
 */
#[Crontab(
    rule: '* * * * * *',
    name: 'WarmPoolImageShiftCrontab',
    callback: 'execute',
    memo: '每秒检测 warm-pool agent 镜像漂移',
)]
readonly class WarmPoolImageShiftCrontab
{
    private const LOCK_KEY = 'warm_pool_image_shift_crontab_lock';

    private const LOCK_EXPIRE = 60;

    protected LoggerInterface $logger;

    public function __construct(
        private WarmPoolSandboxAppService $warmPoolSandboxAppService,
        private SandboxGatewayInterface $gateway,
        private EventDispatcherInterface $eventDispatcher,
        private LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function execute(): void
    {
        if (! (bool) config('super-magic.warm_pool.enabled', false)) {
            return;
        }

        $owner = IdGenerator::getUniqueId32();
        if (! $this->locker->mutexLock(self::LOCK_KEY, $owner, self::LOCK_EXPIRE)) {
            return;
        }

        $start = microtime(true);
        try {
            $previousImage = $this->warmPoolSandboxAppService->detectImageGenerationShift();
            if ($previousImage === null) {
                return;
            }

            $latest = $this->safeLatestImage();
            if ($latest === '') {
                return;
            }

            $this->logger->info('[WarmPoolImageShift] agent image shifted', [
                'previous' => $previousImage,
                'current' => $latest,
            ]);

            try {
                $this->eventDispatcher->dispatch(new SandboxAgentImageChangedEvent($previousImage, $latest));
            } catch (Throwable $e) {
                $this->logger->error('[WarmPoolImageShift] failed to dispatch image change event', [
                    'error' => $e->getMessage(),
                ]);
            }

            // Best-effort direct invalidation (idempotent with subscriber).
            $this->warmPoolSandboxAppService->invalidateStaleImageGeneration($latest);

            $elapsedMs = round((microtime(true) - $start) * 1000, 2);
            $this->logger->info('[WarmPoolImageShift] tick done', ['elapsed_ms' => $elapsedMs]);
        } catch (Throwable $e) {
            $this->logger->error('[WarmPoolImageShift] tick failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release(self::LOCK_KEY, $owner);
        }
    }

    private function safeLatestImage(): string
    {
        try {
            return (string) $this->gateway->getLatestAgentImage();
        } catch (Throwable $e) {
            $this->logger->warning('[WarmPoolImageShift] failed to read latest agent image', [
                'error' => $e->getMessage(),
            ]);
            return '';
        }
    }
}
