<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Agent;

use App\Application\SuperMagic\Agent\Event\Subscribe\ClawFunctionPermissionChangedListener;
use App\Application\SuperMagic\Agent\Service\MagicClawReconciliationAppService;
use App\Domain\Contact\Event\DepartmentMembershipChanged;
use App\Domain\Contact\Repository\Persistence\MagicDepartmentUserRepository;
use App\Domain\Contact\Repository\Persistence\Model\DepartmentUserModel;
use App\Domain\Permission\Event\FunctionPermissionChanged;
use App\Domain\SuperMagic\Agent\Entity\MagicClawEntity;
use App\Domain\SuperMagic\Agent\Event\ClawPermissionReconciliationRequestedEvent;
use App\Domain\SuperMagic\Agent\Repository\Persistence\MagicClawReconciliationRepository;
use App\Domain\SuperMagic\Agent\Service\MagicClawRuntimePolicyDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use App\Infrastructure\SuperMagic\Task\Locker\SandboxLifecycleLock;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Listener\FetchModeListener;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Database\ConnectionResolver;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\Model\Register;
use Hyperf\Database\MySqlConnection;
use Hyperf\Database\Query\Builder;
use Hyperf\Database\Query\Grammars\MySqlGrammar;
use Hyperf\DbConnection\Db;
use Hyperf\Snowflake\IdGeneratorInterface;
use HyperfTest\Support\MagicClawTestEnvironment;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\NullLogger;
use ReflectionObject;
use RuntimeException;

/** @internal */
final class MagicClawReconciliationTest extends TestCase
{
    use MagicClawTestEnvironment;

    private MySqlConnection $db;

    private MagicClawReconciliationRepository $repository;

    private MagicClawReconciliationAppService $service;

    private AgentDomainService $agent;

    private TaskDomainService $tasks;

    private LockerInterface $locker;

    private MagicClawRuntimePolicyDomainService $policy;

    private bool $allowed = false;

    private $migration;

