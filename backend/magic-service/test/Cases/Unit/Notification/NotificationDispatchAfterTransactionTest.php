<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Notification;

use App\Application\Notification\Event\NotificationEventConsumeListener;
use App\Application\Notification\Event\NotificationEventConsumeRequested;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\AsyncEvent\Kernel\Driver\CoroutineListenerAsyncDriver;
use Dtyq\AsyncEvent\Kernel\Executor\AsyncListenerExecutor;
use Dtyq\AsyncEvent\Kernel\Persistence\Model\AsyncEventModel;
use Hyperf\Engine\Coroutine;
use PDO;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;

/** @internal */
final class NotificationDispatchAfterTransactionTest extends TestCase
{
    public function testConsumerRunsOnlyAfterThePublishingTransactionCommits(): void
    {
        if (! extension_loaded('swow') && ! extension_loaded('swoole')) {
            self::markTestSkipped('A coroutine engine is required');
        }
        $policy = (new ReflectionClass(NotificationEventConsumeListener::class))->getAttributes(AsyncListener::class)[0]->newInstance();
        self::assertSame('coroutine', $policy->driver);
        self::assertTrue($policy->waitForSync);
        $db = new PDO('sqlite::memory:');
        $db->exec('CREATE TABLE committed_events (id TEXT)');
        $executed = false;
        $executor = $this->createMock(AsyncListenerExecutor::class);
        $executor->expects(self::once())->method('run')->willReturnCallback(
            function ($model, $event, $listener, $driver) use ($db, &$executed): void {
                self::assertFalse($db->inTransaction());
                self::assertSame('coroutine', $driver);
                self::assertSame('event-1', $db->query('SELECT id FROM committed_events')->fetchColumn());
                $listener($event);
                $executed = true;
            }
        );
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->with(AsyncListenerExecutor::class)->willReturn($executor);
        $driver = new CoroutineListenerAsyncDriver($container);
        $model = $this->getMockBuilder(AsyncEventModel::class)->disableOriginalConstructor()->getMock();
        $coroutine = Coroutine::create(function () use ($db, $driver, $model, &$executed): void {
            $db->beginTransaction();
            $db->exec("INSERT INTO committed_events VALUES ('event-1')");
            $driver->publish($model, new NotificationEventConsumeRequested('event-1'), static function ($event): void {
                self::assertSame('event-1', $event->eventId);
            });
            self::assertFalse($executed);
            $db->commit();
        });
        unset($coroutine);
        self::assertTrue($executed);
    }
}
