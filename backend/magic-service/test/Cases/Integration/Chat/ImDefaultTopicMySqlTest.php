<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Integration\Chat;

use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Event\ConversationCreatedEvent;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Hyperf\Context\ApplicationContext;
use HyperfTest\Support\ImDefaultTopicMySqlFixture as Fixture;
use Mockery;
use PDO;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Throwable;

require_once dirname(__DIR__, 3) . '/Support/ImDefaultTopicMySqlFixture.php';

/** @internal */
final class ImDefaultTopicMySqlTest extends TestCase
{
    private int $port;

    private int $redisPort;

    private string $database;

    private PDO $pdo;

    private array $services;

    private ?ContainerInterface $previousContainer;

    protected function setUp(): void
    {
        if (! getenv('IM_TOPIC_MYSQL_PORT') || ! getenv('IM_TOPIC_REDIS_PORT')) {
            self::markTestSkipped('Requires explicit disposable MySQL/Redis ports; application .env is never used');
        }
        $this->port = (int) getenv('IM_TOPIC_MYSQL_PORT');
        $this->redisPort = (int) getenv('IM_TOPIC_REDIS_PORT');
        $this->database = 'im_default_topic_' . getmypid() . '_' . bin2hex(random_bytes(4));
        $admin = Fixture::pdo($this->port);
        $admin->exec('CREATE DATABASE `' . $this->database . '`');
        $this->pdo = Fixture::pdo($this->port, $this->database);
        Fixture::schema($this->pdo);
        Fixture::seedPair($this->pdo);
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $this->services = Fixture::connect($this->port, $this->database, $this->redisPort);
        Fixture::clearRedis($this->services['redis'], $this->database);
    }