    protected function setUp(): void
    {
        $pdo = new PDO('sqlite::memory:');
        $this->db = new MySqlConnection($pdo, 'memory');
        $this->db->setQueryGrammar(new class extends MySqlGrammar {
            public function compileInsertOrIgnore(Builder $query, array $values): string
            {
                return str_replace('insert into', 'insert or ignore into', $this->compileInsert($query, $values));
            }

            protected function compileUpdateColumns(Builder $query, array $values): string
            {
                $columns = [];
                foreach ($values as $key => $value) {
                    $columns[substr($key, strrpos('.' . $key, '.'))] = $value;
                }
                return parent::compileUpdateColumns($query, $columns);
            }
        });
        $pdo->exec('CREATE TABLE magic_super_magic_claw (id INTEGER PRIMARY KEY, organization_code TEXT, user_id TEXT, project_id INTEGER, deleted_at TEXT, updated_at TEXT)');
        $pdo->exec('CREATE TABLE magic_super_agent_topics (id INTEGER PRIMARY KEY, user_organization_code TEXT, user_id TEXT, project_id INTEGER, sandbox_id TEXT, current_task_status TEXT, deleted_at TEXT, updated_at TEXT)');
        $pdo->exec('CREATE TABLE magic_super_agent_message_queue (id INTEGER PRIMARY KEY, topic_id INTEGER, organization_code TEXT, status INTEGER, err_message TEXT, updated_at TEXT)');
        $pdo->exec('CREATE TABLE policy_test (value TEXT)');
        $resolver = new ConnectionResolver(['default' => $this->db]);
        Register::setConnectionResolver($resolver);
        $id = 900000000000000000;
        $snowflake = $this->createMock(IdGeneratorInterface::class);
        $snowflake->method('generate')->willReturnCallback(static function () use (&$id) { return ++$id; });
        $container = $this->prepareClawEnvironment([ConnectionResolverInterface::class => $resolver, IdGeneratorInterface::class => $snowflake]);
        // Db facade uses a container-bound instance; avoid application bootstrap and external services.
        $reflection = new ReflectionObject($container);
        $services = $reflection->getProperty('services')->getValue($container);
        $services[Db::class] = new Db($container);
        $services[EventDispatcherInterface::class] = $this->createMock(EventDispatcherInterface::class);
        $reflection->getProperty('services')->setValue($container, $services);
        $this->migration = require BASE_PATH . '/migrations/2026_10_19_160000_add_magic_claw_permission_reconciliation.php';
        $ddl = $this->db->pretend(fn () => $this->migration->up());
        self::assertNotEmpty($ddl);
        // SQLite executes repository/transaction behavior. Production migration DDL is compiled for MySQL above.
        $pdo->exec("CREATE TABLE magic_claw_permission_reconciliations (id INTEGER PRIMARY KEY, organization_code TEXT, actor TEXT, reason TEXT, status TEXT DEFAULT 'pending', cursor INTEGER DEFAULT 0, lease_until INTEGER DEFAULT 0, lease_owner TEXT DEFAULT '', scan_completed INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT)");
        $pdo->exec("CREATE TABLE magic_claw_permission_reconciliation_items (id INTEGER PRIMARY KEY AUTOINCREMENT, operation_id INTEGER, claw_id INTEGER, topic_id INTEGER, sandbox_id TEXT DEFAULT '', status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, requires_manual_start INTEGER DEFAULT 0, next_retry_at INTEGER DEFAULT 0, last_error TEXT DEFAULT '', created_at TEXT, updated_at TEXT, UNIQUE(operation_id, claw_id, topic_id))");
        $this->db->table('magic_super_magic_claw')->insert(['id' => 1, 'organization_code' => 'org', 'user_id' => 'owner', 'project_id' => 10]);
        $this->db->table('magic_super_agent_topics')->insert(['id' => 20, 'user_organization_code' => 'org', 'user_id' => 'owner', 'project_id' => 10, 'sandbox_id' => 'warm-pool-real-id', 'current_task_status' => 'running']);
        $this->repository = new MagicClawReconciliationRepository();
        $policy = $this->policy = $this->createMock(MagicClawRuntimePolicyDomainService::class);
        $policy->method('isAllowed')->willReturnCallback(fn () => $this->allowed);
        $this->agent = $this->createMock(AgentDomainService::class);
        $this->agent->method('stopSandboxIfExists')->willReturn(new GatewayResult(ResponseCode::SUCCESS, 'ok'));
        $lock = $this->createMock(SandboxLifecycleLock::class);
        $lock->method('run')->willReturnCallback(static fn ($id, $callback) => $callback(static function (): void {}));
        $locker = $this->locker = $this->createMock(LockerInterface::class);
        $locker->method('spinLock')->willReturn(true);
        $locker->method('mutexLock')->willReturn(true);
        $locker->method('release')->willReturn(true);
        $this->tasks = $this->createMock(TaskDomainService::class);
        $this->service = new MagicClawReconciliationAppService($this->repository, $policy, $this->agent, $this->tasks, $lock, $locker);
        $this->service->logger = new NullLogger();
    }

    protected function tearDown(): void
    {
        Context::destroy('department_membership_changed:' . Coroutine::id() . ':org');
        Register::unsetConnectionResolver();
    }

    public function testMigrationOnlyCreatesAndDropsTheTwoReconciliationTables(): void
    {
        $up = $this->db->pretend(fn () => $this->migration->up());
        $down = $this->db->pretend(fn () => $this->migration->down());
        self::assertCount(2, $down);
        foreach (array_merge($up, $down) as $statement) {
            self::assertStringNotContainsString('magic_super_magic_claw', $statement['query']);
            self::assertStringContainsString('magic_claw_permission_reconciliation', $statement['query']);
        }
        self::assertSame(
            ['id', 'organization_code', 'user_id', 'project_id', 'deleted_at', 'updated_at'],
            array_column($this->db->getPdo()->query('PRAGMA table_info(magic_super_magic_claw)')->fetchAll(PDO::FETCH_ASSOC), 'name')
        );
    }

