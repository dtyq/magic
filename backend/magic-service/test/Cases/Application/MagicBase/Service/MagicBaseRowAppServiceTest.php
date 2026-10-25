<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\MagicBase\Service;

use App\Application\MagicBase\DTO\BatchCreateRowsRequestDTO;
use App\Application\MagicBase\DTO\CreateRowRequestDTO;
use App\Application\MagicBase\Service\MagicBaseRowAppService;
use App\Application\MagicBase\Support\MagicBaseAccessControl;
use App\Application\MagicBase\Support\MagicBaseRowQuerySupport;
use App\Application\MagicBase\Support\SelectParser;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\MagicBase\Entity\MagicBaseColumnEntity;
use App\Domain\MagicBase\Entity\MagicBaseRelationEntity;
use App\Domain\MagicBase\Entity\MagicBaseRowEntity;
use App\Domain\MagicBase\Entity\MagicBaseTableEntity;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseConst;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseEntityCollection;
use App\Domain\MagicBase\Repository\Facade\MagicBaseMigrationLogRepositoryInterface;
use App\Domain\MagicBase\Repository\Facade\MagicBasePermissionRepositoryInterface;
use App\Domain\MagicBase\Repository\Facade\MagicBaseRelationRepositoryInterface;
use App\Domain\MagicBase\Repository\Facade\MagicBaseTableRepositoryInterface;
use App\Domain\MagicBase\Service\MagicBaseMetadataDomainService;
use App\Domain\MagicBase\Service\MagicBasePermissionDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowFilterDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowQueryCriteriaDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowStorageResolverDomainService;
use App\Domain\MagicBase\Service\MagicBaseSelectParserDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\ErrorCode\MagicBaseErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Database\ConnectionInterface;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Snowflake\IdGeneratorInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;

/** @internal */
class MagicBaseRowAppServiceTest extends TestCase
{
    private MagicBaseAccessControl $access;

    private MagicBaseRowAppService $service;

    private RowPermissionStorageStub $storage;

    private MagicBaseTableEntity $table;

    private ?MagicBaseTableEntity $relatedTable = null;

    private MagicBaseRelationRepositoryInterface $relations;

    private MagicBaseColumnEntity $column;

    private ?MagicBaseColumnEntity $relatedColumn = null;

    private PublishedMicroAppFileAccessService $publication;

    private MagicBaseTableRepositoryInterface $tables;

    private ProjectMemberDomainService $members;

    private ProjectEntity $project;

