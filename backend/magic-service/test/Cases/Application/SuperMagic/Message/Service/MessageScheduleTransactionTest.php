<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Message\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAccessAppService;
use App\Application\SuperMagic\Message\Chat\Service\ChatAppService;
use App\Application\SuperMagic\Message\Service\MessageScheduleAppService;
use App\Application\SuperMagic\Message\Service\UserMessageToAgentAppService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Message\Repository\Model\MessageScheduleLogModel;
use App\Domain\SuperMagic\Message\Repository\Model\MessageScheduleModel;
use App\Domain\SuperMagic\Message\Repository\Persistence\MessageScheduleLogRepository;
use App\Domain\SuperMagic\Message\Repository\Persistence\MessageScheduleRepository;
use App\Domain\SuperMagic\Message\Service\MessageScheduleDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\Exception\TransactionCommitOutcomeUnknownException;
use Dtyq\TaskScheduler\Repository\Persistence\TaskSchedulerCrontabRepository;
use Dtyq\TaskScheduler\Repository\Persistence\TaskSchedulerRepository;
use Dtyq\TaskScheduler\Service\TaskSchedulerDomainService;
use Hyperf\Context\ApplicationContext;
use Hyperf\Database\ConnectionResolver;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\Connectors\ConnectionFactory;
use Hyperf\Database\MySqlConnection;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use HyperfTest\Support\ImDefaultTopicMySqlFixture;
use PDO;
use PDOException;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use ReflectionClass;
use ReflectionMethod;
use RuntimeException;

/**
 * Real transaction visibility, with external model/file/message services stubbed.
 * Run only against the explicitly configured disposable MySQL/Redis fixture.
 * @internal
 */