    public function testConverterBindingDoesNotCreateAStopOperationOrAffectItsProgress(): void
    {
        $this->repository->bindConverter(1, 'actual-converter');
        self::assertSame('actual-converter', $this->repository->converterSandbox(1));
        self::assertNull($this->service->status('org'));
        self::assertSame([], $this->repository->activeOperations(10));
        self::assertSame('0', $this->repository->pauseRevision(1));
        $operation = $this->repository->create('org', 'admin', 'policy_changed');
        self::assertSame(0, $this->repository->summarize($operation)['stopped_count']);
        self::assertNull($this->repository->dueItem($operation));
        // An acknowledgement for an old binding cannot delete its replacement.
        $this->repository->bindConverter(1, 'replacement-converter');
        $this->repository->clearConverter(1, 'actual-converter');
        self::assertSame('replacement-converter', $this->repository->converterSandbox(1));
    }

    #[DataProvider('fetchModes')]
    public function testProgressSupportsBothFetchModes(bool $associative): void
    {
        if ($associative) {
            $listener = new FetchModeListener();
            $events = $this->createMock(EventDispatcherInterface::class);
            $events->method('dispatch')->willReturnCallback(static function (object $event) use ($listener): object {
                $listener->process($event);
                return $event;
            });
            $this->db->setEventDispatcher($events);
        }

        $operation = $this->repository->create('org', 'admin', 'policy_changed');
        foreach ([1 => ['stopped', 'stopped'], 2 => ['failed', 'stopped'], 3 => ['pending'], 4 => ['skipped'], 5 => ['stopped', 'pending']] as $clawId => $states) {
            foreach ($states as $topicId => $state) {
                $this->db->table('magic_claw_permission_reconciliation_items')->insert([
                    'operation_id' => $operation['id'], 'claw_id' => $clawId, 'topic_id' => $topicId, 'status' => $state,
                ]);
            }
        }
        self::assertNull($this->repository->summarize($operation)['affected_count']);
        $operation['scan_completed'] = true;
        self::assertSame([
            'operation_id' => (string) $operation['id'], 'policy_revision' => (string) $operation['id'],
            'status' => 'running', 'affected_count' => 5, 'stopped_count' => 1, 'failed_count' => 1, 'skipped_count' => 1,
        ], $this->repository->summarize($operation));

        $this->db->table('magic_claw_permission_reconciliation_items')->where('status', 'pending')->update(['status' => 'stopped']);
        $progress = $this->repository->summarize($operation);
        self::assertSame('partial_failed', $progress['status']);
        self::assertSame(3, $progress['stopped_count']);
        self::assertSame(1, $progress['failed_count']);

        $this->db->table('magic_claw_permission_reconciliation_items')->where('status', 'failed')->update(['status' => 'stopped']);
        $progress = $this->repository->summarize($operation);
        self::assertSame('completed', $progress['status']);
        self::assertSame(4, $progress['stopped_count']);
        self::assertSame(0, $progress['failed_count']);
        self::assertSame(1, $progress['skipped_count']);
        $operation['status'] = 'superseded';
        self::assertSame('superseded', $this->repository->summarize($operation)['status']);
    }

    public static function fetchModes(): array
    {
        return ['default objects' => [false], 'production associative arrays' => [true]];
    }

    public function testResumeKeepsNewerPausesAndPreservesStopHistory(): void
    {
        $old = $this->repository->create('org', 'admin', 'policy_changed');
        $this->repository->enqueue($old, ['id' => 1], ['id' => 20]);
        $this->repository->requireManualStart($this->repository->dueItem($old));
        $observed = $this->repository->pauseRevision(1);
        $new = $this->repository->create('org', 'admin', 'policy_changed');
        $this->repository->enqueue($new, ['id' => 1], ['id' => 20]);
        $this->repository->requireManualStart($this->repository->dueItem($new));
        self::assertFalse($this->repository->resumeAfterStart(1, $observed));
        self::assertSame((string) $new['id'], $this->repository->pauseRevision(1));
        self::assertTrue($this->repository->resumeAfterStart(1, (string) $new['id']));
        self::assertSame('0', $this->repository->pauseRevision(1));
        self::assertSame('pending', $this->repository->dueItem($new)['status']);
        self::assertSame(2, $this->db->table('magic_claw_permission_reconciliation_items')->count());
    }