    private ?ContainerInterface $previousContainer = null;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static fn ($key, $default = null) => match ($key) {
            'error_message' => ['error_code_mapper' => [MagicBaseErrorCode::class => [48000, 48999]]],
            'app_env' => 'testing',
            default => $default,
        });
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnArgument(0);
        $agent = $this->createMock(AgentDomainService::class);
        $agent->method('getAuthorizationByUserId')->willReturn('test-token');
        $ids = $this->createMock(IdGeneratorInterface::class);
        $ids->method('generate')->willReturnOnConsecutiveCalls(103, 104);
        $container = $this->createMock(ContainerInterface::class);
        $connection = $this->createMock(ConnectionInterface::class);
        // Execute the real application callback without requiring a database server.
        $connection->method('transaction')->willReturnCallback(static fn ($callback) => $callback());
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($connection);
        $container->method('get')->willReturnMap([
            [ConfigInterface::class, $config], [TranslatorInterface::class, $translator],
            [AgentDomainService::class, $agent], [ConnectionResolverInterface::class, $resolver],
            [Db::class, new Db($container)], [IdGeneratorInterface::class, $ids],
        ]);
        ApplicationContext::setContainer($container);
        Context::set('magicbase.share_access_project_ids', []);
        Context::set('magicbase.share_access_actors', []);

        $this->project = (new ProjectEntity())->setId(11)->setUserId('owner')->setCreatedUid('owner')->setUserOrganizationCode('org');
        $projects = $this->createMock(ProjectDomainService::class);
        $projects->method('getProjectsByIds')->with([11])->willReturn([$this->project]);
        $this->members = $this->createMock(ProjectMemberDomainService::class);
        $departments = new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class));
        $this->publication = $this->createMock(PublishedMicroAppFileAccessService::class);
        $this->tables = $this->createMock(MagicBaseTableRepositoryInterface::class);
        $this->relations = $this->createMock(MagicBaseRelationRepositoryInterface::class);
        $metadata = new MagicBaseMetadataDomainService(
            $this->tables,
            $this->relations,
            $this->createMock(MagicBasePermissionRepositoryInterface::class),
            $this->createMock(MagicBaseMigrationLogRepositoryInterface::class),
        );
        $this->storage = new RowPermissionStorageStub();
        $this->access = new MagicBaseAccessControl(
            $metadata,
            new MagicBasePermissionDomainService(),
            $this->storage,
            $projects,
            $this->members,
            $departments,
            $this->createMock(MicroAppRepositoryInterface::class),
            $this->publication,
        );
        $this->publication->method('canAccessProject')->with(11, 'reader', 'org')->willReturn(true);
        $this->table = new MagicBaseTableEntity();
        $this->table->setDynamicPermissions(['table' => ['insert_scope' => MagicBaseConst::SCOPE_PUBLIC]]);
        $this->table->setId(22);
        $this->tables->method('getTable')->willReturnCallback(fn ($org, $project, $id) => $id === 22 ? $this->table : $this->relatedTable);
        $this->column = new MagicBaseColumnEntity(['id' => 33, 'column_key' => 'title', 'data_type' => 'text']);
        $this->tables->method('listColumns')->willReturnCallback(fn ($org, $tableId) => new MagicBaseEntityCollection([$tableId === 23 && $this->relatedColumn !== null ? $this->relatedColumn : $this->column]));
        $this->service = new MagicBaseRowAppService(
            $this->access,
            new MagicBaseRowQuerySupport(
                $metadata,
                $this->access,
                $this->storage,
                new MagicBaseRowQueryCriteriaDomainService(new MagicBaseRowFilterDomainService()),
                new MagicBasePermissionDomainService(),
            ),
            new MagicBaseRowDomainService(),
            $this->storage,
            new MagicBaseSelectParserDomainService(new SelectParser()),
        );
    }

    protected function tearDown(): void
    {
        (new ReflectionClass(ApplicationContext::class))->getProperty('container')->setValue(null, $this->previousContainer);
        Context::destroy('magicbase.share_access_project_ids');
        Context::destroy('magicbase.share_access_actors');
    }

    public function testPublishedUserCannotBatchInsertWhenInsertScopeIsDisabled(): void
    {
        $this->table->setDynamicPermissions(['table' => ['insert_scope' => MagicBaseConst::SCOPE_DISABLED]]);
        $this->storage->state->rejectWrites = true;
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->service->batchCreateRows($this->reader(), 11, 22, new BatchCreateRowsRequestDTO([[], []]));
    }

    public function testBatchDeleteChecksEveryRowBeforeSavingAnyRow(): void
    {
        $this->table->setDynamicPermissions(['row' => ['delete_scope' => MagicBaseConst::SCOPE_PRIVATE_USER]]);
        $own = $this->row(101, 'reader');
        $other = $this->row(102, 'owner');
        $this->storage->state->rows = [101 => $own, 102 => $other];
        $this->storage->state->rejectWrites = true;
        try {
            $this->service->batchDeleteRows($this->reader(), 11, 22, [101, 102]);
            self::fail('A published user must not delete another user private row.');
        } catch (BusinessException $exception) {
            self::assertSame(MagicBaseErrorCode::AccessDenied->value, $exception->getCode());
            self::assertFalse($own->getDeleted());
            self::assertFalse($other->getDeleted());
            self::assertSame(['authorize:101', 'authorize:102'], $this->storage->state->events);
        }
    }

    public function testPublishedUserCanBatchDeleteOwnRowsWithoutBecomingAdministrator(): void
    {
        $this->table->setDynamicPermissions(['row' => ['delete_scope' => MagicBaseConst::SCOPE_PRIVATE_USER]]);
        $rows = [101 => $this->row(101, 'reader'), 102 => $this->row(102, 'reader')];
        $this->storage->state->rows = $rows;
        self::assertSame(
            ['deleted_count' => 2, 'record_ids' => ['101', '102']],
            $this->service->batchDeleteRows($this->reader(), 11, 22, [101, 102]),
        );
        self::assertSame(['authorize:101', 'authorize:102', 'save:101', 'save:102'], $this->storage->state->events);
        self::assertFalse($this->access->isProjectDataAdmin($this->reader(), 11));
    }

    public function testPublishedUserCannotUpdateAnotherUsersPrivateRow(): void
    {
        $this->table->setDynamicPermissions(['row' => ['edit_scope' => MagicBaseConst::SCOPE_PRIVATE_USER]]);
        $this->storage->state->rows = [101 => $this->row(101, 'owner')];
        $this->storage->state->rejectWrites = true;
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->service->updateRow($this->reader(), 11, 22, 101, new CreateRowRequestDTO([]));
    }

    public function testPublishedUserCreatesRowAsTheRealActor(): void
    {
        $row = $this->service->createRow($this->reader(), 11, 22, new CreateRowRequestDTO(['title' => 'New row']));
        self::assertSame('103', $row->toArray()['id']);
        self::assertSame('reader', $row->toArray()['created_by']);
        self::assertSame('New row', $row->toArray()['title']);
        self::assertSame(11, $this->storage->state->rows[103]->getProjectId());
        self::assertSame(22, $this->storage->state->rows[103]->getTableId());
        self::assertFalse($this->access->isProjectDataAdmin($this->reader(), 11));
    }

    public function testPublishedUserUpdatesOwnRowWhenColumnAllowsEdit(): void
    {
        $this->table->setDynamicPermissions(['row' => ['edit_scope' => MagicBaseConst::SCOPE_PRIVATE_USER]]);
        $this->storage->state->rows = [101 => $this->row(101, 'reader')];
        $result = $this->service->updateRow($this->reader(), 11, 22, 101, new CreateRowRequestDTO(['title' => 'Changed']));
        self::assertSame('Changed', $result->toArray()['title']);
        self::assertSame('reader', $result->toArray()['created_by']);
        self::assertSame(['authorize:101', 'save:101'], $this->storage->state->events);
        self::assertFalse($this->access->isProjectDataAdmin($this->reader(), 11));
    }

    public function testPublishedUserCanUpdateWithoutReadingTheRowBack(): void
    {
        $this->table->setDynamicPermissions(['row' => [
            'edit_scope' => MagicBaseConst::SCOPE_PRIVATE_USER,
            'read_scope' => MagicBaseConst::SCOPE_DISABLED,
        ]]);
        $this->storage->state->rows = [101 => $this->row(101, 'reader')];
        $result = $this->service->updateRow($this->reader(), 11, 22, 101, new CreateRowRequestDTO(['title' => 'Changed']));
        self::assertSame(['id' => '101'], $result->toArray());
        self::assertSame(['title' => 'Changed'], $this->storage->state->rows[101]->getData());
    }

    public function testPublishedUserCannotUpdateDisabledColumnEvenOnOwnRow(): void
    {
        $this->table->setDynamicPermissions(['row' => ['edit_scope' => MagicBaseConst::SCOPE_PRIVATE_USER]]);
        $this->column->setDynamicPermission(['edit_scope' => MagicBaseConst::SCOPE_DISABLED]);
        $this->storage->state->rows = [101 => $this->row(101, 'reader')];
        $this->storage->state->rejectWrites = true;
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicBaseErrorCode::AccessDenied->value);
        $this->service->updateRow($this->reader(), 11, 22, 101, new CreateRowRequestDTO(['title' => 'Forbidden']));
    }

    #[DataProvider('writeOperationsWithRelation')]
    public function testSuccessfulWriteOmitsUnreadableRelation(string $operation, bool $denyColumn): void
    {
        $this->relatedTable = new MagicBaseTableEntity(['id' => 23, 'project_id' => 11, 'dynamic_permissions' => ['table' => ['read_scope' => $denyColumn ? MagicBaseConst::SCOPE_PUBLIC : MagicBaseConst::SCOPE_DISABLED]]]);
        $this->relatedColumn = new MagicBaseColumnEntity(['id' => 34, 'column_key' => 'join_key', 'data_type' => 'text', 'dynamic_permission' => ['read_scope' => MagicBaseConst::SCOPE_DISABLED]]);
        $this->relations->method('listRelations')->willReturn(new MagicBaseEntityCollection([
            new MagicBaseRelationEntity(['source_table_id' => 22, 'target_table_id' => 23, 'relation_name' => 'secret', 'source_column_key' => 'title', 'target_column_key' => $denyColumn ? 'join_key' : 'record_id', 'relation_type' => MagicBaseConst::RELATION_HAS_MANY]),
        ]));
        $select = 'id,title,secret:title(id)';
        if ($operation === 'batch') {
            $result = $this->service->batchCreateRows($this->reader(), 11, 22, new BatchCreateRowsRequestDTO([['title' => 'a'], ['title' => 'b']], $select));
            self::assertSame(2, $result['created_count']);
            self::assertSame(['103', '104'], $result['record_ids']);
            self::assertSame(['id' => '103', 'title' => 'a'], $result['rows'][0]->toArray());
            self::assertSame(['id' => '104', 'title' => 'b'], $result['rows'][1]->toArray());
            self::assertSame(['save:103', 'save:104'], $this->storage->state->events);
            return;
        }
        if ($operation === 'update') {
            $this->storage->state->rows[101] = $this->row(101, 'reader');
            $result = $this->service->updateRow($this->reader(), 11, 22, 101, new CreateRowRequestDTO(['title' => 'a'], $select));
            self::assertSame(['id' => '101', 'title' => 'a'], $result->toArray());
            self::assertSame(['authorize:101', 'save:101'], $this->storage->state->events);
            return;
        }
        $result = $this->service->createRow($this->reader(), 11, 22, new CreateRowRequestDTO(['title' => 'a'], $select));
        self::assertSame(['id' => '103', 'title' => 'a'], $result->toArray());
        self::assertSame(['save:103'], $this->storage->state->events);
    }

    public static function writeOperationsWithRelation(): array
    {
        return [['create', false], ['batch', false], ['update', false], ['create', true], ['batch', true], ['update', true]];
    }

    private function row(int $id, string $owner): MagicBaseRowEntity
    {
        $row = new MagicBaseRowEntity();
        $row->setRecordId($id);
        $row->setCreatedBy($owner);
        return $row;
    }

    private function reader(): MagicUserAuthorization
    {
        return (new MagicUserAuthorization())->setId('reader')->setOrganizationCode('org');
    }
}

/** Test storage keeps row authorization and write order observable without MongoDB. */
readonly class RowPermissionStorageStub extends MagicBaseRowStorageResolverDomainService
{
    public object $state;

    public function __construct()
    {
        $this->state = (object) ['rows' => [], 'events' => [], 'rejectWrites' => false];
    }

    public function getRow(string $dataOrganizationCode, int $projectId, int $tableId, int $recordId): ?MagicBaseRowEntity
    {
        TestCase::assertSame(['org', 11, 22], [$dataOrganizationCode, $projectId, $tableId]);
        $this->state->events[] = 'authorize:' . $recordId;
        return $this->state->rows[$recordId] ?? null;
    }

    public function saveRow(MagicBaseRowEntity $payload): MagicBaseRowEntity
    {
        TestCase::assertFalse($this->state->rejectWrites, 'Unauthorized operations must not reach storage.');
        TestCase::assertSame('reader', $payload->getCreatedBy());
        $this->state->events[] = 'save:' . $payload->getRecordId();
        $this->state->rows[$payload->getRecordId()] = $payload;
        return $payload;
    }

    public function saveRows(array $payloads): array
    {
        return array_map(fn (MagicBaseRowEntity $row) => $this->saveRow($row), $payloads);
    }
}
