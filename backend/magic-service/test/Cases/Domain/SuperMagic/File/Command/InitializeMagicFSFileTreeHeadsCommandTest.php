<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\File\Command;

use App\Command\InitializeMagicFSFileTreeHeadsCommand;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Logger\LoggerFactory;
use Monolog\Handler\TestHandler;
use Monolog\Logger as MonologLogger;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;
use RuntimeException;
use Symfony\Component\Console\Tester\CommandTester;

/**
 * 回填命令的 SQL 审计日志开关。
 *
 * 回填会为每棵文件树各发一批 SELECT/INSERT，App\Listener\DbQueryExecutedListener 把每条
 * 都按 info 打到 stdout，所以命令默认静音、跑完还原；--keep-sql-log 保留用于排障。
 *
 * @internal
 */
class InitializeMagicFSFileTreeHeadsCommandTest extends TestCase
{
    public function testSqlAuditLogIsMutedDuringBackfillAndRestoredAfterwards(): void
    {
        $handler = new TestHandler();
        $sqlLogger = new MonologLogger('sql', [$handler]);
        $repository = $this->repositoryThatLogsSql($sqlLogger);

        $tester = $this->tester($repository, $this->loggerFactory($sqlLogger));
        self::assertSame(0, $tester->execute([]));

        self::assertFalse(
            $handler->hasInfoThatContains('magic_fs_file_tree_heads'),
            '回填期间的 SQL 日志必须静音'
        );
        self::assertSame([$handler], $sqlLogger->getHandlers(), '命令结束后必须还原原 handler');
        self::assertStringContainsString('SQL audit log is muted', $tester->getDisplay());
        self::assertStringContainsString(
            'Discovered 3 file trees; initialized 3 file-tree heads.',
            $tester->getDisplay()
        );
    }

    public function testKeepSqlLogOptionLeavesTheAuditLogUntouched(): void
    {
        $handler = new TestHandler();
        $sqlLogger = new MonologLogger('sql', [$handler]);
        $repository = $this->repositoryThatLogsSql($sqlLogger);

        $tester = $this->tester($repository, $this->loggerFactory($sqlLogger, false));
        self::assertSame(0, $tester->execute(['--keep-sql-log' => true]));

        self::assertTrue(
            $handler->hasInfoThatContains('magic_fs_file_tree_heads'),
            '--keep-sql-log 必须保留 SQL 审计日志'
        );
        self::assertSame([$handler], $sqlLogger->getHandlers());
        self::assertStringNotContainsString('muted', $tester->getDisplay());
    }

    public function testSqlAuditLogIsRestoredWhenBackfillFails(): void
    {
        $handler = new TestHandler();
        $sqlLogger = new MonologLogger('sql', [$handler]);

        $repository = $this->createMock(TaskFileRepositoryInterface::class);
        $repository->method('initializeFileTreeHeads')->willThrowException(new RuntimeException('boom'));

        $tester = $this->tester($repository, $this->loggerFactory($sqlLogger));
        self::assertSame(1, $tester->execute([]));

        self::assertSame([$handler], $sqlLogger->getHandlers(), '异常退出也必须还原 handler');
        self::assertStringContainsString(
            'MagicFS file-tree head initialization failed: boom',
            $tester->getDisplay()
        );
    }

    /**
     * 模拟 App\Listener\DbQueryExecutedListener：回填期间每条 SQL 都会打一条 info。
     */
    private function repositoryThatLogsSql(MonologLogger $sqlLogger): TaskFileRepositoryInterface
    {
        $repository = $this->createMock(TaskFileRepositoryInterface::class);
        $repository->method('initializeFileTreeHeads')->willReturnCallback(
            static function () use ($sqlLogger): array {
                $sqlLogger->info('[default:1.6] select * from magic_fs_file_tree_heads');

                return ['discovered_file_trees' => 3, 'initialized_file_trees' => 3];
            }
        );

        return $repository;
    }

    private function loggerFactory(MonologLogger $sqlLogger, bool $expectRequest = true): LoggerFactory
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->expects($expectRequest ? $this->atLeastOnce() : $this->never())
            ->method('get')
            ->with('sql')
            ->willReturn($sqlLogger);

        return $loggerFactory;
    }

    private function tester(TaskFileRepositoryInterface $repository, LoggerFactory $loggerFactory): CommandTester
    {
        $command = new InitializeMagicFSFileTreeHeadsCommand($repository, $loggerFactory);
        // 测试进程没有 Swoole，命令默认会切到协程里执行；这里关掉协程，只验证日志开关。
        (new ReflectionProperty(HyperfCommand::class, 'coroutine'))->setValue($command, false);

        return new CommandTester($command);
    }
}