    public function testLateRevocationReopensCompletedWorkAndRetainsConverterAfterFailedCleanup(): void
    {
        $operation = $this->repository->create('org', 'admin', 'policy_changed');
        $this->repository->updateOperation($operation, ['status' => 'completed', 'scan_completed' => true]);
        $claw = new MagicClawEntity(['id' => 1, 'organization_code' => 'org', 'user_id' => 'owner']);
        $this->repository->recordRuntimeDenial($claw, 0, 'actual-late-converter');
        self::assertSame('running', $this->service->status('org')['status']);
        self::assertSame((string) $operation['id'], $this->repository->pauseRevision(1));
        $this->agent->method('stopSandboxIfExists')->willThrowException(new SandboxOperationException('stop', 'timeout', 500));
        $this->service->executeForOrganization('org');
        self::assertSame('actual-late-converter', $this->repository->converterSandbox(1));
        self::assertSame('partial_failed', $this->service->status('org')['status']);
        self::assertSame('actual-late-converter', $this->db->table('magic_claw_permission_reconciliation_items')
            ->where('operation_id', $operation['id'])->value('sandbox_id'));
    }

    public function testPermissionEventRecordsWorkAtomicallyWithoutStoppingResources(): void
    {
        $listener = new ClawFunctionPermissionChangedListener($this->service);
        $event = new FunctionPermissionChanged('org', 'admin', ['magic_claw.access']);
        $this->agent->expects(self::never())->method('stopSandboxIfExists');
        try {
            $this->db->transaction(function () use ($listener, $event): void {
                $this->db->table('policy_test')->insert(['value' => 'deny']);
                $listener->process($event);
                self::assertNotNull($this->repository->latest('org'));
                throw new RuntimeException('save failed');
            });
            self::fail('Expected rollback');
        } catch (RuntimeException $exception) {
            self::assertSame('save failed', $exception->getMessage());
        }
        self::assertSame(0, $this->db->table('policy_test')->count());
        self::assertNull($this->repository->latest('org'));
        $this->db->transaction(function () use ($listener, $event): void {
            $this->db->table('policy_test')->insert(['value' => 'deny']);
            $listener->process($event);
        });
        self::assertSame(1, $this->db->table('policy_test')->count());
        self::assertSame('admin', $this->repository->latest('org')['actor']);
    }

    public function testDirectoryRollbackDoesNotCreateOrRunAReconciliation(): void
    {
        $this->db->statement('CREATE TABLE magic_contact_department_users (id TEXT PRIMARY KEY, magic_id TEXT, user_id TEXT, organization_code TEXT, department_id TEXT, job_title TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT)');
        $memberships = new MagicDepartmentUserRepository(new DepartmentUserModel());
        try {
            $this->db->transaction(function () use ($memberships): void {
                $memberships->createDepartmentUsers([['id' => '1', 'magic_id' => 'm1', 'user_id' => 'owner', 'organization_code' => 'org', 'department_id' => 'd1']]);
                self::assertNull($this->repository->latest('org'));
                throw new RuntimeException('sync failed');
            });
            self::fail('Expected rollback');
        } catch (RuntimeException $exception) {
            self::assertSame('sync failed', $exception->getMessage());
        }
        self::assertSame(0, $this->db->table('magic_contact_department_users')->count());
        self::assertNull($this->repository->latest('org'));
        self::assertSame('warm-pool-real-id', $this->repository->topic(20)['sandbox_id']);
    }

