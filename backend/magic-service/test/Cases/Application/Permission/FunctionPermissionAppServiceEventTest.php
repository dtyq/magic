<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\Permission\Service\FunctionPermissionAppService;
use App\Domain\Admin\Entity\AdminGlobalSettingsEntity;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Repository\Facade\AdminGlobalSettingsRepositoryInterface;
use App\Domain\Admin\Service\AdminGlobalSettingsDomainService;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Event\FunctionPermissionChanged;
use App\Domain\Permission\Repository\Persistence\FunctionPermissionPolicyRepository;
use App\Domain\Permission\Service\FunctionPermissionDomainService;
use Hyperf\Context\ApplicationContext;
use Hyperf\Database\ConnectionResolver;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\Model\Register;
use Hyperf\Database\MySqlConnection;
use Hyperf\DbConnection\Db;
use HyperfTest\Support\MagicClawTestEnvironment;
use PDO;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;
use RuntimeException;

/** @internal */
final class FunctionPermissionAppServiceEventTest extends TestCase
{
    use MagicClawTestEnvironment;

    private MySqlConnection $db;

    private FunctionPermissionDomainService $domain;

    private FunctionPermissionAppService $service;

    private EventDispatcherInterface $dispatcher;

    private array $events = [];

    protected function setUp(): void
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->exec('CREATE TABLE policy_test (value TEXT)');
        $this->db = new MySqlConnection($pdo, 'memory');
        $resolver = new ConnectionResolver(['default' => $this->db]);
        Register::setConnectionResolver($resolver);
        $this->dispatcher = $this->createMock(EventDispatcherInterface::class);
        $container = $this->prepareClawEnvironment([ConnectionResolverInterface::class => $resolver]);
        $db = new Db($container);
        $this->prepareClawEnvironment([Db::class => $db, EventDispatcherInterface::class => $this->dispatcher]);
        $this->dispatcher->method('dispatch')->willReturnCallback(function (object $event): object {
            self::assertInstanceOf(FunctionPermissionChanged::class, $event);
            self::assertGreaterThan(0, $this->db->transactionLevel());
            $this->events[] = $event;
            return $event;
        });
        $repository = $this->createMock(FunctionPermissionPolicyRepository::class);
        $repository->method('getByFunctionCode')->willReturn(null);
        $repository->method('listByOrganization')->willReturn([]);
        $repository->method('save')->willReturnCallback(function ($entity) {
            $this->db->table('policy_test')->insert(['value' => $entity->getFunctionCode()]);
            return $entity;
        });
        $repository->method('saveBatch')->willReturnCallback(static fn ($entities) => $entities);
        $settings = $this->createMock(AdminGlobalSettingsRepositoryInterface::class);
        $settings->method('getSettingsByTypeAndOrganization')->willReturn(
            (new AdminGlobalSettingsEntity())->setType(AdminGlobalSettingsType::FUNCTION_PERMISSION_CONTROL)->setOrganization('org')->setStatus(AdminGlobalSettingsStatus::ENABLED)
        );
        $settings->method('updateSettings')->willReturnCallback(static fn ($entity) => $entity);
        $this->domain = new FunctionPermissionDomainService($repository, new AdminGlobalSettingsDomainService($settings), new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class)));
        $this->service = new FunctionPermissionAppService($this->domain, $this->createMock(MagicDepartmentDomainService::class), $this->createMock(MagicUserInfoAppService::class));
    }

    protected function tearDown(): void
    {
        Register::unsetConnectionResolver();
    }

    public function testSingleSaveEmitsGenericEventWithoutBusinessResponseFields(): void
    {
        $response = $this->service->save($this->isolation(), 'skill.create', true, ['type' => 'organization_all']);
        self::assertSame('skill.create', $response['function_code']);
        self::assertArrayNotHasKey('runtime_reconciliation', $response);
        $this->assertEvent(['skill.create']);
        self::assertSame(1, $this->db->table('policy_test')->count());
    }

    public function testEnabledSaveEmitsChangedFunction(): void
    {
        $this->service->updateEnabled($this->isolation(), 'skill.create', true);
        $this->assertEvent(['skill.create']);
    }

    public function testBatchEmitsOneEventForAllDistinctChangedFunctions(): void
    {
        $response = $this->service->batchSave($this->isolation(), [
            ['function_code' => 'skill.create'], ['function_code' => 'magic_claw.access'], ['function_code' => 'skill.create'],
        ]);
        self::assertSame(3, $response['saved_count']);
        self::assertArrayNotHasKey('runtime_reconciliation', $response);
        $this->assertEvent(['skill.create', 'magic_claw.access']);
    }

    public function testGlobalControlChangeDoesNotNameAnyBusinessFunction(): void
    {
        self::assertSame(['permission_control_status' => 'disabled'], $this->service->updateSettings($this->isolation(), PermissionControlStatus::DISABLED));
        $this->assertEvent(null);
    }

    public function testReadApisNeedNoClawServiceAndDoNotEmitChanges(): void
    {
        $response = $this->service->queries($this->isolation());
        foreach ($response['list'] as $item) {
            self::assertArrayNotHasKey('runtime_reconciliation', $item);
        }
        self::assertArrayNotHasKey('runtime_reconciliation', $this->service->show($this->isolation(), 'magic_claw.access')['function']);
        self::assertSame([], $this->events);
    }

    public function testListenerFailureRollsBackPermissionWrite(): void
    {
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->method('dispatch')->willThrowException(new RuntimeException('work record unavailable'));
        $container = ApplicationContext::getContainer();
        $this->prepareClawEnvironment([Db::class => $container->get(Db::class), EventDispatcherInterface::class => $dispatcher]);
        try {
            $this->service->save($this->isolation(), 'skill.create', true, ['type' => 'organization_all']);
            self::fail('Expected rollback');
        } catch (RuntimeException $exception) {
            self::assertSame('work record unavailable', $exception->getMessage());
        }
        self::assertSame(0, $this->db->table('policy_test')->count());
    }

    private function assertEvent(?array $functionCodes): void
    {
        self::assertCount(1, $this->events);
        self::assertSame('org', $this->events[0]->organizationCode);
        self::assertSame('admin', $this->events[0]->actor);
        self::assertSame($functionCodes, $this->events[0]->functionCodes);
    }

    private function isolation(): PermissionDataIsolation
    {
        return PermissionDataIsolation::create('org', 'admin', 'magic-id');
    }
}
