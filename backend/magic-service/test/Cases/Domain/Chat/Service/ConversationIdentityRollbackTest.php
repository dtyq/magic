<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Chat\Service;

use App\Domain\Chat\Service\MagicConversationDomainService;
use Hyperf\Context\ApplicationContext;
use Hyperf\Database\ConnectionInterface;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\MySqlConnection;
use Hyperf\DbConnection\Connection as PooledConnection;
use Hyperf\DbConnection\Db;
use PDO;
use PDOException;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use RuntimeException;
use Throwable;

/** @internal */
final class ConversationIdentityRollbackTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        }
    }

    public function testAutoAbortedDeadlockResetsRawCounterAndNextAttemptStartsPhysicalTransaction(): void
    {
        $pdo = $this->createMock(PDO::class);
        $pdo->expects(self::exactly(2))->method('beginTransaction')->willReturn(true);
        $pdo->expects(self::once())->method('inTransaction')->willReturn(false);
        $pdo->expects(self::never())->method('rollBack');
        $pdo->expects(self::never())->method('exec');
        $connection = new MySqlConnection($pdo, 'unit_test');
        $connection->beginTransaction();
        self::assertSame(1, $connection->transactionLevel());
        $this->rollback($connection, $this->deadlock());
        self::assertSame(0, $connection->transactionLevel());
        $connection->beginTransaction();
        self::assertSame(1, $connection->transactionLevel());
    }

    public function testAutoAbortedDeadlockReconnectsPooledWrapperWithoutSecondRollback(): void
    {
        $pdo = $this->createMock(PDO::class);
        $pdo->expects(self::once())->method('inTransaction')->willReturn(false);
        $connection = $this->getMockBuilder(PooledConnection::class)->disableOriginalConstructor()
            ->onlyMethods(['rollBack', 'reconnect'])->addMethods(['getPdo'])->getMock();
        $connection->method('getPdo')->willReturn($pdo);
        $connection->expects(self::never())->method('rollBack');
        $connection->expects(self::once())->method('reconnect')->willReturn(true);
        $this->rollback($connection, $this->deadlock());
    }

    public function testUnrecognizedRollbackFailurePropagatesWithoutResetOrReconnect(): void
    {
        $rollbackError = new RuntimeException('rollback outcome unavailable');
        $connection = $this->createMock(PooledConnection::class);
        $connection->expects(self::once())->method('rollBack')->willThrowException($rollbackError);
        $connection->expects(self::never())->method('reconnect');
        try {
            $this->rollback($connection, new RuntimeException('business failed'));
            self::fail('Expected rollback failure');
        } catch (RuntimeException $exception) {
            self::assertSame($rollbackError, $exception);
        }
    }

    private function rollback(ConnectionInterface $connection, Throwable $cause): void
    {
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($connection);
        $container = $this->createMock(ContainerInterface::class);
        $services = [ConnectionResolverInterface::class => $resolver, Db::class => new Db($container)];
        $container->method('get')->willReturnCallback(static fn ($id) => $services[$id]);
        ApplicationContext::setContainer($container);
        $reflection = new ReflectionClass(MagicConversationDomainService::class);
        $reflection->getMethod('rollbackIdentityTransaction')->invoke($reflection->newInstanceWithoutConstructor(), $cause);
    }

    private function deadlock(): PDOException
    {
        $exception = new PDOException('Deadlock found');
        $exception->errorInfo = ['40001', 1213, 'Deadlock found'];
        return $exception;
    }
}