    public function testRepairPreviewIsReadOnlyAndOrganizationScoped(): void
    {
        $this->agent->expects(self::never())->method('stopSandboxIfExists');
        $this->db->table('magic_super_magic_claw')->insert(['id' => 2, 'organization_code' => 'other-org', 'user_id' => 'other', 'project_id' => 11]);
        self::assertSame([['claw_id' => '1', 'user_id' => 'owner', 'topic_id' => '20', 'sandbox_id' => 'warm-pool-real-id']], iterator_to_array($this->service->preview('org')));
        self::assertNull($this->repository->latest('org'));
        self::assertSame('0', $this->repository->pauseRevision(1));
        $this->allowed = true;
        self::assertSame([], iterator_to_array($this->service->preview('org')));
    }

    public function testDefaultBatchProcessesMultipleResources(): void
    {
        $this->repository->create('org', 'admin', 'policy_changed');
        $this->service->executeForOrganization('org');
        self::assertSame('completed', $this->service->status('org')['status']);
        self::assertSame(1, $this->service->status('org')['stopped_count']);
    }

    public function testStopsRealBindingThenCancelsQueuesAndCompletesOnlyAfterAllResources(): void
    {
        $this->agent->expects(self::once())->method('stopSandboxIfExists')->with('warm-pool-real-id');
        $this->tasks->expects(self::once())->method('updateTaskStatusByTopicIds')->with(
            [20],
            TaskStatus::Stopped,
            'Magic Claw access revoked',
            [TaskStatus::WAITING, TaskStatus::RUNNING, TaskStatus::WAITING_FOR_USER]
        );
        $this->db->table('magic_super_agent_message_queue')->insert([
            ['id' => 1, 'topic_id' => 20, 'organization_code' => 'org', 'status' => 0],
            ['id' => 2, 'topic_id' => 20, 'organization_code' => 'org', 'status' => 1],
        ]);
        $this->repository->create('org', 'admin', 'policy_changed');
        $this->service->executeForOrganization('org', 1);
        self::assertSame('', $this->repository->topic(20)['sandbox_id']);
        self::assertSame('running', $this->service->status('org')['status']);
        self::assertNotSame('0', $this->repository->pauseRevision(1));
        self::assertSame(2, (int) $this->db->table('magic_super_agent_message_queue')->where('id', 1)->value('status'));
        self::assertSame(1, (int) $this->db->table('magic_super_agent_message_queue')->where('id', 2)->value('status'));
        $this->service->executeForOrganization('org', 1);
        self::assertSame('completed', $this->service->status('org')['status']);
        self::assertSame(1, $this->service->status('org')['stopped_count']);
    }

    public function testGatewayFailureRetainsBindingAndRetriesWithoutClaimingSuccess(): void
    {
        $this->db->table('magic_super_agent_message_queue')->insert(['id' => 1, 'topic_id' => 20, 'organization_code' => 'org', 'status' => 0]);
        $this->agent->method('stopSandboxIfExists')->willThrowException(new SandboxOperationException('stop', 'timeout', 500));
        $this->repository->create('org', 'admin', 'policy_changed');
        $this->service->executeForOrganization('org', 1);
        $this->service->executeForOrganization('org', 1);
        self::assertSame('warm-pool-real-id', $this->repository->topic(20)['sandbox_id']);
        self::assertSame('partial_failed', $this->service->status('org')['status']);
        self::assertSame(1, $this->service->status('org')['failed_count']);
        self::assertSame(0, $this->service->status('org')['stopped_count']);
        self::assertSame(2, (int) $this->db->table('magic_super_agent_message_queue')->where('id', 1)->value('status'));
    }

    public function testNotFoundIsConfirmedStopAndAuxiliarySandboxIsIncluded(): void
    {
        $this->repository->bindConverter(1, 'converter-real-id');
        $this->agent->expects(self::exactly(2))->method('stopSandboxIfExists')->willReturn(new GatewayResult(ResponseCode::SUCCESS, 'already absent'));
        $this->repository->create('org', 'admin', 'policy_changed');
        $this->service->executeForOrganization('org', 1);
        $this->service->executeForOrganization('org', 1);
        self::assertSame('completed', $this->service->status('org')['status']);
        self::assertSame('', $this->repository->converterSandbox(1));
    }