final class MessageScheduleTransactionTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    private PDO $observer;

    private MySqlConnection $connection;

    private string $database;

    private int $port;

    private int $sendCalls = 0;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $this->port = (int) getenv('IM_TEST_MYSQL_PORT');
        $redisPort = (int) getenv('IM_TEST_REDIS_PORT');
        if (! $this->port || ! $redisPort) {
            self::markTestSkipped('Set IM_TEST_MYSQL_PORT and IM_TEST_REDIS_PORT to disposable local services');
        }
        $this->database = 'im_default_topic_schedule_' . bin2hex(random_bytes(6));
        $admin = ImDefaultTopicMySqlFixture::pdo($this->port);
        $admin->exec('CREATE DATABASE ' . $this->database);
        $this->observer = ImDefaultTopicMySqlFixture::pdo($this->port, $this->database);
        $fixture = ImDefaultTopicMySqlFixture::connect($this->port, $this->database, $redisPort);
        $this->connection = $fixture['connection'];
        $this->observer->exec('CREATE TABLE magic_super_agent_message_scheduled (
            id BIGINT PRIMARY KEY, user_id VARCHAR(64), organization_code VARCHAR(64), task_name VARCHAR(128),
            message_type VARCHAR(32), message_content JSON, workspace_id BIGINT, project_id BIGINT, topic_id BIGINT,
            completed INT DEFAULT 0, enabled INT DEFAULT 1, deadline DATETIME NULL, remark TEXT,
            time_config JSON, plugins JSON NULL, task_scheduler_crontab_id BIGINT NULL,
            created_uid VARCHAR(64), updated_uid VARCHAR(64), created_at DATETIME NULL,
            updated_at DATETIME NULL, deleted_at DATETIME NULL) ENGINE=InnoDB');
        $this->observer->exec('CREATE TABLE magic_super_agent_message_schedule_log (
            id BIGINT PRIMARY KEY, message_schedule_id BIGINT, workspace_id BIGINT, project_id BIGINT,
            topic_id BIGINT, task_name VARCHAR(128), status INT, executed_at DATETIME NULL,
            error_message TEXT NULL, created_at DATETIME NULL, updated_at DATETIME NULL) ENGINE=InnoDB');
        $this->observer->exec('CREATE TABLE magic_super_agent_topics (
            id BIGINT PRIMARY KEY, project_id BIGINT, chat_conversation_id VARCHAR(64), chat_topic_id VARCHAR(64), deleted_at DATETIME NULL) ENGINE=InnoDB');
        $this->observer->exec('CREATE TABLE magic_chat_topics (
            id BIGINT PRIMARY KEY, conversation_id VARCHAR(64), topic_id VARCHAR(64), deleted_at DATETIME NULL) ENGINE=InnoDB');
        $this->observer->exec('CREATE TABLE schedule_test_defaults (id INT PRIMARY KEY, topic_id VARCHAR(64)) ENGINE=InnoDB');
        $this->observer->exec("INSERT INTO schedule_test_defaults VALUES (1,'old')");
        $this->observer->exec('CREATE TABLE task_scheduler (id BIGINT PRIMARY KEY, external_id VARCHAR(128), environment VARCHAR(64)) ENGINE=InnoDB');
        $this->observer->exec('CREATE TABLE task_scheduler_crontab (id BIGINT PRIMARY KEY, external_id VARCHAR(128), environment VARCHAR(64)) ENGINE=InnoDB');
        $agents = $this->createMock(AgentDomainService::class);
        $agents->method('getAuthorizationByUserId')->willReturn('isolated-token');
        ApplicationContext::getContainer()->set(AgentDomainService::class, $agents);
        ApplicationContext::getContainer()->set(ThirdPlatformDataIsolationManagerInterface::class, $this->createMock(ThirdPlatformDataIsolationManagerInterface::class));
        ApplicationContext::getContainer()->set(SubscriptionManagerInterface::class, $this->createMock(SubscriptionManagerInterface::class));
        ApplicationContext::getContainer()->set(OrganizationInfoManagerInterface::class, $this->createMock(OrganizationInfoManagerInterface::class));
    }

    protected function tearDown(): void
    {
        if (isset($this->connection) && $this->connection->transactionLevel() > 0) {
            $this->connection->rollBack(0);
        }
        if (isset($this->database)) {
            ImDefaultTopicMySqlFixture::pdo($this->port)->exec('DROP DATABASE ' . $this->database);
        }
        if ($this->previousContainer) {
            ApplicationContext::setContainer($this->previousContainer);
        }
    }

    public function testNewTopicAndRunningLogAreCommittedBeforeSend(): void
    {
        $result = $this->execute($this->service());
        self::assertTrue($result['success'], json_encode($result));
        self::assertSame(1, $this->sendCalls);
        self::assertSame(1, (int) $this->log()['status']);
        self::assertSame('chat-topic', $this->observer->query('SELECT topic_id FROM schedule_test_defaults')->fetchColumn());
    }

    public function testExistingTopicAlsoCommitsLinksAndSendsWithoutAnOuterTransaction(): void
    {
        self::assertTrue($this->execute($this->service(existing: true))['success']);
        self::assertSame(1, $this->sendCalls);
        self::assertSame('old', $this->observer->query('SELECT topic_id FROM schedule_test_defaults')->fetchColumn());
    }

    public function testSendFailureKeepsCommittedResourcesAndRecordsFailedCall(): void
    {
        $result = $this->execute($this->service(sendFails: true));
        self::assertFalse($result['success']);
        self::assertSame(1, $this->sendCalls);
        self::assertSame(2, (int) $this->log()['status']);
        self::assertSame(42, (int) $this->log()['topic_id']);
        self::assertSame(1, (int) $this->observer->query('SELECT COUNT(*) FROM magic_super_agent_topics')->fetchColumn());
    }

    public function testPreparationFailureRollsBackResourcesAndDoesNotSend(): void
    {
        $result = $this->execute($this->service(defaultFails: true));
        self::assertFalse($result['success']);
        self::assertSame(0, $this->sendCalls);
        self::assertSame(2, (int) $this->log()['status']);
        self::assertSame(0, (int) $this->log()['topic_id']);
        self::assertSame(0, (int) $this->observer->query('SELECT COUNT(*) FROM magic_super_agent_topics')->fetchColumn());
        self::assertSame('old', $this->observer->query('SELECT topic_id FROM schedule_test_defaults')->fetchColumn());
    }

    public function testSummaryFailureDoesNotEvenPrepareConversationIdentity(): void
    {
        self::assertFalse($this->execute($this->service(summaryFails: true))['success']);
        self::assertSame(0, $this->sendCalls);
        self::assertSame(2, (int) $this->log()['status']);
        self::assertSame(0, (int) $this->observer->query('SELECT COUNT(*) FROM magic_chat_topics')->fetchColumn());
    }

    public function testCompletionReadsLatestScheduleAndPreservesConcurrentDisableAndContent(): void
    {
        self::assertTrue($this->execute($this->service(editDuringSend: true))['success']);
        $schedule = $this->observer->query('SELECT * FROM magic_super_agent_message_scheduled')->fetch();
        self::assertSame(0, (int) $schedule['enabled']);
        self::assertSame('edited', json_decode($schedule['message_content'], true)['content']);
        self::assertSame(0, (int) $schedule['completed'], 'Latest future execution time must prevent stale completion');
    }

    public function testCompletionWriteFailureLeavesRunningAndNeverResends(): void
    {
        self::assertTrue($this->execute($this->service(finalizeFails: true))['success']);
        self::assertSame(1, $this->sendCalls);
        self::assertSame(3, (int) $this->log()['status']);
        self::assertSame(42, (int) $this->log()['topic_id']);
    }

    public function testUnknownMetadataCommitStopsBeforeSendWithOneRunningLog(): void
    {
        $service = $this->service();
        $this->connection = new class(ImDefaultTopicMySqlFixture::pdo($this->port, $this->database), $this->database) extends MySqlConnection {
            protected int $fetchMode = PDO::FETCH_ASSOC;

            private int $commits = 0;

            public function commit(): void
            {
                parent::commit();
                if (++$this->commits === 2) {
                    throw new RuntimeException('commit response lost after durable commit');
                }
            }
        };
        ApplicationContext::getContainer()->set(ConnectionResolverInterface::class, new ConnectionResolver(['default' => $this->connection]));
        $factory = $this->createMock(ConnectionFactory::class);
        $factory->method('make')->willReturn(new MySqlConnection(ImDefaultTopicMySqlFixture::pdo($this->port, $this->database), $this->database));
        ApplicationContext::getContainer()->set(ConnectionFactory::class, $factory);
        self::assertFalse($this->execute($service)['success']);
        self::assertSame(0, $this->sendCalls);
        self::assertSame(3, (int) $this->log()['status']);
        self::assertSame(42, (int) $this->log()['topic_id']);
        self::assertSame(1, (int) $this->observer->query('SELECT COUNT(*) FROM magic_super_agent_message_schedule_log')->fetchColumn());
    }

    public function testCompletionCommitFailureDiscardsSessionAndLeavesRunningWithoutResending(): void
    {
        $service = $this->service();
        $this->connection = new class(ImDefaultTopicMySqlFixture::pdo($this->port, $this->database), $this->database) extends MySqlConnection {
            protected int $fetchMode = PDO::FETCH_ASSOC;

            private int $commits = 0;

            public function commit(): void
            {
                if (++$this->commits === 3) {
                    throw new RuntimeException('completion commit unavailable');
                }
                parent::commit();
            }
        };
        ApplicationContext::getContainer()->set(ConnectionResolverInterface::class, new ConnectionResolver(['default' => $this->connection]));
        self::assertTrue($this->execute($service)['success']);
        self::assertSame(0, $this->connection->transactionLevel());
        self::assertSame(1, $this->sendCalls);
        self::assertSame(3, (int) $this->log()['status']);
        self::assertSame(42, (int) $this->log()['topic_id']);
        $this->observer->exec('UPDATE magic_super_agent_message_scheduled SET enabled=0 WHERE id=1');
    }

    public function testUnknownIdentityCommitPreservesRunningAndStopsBeforeMetadata(): void
    {
        self::assertFalse($this->execute($this->service(identityUnknown: true))['success']);
        self::assertSame(0, $this->sendCalls);
        self::assertSame(3, (int) $this->log()['status']);
        self::assertSame(0, (int) $this->log()['topic_id']);
    }

    public function testNestedExecutionRejectsEvenAnExistingTopic(): void
    {
        $service = $this->service(existing: true);
        $this->connection->beginTransaction();
        try {
            $this->execute($service);
            self::fail('Nested execution must fail');
        } catch (RuntimeException $exception) {
            self::assertStringContainsString('requires no active transaction', $exception->getMessage());
        }
        self::assertSame(0, $this->sendCalls);
        self::assertSame(0, (int) $this->observer->query('SELECT COUNT(*) FROM magic_super_agent_message_schedule_log')->fetchColumn());
    }

    public function testPermissionDenialDisablesOnlyCurrentScheduleAndClearsSchedulerAfterCommit(): void
    {
        $service = $this->service(accessDenied: true);
        $this->observer->exec("INSERT INTO task_scheduler_crontab VALUES (10,'message_schedule_1','testing')");
        $this->observer->exec("INSERT INTO task_scheduler VALUES (11,'message_schedule_1','testing')");
        self::assertFalse($this->execute($service)['success']);
        self::assertSame(0, (int) $this->observer->query('SELECT COUNT(*) FROM task_scheduler_crontab')->fetchColumn());
        self::assertSame(0, (int) $this->observer->query('SELECT COUNT(*) FROM task_scheduler')->fetchColumn());
        self::assertSame(0, $this->sendCalls);
        self::assertSame(2, (int) $this->log()['status']);
        $schedule = $this->observer->query('SELECT * FROM magic_super_agent_message_scheduled')->fetch();
        self::assertSame(0, (int) $schedule['enabled']);
        self::assertSame('permission-check-edit', json_decode($schedule['message_content'], true)['content']);
        self::assertSame(1, (int) $schedule['completed']);
    }

    public function testPermissionCleanupPreservesSchedulerInstalledAfterDisableCommit(): void
    {
        $service = $this->service(accessDenied: true, permissionReenabled: true);
        $this->connection = new class(ImDefaultTopicMySqlFixture::pdo($this->port, $this->database), $this->database, $this->observer) extends MySqlConnection {
            protected int $fetchMode = PDO::FETCH_ASSOC;

            private int $commits = 0;

            public function __construct(PDO $pdo, string $database, private PDO $observer)
            {
                parent::__construct($pdo, $database);
            }

            public function commit(): void
            {
                parent::commit();
                if (++$this->commits === 2) {
                    // User update wins the gap after permission disable commits.
                    $this->observer->beginTransaction();
                    $this->observer->exec('UPDATE magic_super_agent_message_scheduled SET enabled=1,task_scheduler_crontab_id=77,time_config=\'{"type":"no_repeat","day":"2099-01-01","time":"00:00"}\' WHERE id=1');
                    $this->observer->exec("INSERT INTO task_scheduler_crontab VALUES (77,'message_schedule_1','testing')");
                    $this->observer->exec("INSERT INTO task_scheduler VALUES (88,'message_schedule_1','testing')");
                    $this->observer->commit();
                }
            }
        };
        ApplicationContext::getContainer()->set(ConnectionResolverInterface::class, new ConnectionResolver(['default' => $this->connection]));
        self::assertFalse($this->execute($service)['success']);
        self::assertSame(0, $this->sendCalls);
        self::assertSame(2, (int) $this->log()['status']);
        self::assertSame(77, (int) $this->observer->query('SELECT id FROM task_scheduler_crontab')->fetchColumn());
        self::assertSame(88, (int) $this->observer->query('SELECT id FROM task_scheduler')->fetchColumn());
        $schedule = $this->observer->query('SELECT * FROM magic_super_agent_message_scheduled')->fetch();
        self::assertSame(1, (int) $schedule['enabled']);
        self::assertSame(77, (int) $schedule['task_scheduler_crontab_id']);
        self::assertSame(0, (int) $schedule['completed']);
    }

    public function testDisabledScheduleStillRecordsFailureAndCompletesWithoutSending(): void
    {
        $service = $this->service(existing: true);
        $this->observer->exec('UPDATE magic_super_agent_message_scheduled SET enabled=0');
        self::assertFalse($this->execute($service)['success']);
        self::assertSame(0, $this->sendCalls);
        self::assertSame(2, (int) $this->log()['status']);
        self::assertSame(1, (int) $this->observer->query('SELECT completed FROM magic_super_agent_message_scheduled')->fetchColumn());
    }

    public function testRunningLogCreationFailureNeverInitializesResourcesOrSends(): void
    {
        $service = $this->service(existing: true);
        $this->observer->exec("CREATE TRIGGER schedule_log_failure BEFORE INSERT ON magic_super_agent_message_schedule_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='log write failed'");
        self::assertFalse($this->execute($service)['success']);
        self::assertSame(0, $this->sendCalls);
        self::assertSame(0, (int) $this->observer->query('SELECT COUNT(*) FROM magic_super_agent_message_schedule_log')->fetchColumn());
    }

    private function service(bool $existing = false, bool $sendFails = false, bool $defaultFails = false, bool $summaryFails = false, bool $editDuringSend = false, bool $finalizeFails = false, bool $identityUnknown = false, bool $accessDenied = false, bool $permissionReenabled = false): MessageScheduleAppService
    {
        $insert = $this->observer->prepare('INSERT INTO magic_super_agent_message_scheduled (id,user_id,organization_code,task_name,message_type,message_content,workspace_id,project_id,topic_id,time_config,remark,created_uid,updated_uid) VALUES (1,?,?,?,?,?,1,7,?,?,\'\',\'user\',\'user\')');
        $insert->execute(['user', 'org', 'task', 'text', '{"content":"hello"}', $existing ? 42 : 0, '{"type":"no_repeat","day":"2000-01-01","time":"00:00"}']);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());
        $domain = new MessageScheduleDomainService(new MessageScheduleRepository(new MessageScheduleModel()), new MessageScheduleLogRepository(new MessageScheduleLogModel()), $loggerFactory);
        $messages = $this->createMock(MagicChatMessageAppService::class);
        $summaryExpectation = $messages->expects($existing || $accessDenied ? self::never() : self::once())->method('summarizeText');
        if ($summaryFails) {
            $summaryExpectation->willThrowException(new RuntimeException('summary failed'));
        } else {
            $summaryExpectation->willReturn('title');
        }
        $chat = $this->createMock(ChatAppService::class);
        $identity = $chat->expects($existing || $summaryFails || $accessDenied ? self::never() : self::once())->method('getOrCreateMagicChatConversationPair');
        $identity->willReturnCallback(function () use ($identityUnknown): array {
            self::assertSame(0, Db::transactionLevel());
            self::assertSame(3, (int) $this->log()['status']);
            if ($identityUnknown) {
                throw new TransactionCommitOutcomeUnknownException(new RuntimeException('identity commit lost'));
            }
            return ['sender_conversation_id' => 'sender', 'receiver_conversation_id' => 'receiver'];
        });
        $chat->expects($existing || $summaryFails || $identityUnknown || $accessDenied ? self::never() : self::once())->method('createMagicChatTopicForConversationPair')->willReturnCallback(function (): array {
            Db::table('magic_chat_topics')->insert([['id' => 1, 'conversation_id' => 'sender', 'topic_id' => 'chat-topic'], ['id' => 2, 'conversation_id' => 'receiver', 'topic_id' => 'chat-topic']]);
            return ['chat_conversation_id' => 'sender', 'receive_conversation_id' => 'receiver', 'chat_topic_id' => 'chat-topic'];
        });
        $chat->expects($existing || $summaryFails || $identityUnknown || $accessDenied ? self::never() : self::once())->method('setMagicChatDefaultTopic')->willReturnCallback(function () use ($defaultFails): void {
            Db::table('schedule_test_defaults')->where('id', 1)->update(['topic_id' => 'chat-topic']);
            if ($defaultFails) {
                throw new RuntimeException('default update failed');
            }
        });
        $topic = new TopicEntity(['id' => 42, 'project_id' => 7, 'chat_topic_id' => 'chat-topic', 'chat_conversation_id' => 'sender']);
        $topics = $this->createMock(TopicDomainService::class);
        if ($existing) {
            $this->observer->exec("INSERT INTO magic_super_agent_topics VALUES (42,7,'sender','chat-topic',NULL)");
            $topics->method('getTopicById')->willReturn($topic);
            $topics->expects(self::never())->method('createTopic');
        } else {
            $topics->method('createTopic')->willReturnCallback(function () use ($topic): TopicEntity {
                Db::table('magic_super_agent_topics')->insert(['id' => 42, 'project_id' => 7, 'chat_topic_id' => 'chat-topic', 'chat_conversation_id' => 'sender']);
                return $topic;
            });
        }
        $sender = $this->createMock(UserMessageToAgentAppService::class);
        $sender->method('sendMessageWithQueueSupport')->willReturnCallback(function () use ($sendFails, $editDuringSend, $finalizeFails): array {
            ++$this->sendCalls;
            self::assertSame(0, Db::transactionLevel());
            self::assertSame(3, (int) $this->log()['status']);
            self::assertSame(42, (int) $this->log()['topic_id']);
            self::assertSame(7, (int) $this->log()['project_id']);
            self::assertSame(1, (int) $this->observer->query('SELECT COUNT(*) FROM magic_super_agent_topics')->fetchColumn());
            if ($editDuringSend) {
                $this->observer->exec('UPDATE magic_super_agent_message_scheduled SET enabled=0,message_content=\'{"content":"edited"}\',time_config=\'{"type":"no_repeat","day":"2099-01-01","time":"00:00"}\'');
            }
            if ($finalizeFails) {
                $this->observer->exec("CREATE TRIGGER schedule_completion_failure BEFORE UPDATE ON magic_super_agent_message_scheduled FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='completion write failed'");
            }
            return ['success' => ! $sendFails, 'error_message' => $sendFails ? 'push failed after message commit' : '', 'data' => ['result' => 'sent']];
        });
        $projects = $this->createMock(ProjectDomainService::class);
        $projects->method('getProjectNotUserId')->willReturn(new ProjectEntity(['id' => 7, 'workspace_id' => 1]));
        $access = $this->createMock(SuperMagicAgentAccessAppService::class);
        $access->method('checkAgentAccess')->willReturnCallback(function () use ($accessDenied): array {
            if ($accessDenied) {
                $this->observer->exec('UPDATE magic_super_agent_message_scheduled SET message_content=\'{"content":"permission-check-edit"}\'');
            }
            return [! $accessDenied, 'permission denied'];
        });
        $scheduler = $this->createMock(TaskSchedulerDomainService::class);
        $scheduler->expects($accessDenied && ! $permissionReenabled ? self::once() : self::never())->method('clearByExternalId')->willReturnCallback(function (string $externalId): void {
            self::assertSame(1, Db::transactionLevel());
            self::assertSame(0, (int) $this->observer->query('SELECT enabled FROM magic_super_agent_message_scheduled')->fetchColumn());
            // The committed disable is visible, and the second transaction holds the
            // schedule row until scheduler cleanup ends. Re-enable cannot pass it.
            $this->observer->exec('SET SESSION innodb_lock_wait_timeout=1');
            try {
                $this->observer->exec('UPDATE magic_super_agent_message_scheduled SET enabled=1 WHERE id=1');
                self::fail('Scheduler cleanup must serialize with schedule edits');
            } catch (PDOException $exception) {
                self::assertSame(1205, (int) $exception->errorInfo[1]);
            }
            (new TaskSchedulerRepository())->clearByExternalId($externalId);
            (new TaskSchedulerCrontabRepository())->clearByExternalId($externalId);
        });
        $reflection = new ReflectionClass(MessageScheduleAppService::class);
        $service = $reflection->newInstanceWithoutConstructor();
        foreach (['chatMessageAppService' => $messages, 'chatAppService' => $chat, 'messageScheduleDomainService' => $domain, 'topicDomainService' => $topics, 'taskFileDomainService' => $this->createMock(TaskFileDomainService::class), 'userMessageToAgentAppService' => $sender, 'projectDomainService' => $projects, 'superMagicAgentAccessAppService' => $access, 'taskSchedulerDomainService' => $scheduler, 'logger' => new NullLogger()] as $name => $value) {
            $reflection->getProperty($name)->setValue($service, $value);
        }
        return $service;
    }

    private function execute(MessageScheduleAppService $service): array
    {
        return (new ReflectionMethod($service, 'executeMessageSchedule'))->invoke($service, 1);
    }

    private function log(): array
    {
        return $this->observer->query('SELECT * FROM magic_super_agent_message_schedule_log')->fetch();
    }
}