    protected function tearDown(): void
    {
        if (! isset($this->database)) {
            return;
        }
        if ($this->services['connection']->transactionLevel() > 0) {
            $this->services['connection']->rollBack();
        }
        Fixture::clearRedis($this->services['redis'], $this->database);
        Fixture::pdo($this->port)->exec('DROP DATABASE `' . $this->database . '`');
        Mockery::close();
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        }
    }

    public function testSlowPreparationDoesNotHoldConversationLocksAndLastCommitWins(): void
    {
        [$worker, $pipes] = $this->startWorker(['delay_ms' => 2500]);
        $prepared = json_decode(trim(fgets($pipes[1])), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('prepared', $prepared['phase']);
        self::assertSame(['old', 'old'], $this->defaults());

        $start = microtime(true);
        $topic = $this->services['connection']->transaction(function (): string {
            $topic = $this->services['domain']->createConversationTopicPair(Fixture::SENDER, Fixture::RECEIVER);
            $this->services['domain']->setConversationDefaultTopicPair(Fixture::RECEIVER, Fixture::SENDER, $topic);
            return $topic;
        });
        self::assertLessThan(1.0, microtime(true) - $start, 'A second creator must finish during the first creator\'s slow I/O');
        self::assertSame([$topic, $topic], $this->defaults());
        $result = $this->finishWorker($worker, $pipes);
        self::assertSame([$result['topic'], $result['topic']], $this->defaults());
        self::assertLessThan(0.5, $result['lock_seconds']);
        foreach ($this->pdo->query('SELECT extra FROM magic_chat_conversations')->fetchAll(PDO::FETCH_COLUMN) as $extra) {
            self::assertSame(['kept' => true], json_decode($extra, true)['unknown']);
        }
    }

    public function testSecondDefaultUpdateFailureRollsBackBothSidesAndTopicPair(): void
    {
        $this->pdo->exec('CREATE TRIGGER fail_receiver BEFORE UPDATE ON magic_chat_conversations FOR EACH ROW BEGIN IF NEW.id = ' . Fixture::RECEIVER . " THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected second update failure'; END IF; END");
        try {
            $this->services['connection']->transaction(function (): void {
                $topic = $this->services['domain']->createConversationTopicPair(Fixture::SENDER, Fixture::RECEIVER);
                $this->services['domain']->setConversationDefaultTopicPair(Fixture::SENDER, Fixture::RECEIVER, $topic);
            });
            self::fail('The second update must fail');
        } catch (Throwable $error) {
            self::assertStringContainsString('injected second update failure', $error->getMessage());
        }
        self::assertSame(['old', 'old'], $this->defaults());
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM magic_chat_topics')->fetchColumn());
        self::assertSame(0, $this->services['connection']->transactionLevel());
    }

    public function testTypeZeroSeesCommittedWinnerDespiteAnOlderRepeatableReadSnapshot(): void
    {
        $connection = $this->services['connection'];
        $connection->beginTransaction();
        self::assertSame(0, (int) $connection->table('magic_chat_topics')->count());
        $staleSender = $this->services['conversations']->getConversationById(Fixture::SENDER);
        [$worker, $pipes] = $this->startWorker([]);
        self::assertSame('prepared', json_decode(trim(fgets($pipes[1])), true)['phase']);
        $winner = $this->finishWorker($worker, $pipes);
        $topic = $this->services['domain']->agentSendMessageGetTopicId($staleSender, 0);
        $connection->commit();
        self::assertSame($winner['topic'], $topic);
        self::assertSame(2, (int) $this->pdo->query('SELECT COUNT(*) FROM magic_chat_topics')->fetchColumn());
        self::assertSame([$topic, $topic], $this->defaults());
    }

    public function testPairIdCacheReadsFreshDefaultsAndTransactionsDoNotPublishUncommittedIds(): void
    {
        $identity = new MagicConversationEntity([
            'user_id' => 'usi_human', 'receive_id' => 'usi_ai', 'receive_type' => ConversationType::Ai->value,
            'user_organization_code' => 'org', 'receive_organization_code' => 'org',
        ]);
        self::assertSame('old', $this->services['conversations']->getConversationByUserIdAndReceiveId($identity)->getExtra()->getDefaultTopicId());
        $keys = $this->services['redis']->keys('*');
        self::assertCount(1, $keys);
        self::assertSame(Fixture::SENDER, $this->services['redis']->get(substr($keys[0], strlen($this->database) + 1)));
        $this->pdo->exec("UPDATE magic_chat_conversations SET extra = '{\"default_topic_id\":\"fresh\",\"unknown\":{\"kept\":true}}'");
        self::assertSame('fresh', $this->services['conversations']->getConversationByUserIdAndReceiveId($identity)->getExtra()->getDefaultTopicId());
        self::assertSame('fresh', $this->services['conversations']->getConversationById(Fixture::SENDER)->getExtra()->getDefaultTopicId());

        Fixture::clearRedis($this->services['redis'], $this->database);
        $connection = $this->services['connection'];
        $connection->beginTransaction();
        $connection->table('magic_chat_conversations')->where('id', Fixture::SENDER)->update(['receive_id' => 'usi_new']);
        $identity->setReceiveId('usi_new');
        self::assertSame(Fixture::SENDER, $this->services['conversations']->getConversationByUserIdAndReceiveId($identity)->getId());
        self::assertSame([], $this->services['redis']->keys('*'));
        $connection->rollBack();
        self::assertNull($this->services['conversations']->getConversationByUserIdAndReceiveId($identity));
        self::assertSame([], $this->services['redis']->keys('*'));
    }

    public function testUnknownFieldsAreMergedFromTheCurrentLockedRow(): void
    {
        $connection = $this->services['connection'];
        $connection->beginTransaction();
        $this->services['conversations']->getConversationById(Fixture::SENDER);
        $this->pdo->exec("UPDATE magic_chat_conversations SET extra = '{\"default_topic_id\":\"other\",\"concurrent\":{\"revision\":2}}'");
        $topic = $this->services['domain']->createConversationTopicPair(Fixture::SENDER, Fixture::RECEIVER);
        $this->services['domain']->setConversationDefaultTopicPair(Fixture::SENDER, Fixture::RECEIVER, $topic);
        $connection->commit();
        foreach ($this->pdo->query('SELECT extra FROM magic_chat_conversations')->fetchAll(PDO::FETCH_COLUMN) as $extra) {
            self::assertSame(['revision' => 2], json_decode($extra, true)['concurrent']);
            self::assertSame($topic, json_decode($extra, true)['default_topic_id']);
        }
    }

    public function testConcurrentColdIdentitiesConvergeAfterNamedUniqueConflict(): void
    {
        $this->pdo->exec('DELETE FROM magic_chat_conversations');
        $this->pdo->exec('CREATE TRIGGER slow_identity BEFORE INSERT ON magic_chat_conversations FOR EACH ROW SET @fixture_sleep = SLEEP(0.25)');
        $workers = [];
        for ($i = 0; $i < 4; ++$i) {
            $workers[] = $this->startWorker(['identity_only' => true]);
        }
        $results = [];
        foreach ($workers as [$worker, $pipes]) {
            $results[] = $this->finishWorker($worker, $pipes);
        }
        self::assertSame(2, (int) $this->pdo->query('SELECT COUNT(*) FROM magic_chat_conversations')->fetchColumn());
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM magic_chat_topics')->fetchColumn());
        self::assertSame(1, array_sum(array_column($results, 'created_events')));
        foreach ($results as $result) {
            self::assertSame($results[0]['pair'], $result['pair']);
            self::assertSame(0, $result['transaction_level']);
        }
    }

    public function testOppositeDirectionsAcquireTheSameOrderAndKeepBothDefaultsConsistent(): void
    {
        $workers = [];
        $startAt = microtime(true) + 1;
        for ($i = 0; $i < 6; ++$i) {
            $workers[] = $this->startWorker(['start_at' => $startAt, 'reverse' => (bool) ($i % 2)]);
        }
        $topics = [];
        foreach ($workers as [$worker, $pipes]) {
            self::assertSame('prepared', json_decode(trim(fgets($pipes[1])), true)['phase']);
            $topics[] = $this->finishWorker($worker, $pipes)['topic'];
        }
        $defaults = $this->defaults();
        self::assertSame($defaults[0], $defaults[1]);
        self::assertContains($defaults[0], $topics);
        self::assertSame(12, (int) $this->pdo->query('SELECT COUNT(*) FROM magic_chat_topics')->fetchColumn());
    }

    public function testIdentityFailureRollsBackBothRowsWithoutEventsOrCache(): void
    {
        $this->pdo->exec('DELETE FROM magic_chat_conversations');
        $this->pdo->exec("CREATE TRIGGER fail_identity BEFORE INSERT ON magic_chat_conversations FOR EACH ROW BEGIN IF NEW.user_id='usi_human' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected identity failure'; END IF; END");
        try {
            $this->services['identityDomain']->getOrCreateConversationPair(new DataIsolation(['current_organization_code' => 'org', 'current_user_id' => 'usi_human']), 'usi_ai');
            self::fail('Expected identity failure');
        } catch (Throwable $error) {
            self::assertStringContainsString('injected identity failure', $error->getMessage());
        }
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM magic_chat_conversations')->fetchColumn());
        self::assertSame([], array_filter($this->services['events']->dispatched, static fn ($event) => $event instanceof ConversationCreatedEvent));
        self::assertSame([], $this->services['redis']->keys('*'));
        self::assertSame(0, $this->services['connection']->transactionLevel());
    }

    public function testRealIdentityDeadlockResetsTheTransactionAndRetriesTheWholePair(): void
    {
        $this->pdo->exec('DELETE FROM magic_chat_conversations');
        $this->pdo->exec('CREATE TABLE identity_probe (id INT PRIMARY KEY, revision INT DEFAULT 0) ENGINE=InnoDB');
        for ($id = 1; $id <= 102; ++$id) {
            $this->pdo->exec('INSERT INTO identity_probe (id) VALUES (' . $id . ')');
        }
        $this->pdo->exec('CREATE TRIGGER deadlock_identity BEFORE INSERT ON magic_chat_conversations FOR EACH ROW BEGIN UPDATE identity_probe SET revision=revision+1 WHERE id=1; DO SLEEP(0.4); UPDATE identity_probe SET revision=revision+1 WHERE id=2; END');
        $admin = Fixture::pdo($this->port);
        $before = (int) $admin->query("SELECT COUNT FROM information_schema.INNODB_METRICS WHERE NAME='lock_deadlocks'")->fetchColumn();
        $this->pdo->beginTransaction();
        // Make the opposing writer heavier so InnoDB selects the small identity transaction as victim.
        $this->pdo->exec('UPDATE identity_probe SET revision=revision+1 WHERE id>=2');
        [$worker, $pipes] = $this->startWorker(['identity_only' => true]);
        $locked = false;
        $deadline = microtime(true) + 5;
        $probe = $admin->prepare("SELECT COUNT(*) FROM performance_schema.data_locks WHERE OBJECT_SCHEMA=? AND OBJECT_NAME='identity_probe' AND LOCK_TYPE='RECORD' AND LOCK_DATA='1'");
        while (microtime(true) < $deadline) {
            $probe->execute([$this->database]);
            if ((int) $probe->fetchColumn() > 0) {
                $locked = true;
                break;
            }
            usleep(10000);
        }
        self::assertTrue($locked, 'Identity writer must hold the first probe row before the opposing lock request');
        $this->pdo->exec('UPDATE identity_probe SET revision=revision+1 WHERE id=1');
        $this->pdo->commit();
        $result = $this->finishWorker($worker, $pipes);
        self::assertGreaterThan($before, (int) $admin->query("SELECT COUNT FROM information_schema.INNODB_METRICS WHERE NAME='lock_deadlocks'")->fetchColumn());
        self::assertSame(2, (int) $this->pdo->query('SELECT COUNT(*) FROM magic_chat_conversations')->fetchColumn());
        self::assertSame(1, $result['created_events']);
        self::assertSame(0, $result['transaction_level']);
    }

    public function testSoftDeletedIdentityIsNotRevivedOrRetried(): void
    {
        $this->pdo->exec('UPDATE magic_chat_conversations SET deleted_at=NOW() WHERE id=' . Fixture::SENDER);
        try {
            $this->services['identityDomain']->getOrCreateConversationPair(new DataIsolation(['current_organization_code' => 'org', 'current_user_id' => 'usi_human']), 'usi_ai');
            self::fail('Expected deleted identity failure');
        } catch (Throwable $error) {
            self::assertStringContainsString('会话身份已被删除', $error->getMessage());
        }
        self::assertSame(2, (int) $this->pdo->query('SELECT COUNT(*) FROM magic_chat_conversations')->fetchColumn());
        self::assertNotNull($this->pdo->query('SELECT deleted_at FROM magic_chat_conversations WHERE id=' . Fixture::SENDER)->fetchColumn());
        self::assertSame([], array_filter($this->services['events']->dispatched, static fn ($event) => $event instanceof ConversationCreatedEvent));
    }

    private function defaults(): array
    {
        return array_map(static fn ($extra) => json_decode($extra, true)['default_topic_id'] ?? null, $this->pdo->query('SELECT extra FROM magic_chat_conversations ORDER BY id')->fetchAll(PDO::FETCH_COLUMN));
    }

    private function startWorker(array $options): array
    {
        $script = <<<'PHP'
            require 'test/bootstrap-isolated.php';
            require 'test/Support/ImDefaultTopicMySqlFixture.php';
            $input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
            $fixture = \HyperfTest\Support\ImDefaultTopicMySqlFixture::connect($input['port'], $input['database'], $input['redis_port']);
            if (!empty($input['identity_only'])) {
                $pair = $fixture['identityDomain']->getOrCreateConversationPair(new \App\Domain\Contact\Entity\ValueObject\DataIsolation(['current_organization_code' => 'org', 'current_user_id' => 'usi_human']), 'usi_ai');
                $events = array_filter($fixture['events']->dispatched, static fn($event) => $event instanceof \App\Domain\Chat\Event\ConversationCreatedEvent);
                echo json_encode(['pair'=>$pair,'created_events'=>count($events),'transaction_level'=>$fixture['connection']->transactionLevel()]), "\n";
                exit(0);
            }
            $fixture['connection']->beginTransaction();
            $topic = $fixture['domain']->createConversationTopicPair(\HyperfTest\Support\ImDefaultTopicMySqlFixture::SENDER, \HyperfTest\Support\ImDefaultTopicMySqlFixture::RECEIVER);
            echo json_encode(['phase'=>'prepared','topic'=>$topic]), "\n";
            flush();
            usleep(($input['delay_ms'] ?? 0) * 1000);
            if (isset($input['start_at'])) {
                usleep((int) max(0, ($input['start_at'] - microtime(true)) * 1000000));
            }
            $start = microtime(true);
            $ids = [\HyperfTest\Support\ImDefaultTopicMySqlFixture::SENDER, \HyperfTest\Support\ImDefaultTopicMySqlFixture::RECEIVER];
            if (!empty($input['reverse'])) $ids = array_reverse($ids);
            $fixture['domain']->setConversationDefaultTopicPair($ids[0], $ids[1], $topic);
            $fixture['connection']->commit();
            echo json_encode(['topic'=>$topic,'lock_seconds'=>microtime(true)-$start]), "\n";
            PHP;
        $worker = proc_open([PHP_BINARY, '-r', $script], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, BASE_PATH);
        self::assertIsResource($worker);
        fwrite($pipes[0], json_encode($options + ['port' => $this->port, 'database' => $this->database, 'redis_port' => $this->redisPort], JSON_THROW_ON_ERROR));
        fclose($pipes[0]);
        return [$worker, $pipes];
    }

    private function finishWorker($worker, array $pipes): array
    {
        $output = stream_get_contents($pipes[1]);
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        self::assertSame(0, proc_close($worker), $error . $output);
        return json_decode(trim($output), true, flags: JSON_THROW_ON_ERROR);
    }
}