    public function testRegrantSkipsQueuedStopAndNeverStartsAnything(): void
    {
        $operation = $this->repository->create('org', 'admin', 'policy_changed');
        $this->repository->enqueue($operation, $this->repository->claw(1), $this->repository->topic(20));
        $this->allowed = true;
        $this->agent->expects(self::never())->method('stopSandboxIfExists');
        $this->service->executeForOrganization('org', 1);
        self::assertSame('completed', $this->service->status('org')['status']);
        self::assertSame('warm-pool-real-id', $this->repository->topic(20)['sandbox_id']);
        self::assertSame('0', $this->repository->pauseRevision(1));
        self::assertSame(1, $this->service->status('org')['skipped_count']);
    }

    public function testNewPolicySupersedesOldWorkAndLeaseIsOwnerChecked(): void
    {
        $old = $this->repository->create('org', 'admin', 'policy_changed');
        self::assertTrue($this->repository->claim($old, 'worker-one'));
        self::assertFalse($this->repository->claim($old, 'worker-two'));
        $this->repository->release($old, 'worker-two');
        self::assertFalse($this->repository->claim($old, 'worker-two'));
        $new = $this->repository->create('org', 'admin', 'policy_changed');
        self::assertFalse($this->repository->isCurrent($old));
        self::assertTrue($this->repository->isCurrent($new));
        $this->repository->updateOperation($old, ['status' => 'completed']);
        self::assertSame('superseded', $this->db->table('magic_claw_permission_reconciliations')->where('id', $old['id'])->value('status'));
    }

    public function testCompensationOnlyNotifiesDueWorkWithoutCallingTheGateway(): void
    {
        $operation = $this->repository->create('org', 'admin', 'policy_changed');
        $this->agent->expects(self::never())->method('stopSandboxIfExists');
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $notified = [];
        $dispatcher->method('dispatch')->willReturnCallback(static function (object $event) use (&$notified): object {
            if ($event instanceof ClawPermissionReconciliationRequestedEvent) {
                $notified[] = $event->organizationCode;
            }
            return $event;
        });
        $this->setService(EventDispatcherInterface::class, $dispatcher);
        $this->service->execute();
        self::assertSame('pending', $this->repository->latest('org')['status']);
        $this->repository->enqueue($operation, $this->repository->claw(1), $this->repository->topic(20));
        $this->db->table('magic_claw_permission_reconciliation_items')->update(['status' => 'failed', 'next_retry_at' => time() + 600]);
        $this->repository->updateOperation($operation, ['scan_completed' => true, 'status' => 'partial_failed']);
        self::assertSame([], $this->repository->activeOperations(5));
        $this->service->execute();
        self::assertSame(['org'], $notified);
    }

    public function testOccupiedWorkerSlotsLeaveDurableWorkForCompensation(): void
    {
        $locker = $this->createMock(LockerInterface::class);
        $locker->expects(self::exactly(2))->method('mutexLock')->willReturn(false);
        $service = new MagicClawReconciliationAppService($this->repository, $this->policy, $this->agent, $this->createMock(TaskDomainService::class), $this->createMock(SandboxLifecycleLock::class), $locker);
        $this->repository->create('org', 'admin', 'policy_changed');
        $this->agent->expects(self::never())->method('stopSandboxIfExists');
        self::assertFalse($service->executeForOrganization('org'));
        self::assertSame(0, (int) $this->repository->latest('org')['lease_until']);
        self::assertFalse((bool) $this->repository->latest('org')['scan_completed']);
    }

