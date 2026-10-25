<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Topic;

use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Chat\Repository\Persistence\Model\MagicChatSequenceModel;
use App\Domain\SuperMagic\Topic\Repository\Persistence\TopicRepository;
use Hyperf\Context\ApplicationContext;
use Hyperf\Database\ConnectionResolver;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\MySqlConnection;
use Hyperf\Database\Query\Builder;
use Hyperf\Database\Query\Grammars\MySqlGrammar;
use PDO;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use ReflectionClass;
use Throwable;

/** @internal */
final class SequenceStatusBatchTest extends TestCase
{
    private MySqlConnection $connection;

    private TopicRepository $repository;

    private ?ContainerInterface $previousContainer;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $pdo = new PDO('sqlite::memory:');
        $pdo->exec('CREATE TABLE magic_chat_sequences (id INTEGER PRIMARY KEY, status INTEGER, updated_at TEXT, deleted_at TEXT)');
        $insert = $pdo->prepare('INSERT INTO magic_chat_sequences VALUES (?, 3, ?, NULL)');
        for ($i = 1; $i <= 1202; ++$i) {
            $insert->execute([(string) (950000000000000000 + $i), '2020-01-01 00:00:00']);
        }
        $pdo->exec('UPDATE magic_chat_sequences SET deleted_at = \'2020-01-01\' WHERE id = 950000000000001201');
        $this->connection = new MySqlConnection($pdo, 'memory');
        // SQLite rejects qualified SET columns; only adapt that MySQL syntax.
        $this->connection->setQueryGrammar(new class extends MySqlGrammar {
            protected function compileUpdateColumns(Builder $query, array $values): string
            {
                $unqualified = [];
                foreach ($values as $key => $value) {
                    $unqualified[substr($key, strrpos('.' . $key, '.'))] = $value;
                }
                return parent::compileUpdateColumns($query, $unqualified);
            }
        });
        $this->connection->enableQueryLog();
        $container = $this->createMock(ContainerInterface::class);
        $services = [
            ConnectionResolverInterface::class => new ConnectionResolver(['default' => $this->connection]),
            EventDispatcherInterface::class => $this->createMock(EventDispatcherInterface::class),
        ];
        $container->method('get')->willReturnCallback(static fn ($id) => $services[$id]);
        ApplicationContext::setContainer($container);
        $reflection = new ReflectionClass(TopicRepository::class);
        $this->repository = $reflection->newInstanceWithoutConstructor();
        $reflection->getProperty('magicChatSequenceModel')->setValue($this->repository, new MagicChatSequenceModel());
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        }
    }

    public function testBatchesPreserveExactIdsSoftDeletesAndOneTimestamp(): void
    {
        $ids = $this->ids();
        $ids[] = $ids[501];
        $ids[] = '950000000000001201'; // Soft-deleted row must not change.
        $this->connection->transaction(fn () => self::assertTrue($this->repository->batchUpdateSeqStatus(array_reverse($ids), MagicMessageStatus::Read)));
        $updates = array_values(array_filter($this->connection->getQueryLog(), static fn ($query) => str_starts_with($query['query'], 'update')));
        self::assertCount(3, $updates);
        foreach ($updates as $update) {
            self::assertLessThanOrEqual(502, count($update['bindings'])); // IDs plus status and timestamp.
        }
        self::assertSame(1200, $this->connection->table('magic_chat_sequences')->where('status', 2)->count());
        self::assertSame(1, $this->connection->table('magic_chat_sequences')->where('status', 2)->distinct()->count('updated_at'));
        self::assertSame(3, (int) $this->connection->table('magic_chat_sequences')->where('id', '950000000000001201')->value('status'));
        self::assertSame('2020-01-01 00:00:00', $this->connection->table('magic_chat_sequences')->where('id', '950000000000001202')->value('updated_at'));
    }

    public function testReadAndRevokedTransitionsPreserveTheRollbackBoundary(): void
    {
        $ids = $this->ids();
        $before = array_slice($ids, 0, 750);
        $fromTarget = array_slice($ids, 750);
        $this->connection->transaction(function () use ($before, $fromTarget): void {
            $this->repository->batchUpdateSeqStatus($before, MagicMessageStatus::Read);
            $this->repository->batchUpdateSeqStatus($fromTarget, MagicMessageStatus::Revoked);
        });
        self::assertSame(750, $this->connection->table('magic_chat_sequences')->whereIn('id', $ids)->where('status', 2)->count());
        self::assertSame(450, $this->connection->table('magic_chat_sequences')->whereIn('id', $ids)->where('status', 3)->count());
        $this->connection->transaction(fn () => $this->repository->batchUpdateSeqStatus($fromTarget, MagicMessageStatus::Read));
        self::assertSame(1200, $this->connection->table('magic_chat_sequences')->whereIn('id', $ids)->where('status', 2)->count());
    }

    public function testLaterBatchFailureRollsBackEarlierBatches(): void
    {
        $this->connection->getPdo()->exec("CREATE TRIGGER fail_batch BEFORE UPDATE ON magic_chat_sequences WHEN NEW.id = 950000000000000501 BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
        try {
            $this->connection->transaction(fn () => $this->repository->batchUpdateSeqStatus($this->ids(), MagicMessageStatus::Read));
            self::fail('Expected the second batch to fail');
        } catch (Throwable $exception) {
            self::assertStringContainsString('injected failure', $exception->getMessage());
        }
        self::assertSame(0, $this->connection->table('magic_chat_sequences')->where('status', 2)->count());
        self::assertSame(0, $this->connection->transactionLevel());
    }

    public function testEmptyAndMissingIdsPreserveReturnBehavior(): void
    {
        self::assertTrue($this->repository->batchUpdateSeqStatus([], MagicMessageStatus::Read));
        self::assertFalse($this->repository->batchUpdateSeqStatus(['950000000000009999'], MagicMessageStatus::Read));
    }

    private function ids(): array
    {
        return array_map(static fn (int $i): string => (string) (950000000000000000 + $i), range(1, 1200));
    }
}
