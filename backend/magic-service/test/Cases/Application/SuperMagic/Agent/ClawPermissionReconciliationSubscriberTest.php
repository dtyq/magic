<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Agent;

use App\Application\SuperMagic\Agent\Event\Subscribe\ClawFunctionPermissionChangedListener;
use App\Application\SuperMagic\Agent\Event\Subscribe\ClawPermissionReconciliationSubscriber;
use App\Application\SuperMagic\Agent\Service\MagicClawReconciliationAppService;
use App\Domain\Contact\Event\DepartmentMembershipChanged;
use App\Domain\Permission\Event\FunctionPermissionChanged;
use App\Domain\SuperMagic\Agent\Event\ClawPermissionReconciliationRequestedEvent;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\AsyncEvent\Kernel\Driver\CoroutineListenerAsyncDriver;
use Dtyq\AsyncEvent\Kernel\Executor\AsyncListenerExecutor;
use Dtyq\AsyncEvent\Kernel\Persistence\Model\AsyncEventModel;
use Hyperf\Engine\Channel;
use Hyperf\Engine\Coroutine;
use HyperfTest\Support\MagicClawTestEnvironment;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;
use ReflectionClass;
use Throwable;

/** @internal */
final class ClawPermissionReconciliationSubscriberTest extends TestCase
{
    use MagicClawTestEnvironment;

    public function testDeferredDriverRunsAfterOriginEndsAndContinuesOnlyDueBatches(): void
    {
        foreach ([ClawPermissionReconciliationSubscriber::class] as $class) {
            $annotation = (new ReflectionClass($class))->getAttributes(AsyncListener::class)[0]->newInstance();
            self::assertSame('coroutine', $annotation->driver);
            self::assertTrue($annotation->waitForSync);
        }
        $service = $this->createMock(MagicClawReconciliationAppService::class);
        $service->expects(self::exactly(2))->method('executeForOrganization')->with('org')->willReturnOnConsecutiveCalls(true, false);
        $subscriber = new ClawPermissionReconciliationSubscriber($service);
        $executor = $this->createMock(AsyncListenerExecutor::class);
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $container = $this->prepareClawEnvironment([AsyncListenerExecutor::class => $executor, EventDispatcherInterface::class => $dispatcher]);
        $driver = new CoroutineListenerAsyncDriver($container);
        $done = new Channel(1);
        $originEnded = false;
        $calls = 0;
        $executor->expects(self::once())->method('run')->willReturnCallback(function ($record, $event, $listener, string $driverName) use (&$calls, &$originEnded, $done): void {
            self::assertTrue($originEnded);
            self::assertSame('coroutine', $driverName);
            $listener($event);
            ++$calls;
            $done->push(true);
        });
        $dispatcher->method('dispatch')->willReturnCallback(static function (object $event): object {
            self::assertNotInstanceOf(ClawPermissionReconciliationRequestedEvent::class, $event);
            return $event;
        });
        Coroutine::create(static function () use ($driver, $subscriber, &$originEnded, &$calls, $done): void {
            try {
                $driver->publish(new AsyncEventModel(), new ClawPermissionReconciliationRequestedEvent('org'), [$subscriber, 'process']);
            } catch (Throwable $exception) {
                $done->push($exception->getMessage());
            }
            self::assertSame(0, $calls);
            // In production the request's transaction ends before the coroutine's deferred callbacks.
            $originEnded = true;
        });
        $result = $done->pop(5);
        self::assertTrue($result, 'originEnded=' . (int) $originEnded . '; calls=' . $calls . '; result=' . var_export($result, true));
        self::assertSame(1, $calls);
        $done->close();
    }

    public function testUnrelatedFunctionChangesDoNotCreateClawWork(): void
    {
        $service = $this->createMock(MagicClawReconciliationAppService::class);
        $service->expects(self::never())->method('requestReconciliation');
        $service->expects(self::never())->method('executeForOrganization');
        $listener = new ClawFunctionPermissionChangedListener($service);
        $listener->process(new FunctionPermissionChanged('org', 'admin', ['skill.create', 'magic_claw.create']));
        $listener->process(new FunctionPermissionChanged('org', 'admin', []));
    }

    public function testGlobalAndAccessChangesRecordWorkButDoNotScanInTheRequest(): void
    {
        $service = $this->createMock(MagicClawReconciliationAppService::class);
        $service->expects(self::exactly(2))->method('requestReconciliation')->with('org', 'policy_changed', true, true, 'admin');
        $service->expects(self::never())->method('executeForOrganization');
        $listener = new ClawFunctionPermissionChangedListener($service);
        $listener->process(new FunctionPermissionChanged('org', 'admin', null));
        $listener->process(new FunctionPermissionChanged('org', 'admin', ['magic_claw.access', 'skill.create']));
    }

    public function testMembershipEventPreparesOnceWithoutPublishingNestedNotifications(): void
    {
        $service = $this->createMock(MagicClawReconciliationAppService::class);
        $service->expects(self::once())->method('requestReconciliation')->with('org', 'membership_changed', true, false);
        $service->expects(self::once())->method('executeForOrganization')->with('org')->willReturn(false);
        (new ClawPermissionReconciliationSubscriber($service))->process(new DepartmentMembershipChanged('org'));
    }

    public function testBusyOrFutureWorkDoesNotScheduleAnImmediateRetry(): void
    {
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->method('dispatch')->willReturnCallback(static function (object $event): object {
            self::assertNotInstanceOf(ClawPermissionReconciliationRequestedEvent::class, $event);
            return $event;
        });
        $this->prepareClawEnvironment([EventDispatcherInterface::class => $dispatcher]);
        $service = $this->createMock(MagicClawReconciliationAppService::class);
        $service->expects(self::once())->method('executeForOrganization')->willReturn(false);
        (new ClawPermissionReconciliationSubscriber($service))->process(new ClawPermissionReconciliationRequestedEvent('org'));
    }
}