    public function testDeletedClawStopsEveryResourceEvenWhenOwnerStillHasPermission(): void
    {
        $this->allowed = true;
        $this->db->table('magic_super_magic_claw')->where('id', 1)->update(['deleted_at' => '2026-10-19 00:00:00']);
        $this->repository->bindConverter(1, 'converter');
        $this->db->table('magic_super_agent_topics')->insert(['id' => 21, 'user_organization_code' => 'org', 'user_id' => 'owner', 'project_id' => 10, 'sandbox_id' => 'second-real-id']);
        $this->agent->expects(self::exactly(3))->method('stopSandboxIfExists');
        $this->repository->create('org', 'admin', 'claw_deleted');
        self::assertFalse($this->service->executeForOrganization('org'));
        self::assertSame('completed', $this->service->status('org')['status']);
        self::assertSame('', $this->repository->topic(21)['sandbox_id']);
        self::assertSame('', $this->repository->converterSandbox(1));
        // Replayed events do not scan or stop completed resources again.
        self::assertFalse($this->service->executeForOrganization('org'));
        self::assertSame([], $this->repository->claws('org', 0));
    }

    public function testMembershipBatchNotifiesOncePerOrganizationInTheRequest(): void
    {
        $this->db->statement('CREATE TABLE magic_contact_department_users (id TEXT PRIMARY KEY, magic_id TEXT, user_id TEXT, organization_code TEXT, department_id TEXT, job_title TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT)');
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $notifications = 0;
        $dispatcher->method('dispatch')->willReturnCallback(static function (object $event) use (&$notifications): object {
            if ($event instanceof DepartmentMembershipChanged) {
                ++$notifications;
            }
            return $event;
        });
        $this->setService(EventDispatcherInterface::class, $dispatcher);
        $memberships = new MagicDepartmentUserRepository(new DepartmentUserModel());
        $memberships->createDepartmentUsers([['id' => '1', 'magic_id' => 'm1', 'user_id' => 'owner', 'organization_code' => 'org', 'department_id' => 'd1']]);
        $memberships->updateDepartmentUser('1', ['department_id' => 'd2']);
        $memberships->deleteDepartmentUsersByDepartmentIds(['d2'], 'org');
        self::assertNull($this->repository->latest('org'));
        self::assertSame(1, $notifications);
    }

    public function testLargeClawScansTopicsInBoundedPagesWithoutLosingProgress(): void
    {
        $rows = [];
        for ($id = 21; $id <= 50; ++$id) {
            $rows[] = ['id' => $id, 'user_organization_code' => 'org', 'user_id' => 'owner', 'project_id' => 10, 'sandbox_id' => 'pod-' . $id];
        }
        $this->db->table('magic_super_agent_topics')->insert($rows);
        $this->repository->create('org', 'admin', 'policy_changed');
        self::assertTrue($this->service->executeForOrganization('org'));
        self::assertSame(25, $this->db->table('magic_claw_permission_reconciliation_items')->count());
        self::assertNull($this->service->status('org')['affected_count']);
        while ($this->service->executeForOrganization('org'));

        self::assertSame(32, $this->db->table('magic_claw_permission_reconciliation_items')->count());
        self::assertSame('completed', $this->service->status('org')['status']);
        self::assertSame(0, $this->db->table('magic_super_agent_topics')->where('sandbox_id', '!=', '')->count());
    }

    public function testCrossOrganizationCannotBeStoppedEvenWithCorruptItem(): void
    {
        $operation = $this->repository->create('other-org', 'admin', 'policy_changed');
        $this->repository->enqueue($operation, $this->repository->claw(1), $this->repository->topic(20));
        $this->agent->expects(self::never())->method('stopSandboxIfExists');
        $this->service->executeForOrganization('other-org', 1);
        self::assertSame('warm-pool-real-id', $this->repository->topic(20)['sandbox_id']);
        self::assertSame('partial_failed', $this->service->status('other-org')['status']);
    }

    private function setService(string $name, object $service): void
    {
        $container = ApplicationContext::getContainer();
        $property = (new ReflectionObject($container))->getProperty('services');
        $services = $property->getValue($container);
        $services[$name] = $service;
        $property->setValue($container, $services);
    }
}
