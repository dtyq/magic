<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\MagicBase\Support;

use App\Application\MagicBase\Support\MagicBaseAccessControl;
use App\Application\MagicBase\Support\MagicBaseRowQuerySupport;
use App\Domain\MagicBase\Entity\MagicBaseColumnEntity;
use App\Domain\MagicBase\Entity\MagicBaseColumnPermissionEntity;
use App\Domain\MagicBase\Entity\MagicBaseRelationEntity;
use App\Domain\MagicBase\Entity\MagicBaseRowEntity;
use App\Domain\MagicBase\Entity\MagicBaseTableEntity;
use App\Domain\MagicBase\Entity\ValueObject\ActorContext;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseAccessContext;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseColumnIndex;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseConst;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseEntityCollection;
use App\Domain\MagicBase\Entity\ValueObject\MagicBasePermissionIndex;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseTableAccessContext;
use App\Domain\MagicBase\Entity\ValueObject\SelectQuery;
use App\Domain\MagicBase\Exception\MagicBaseColumnAccessDeniedException;
use App\Domain\MagicBase\Repository\Facade\MagicBaseMigrationLogRepositoryInterface;
use App\Domain\MagicBase\Repository\Facade\MagicBasePermissionRepositoryInterface;
use App\Domain\MagicBase\Repository\Facade\MagicBaseRelationRepositoryInterface;
use App\Domain\MagicBase\Repository\Facade\MagicBaseTableRepositoryInterface;
use App\Domain\MagicBase\Service\MagicBaseMetadataDomainService;
use App\Domain\MagicBase\Service\MagicBasePermissionDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowFilterDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowQueryCriteriaDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowStorageResolverDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use RuntimeException;

/** @internal */
class MagicBaseRowQuerySupportTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        ApplicationContext::setContainer($this->createMock(ContainerInterface::class));
    }

    protected function tearDown(): void
    {
        (new ReflectionClass(ApplicationContext::class))->getProperty('container')->setValue(null, $this->previousContainer);
    }

    #[DataProvider('columnAccessCases')]
    public function testSelectedAndDefaultFieldsRespectColumnAccess(string $scope, string $creator, bool $manager, bool $grant, bool $allowed): void
    {
        $column = new MagicBaseColumnEntity(['id' => 10, 'column_key' => 'secret', 'dynamic_permission' => ['read_scope' => $scope]]);
        $permissions = $grant ? [new MagicBaseColumnPermissionEntity(['subject_type' => MagicBaseConst::SUBJECT_USER, 'subject_id' => 'reader', 'can_read' => true])] : [];
        $access = $this->access($column, $permissions, $manager);
        $support = $this->support();
        $row = new MagicBaseRowEntity(['record_id' => 1, 'created_by' => $creator, 'organization_code' => 'org', 'data' => ['secret' => 'hidden value']]);
        foreach ([[], ['record_id', 'secret']] as $fields) {
            $result = $support->formatRow(new MagicUserAuthorization(), 11, new MagicBaseTableEntity(), $row, $access, new SelectQuery(['fields' => $fields]), new ActorContext('reader', 'org'))->toArray();
            self::assertSame('1', $result['record_id']);
            self::assertSame($allowed, array_key_exists('secret', $result));
            if ($allowed) {
                self::assertSame('hidden value', $result['secret']);
            }
        }
    }

    public static function columnAccessCases(): array
    {
        return [
            'private column hidden from another user' => [MagicBaseConst::SCOPE_PRIVATE_USER, 'owner', false, false, false],
            'private column visible to row creator' => [MagicBaseConst::SCOPE_PRIVATE_USER, 'reader', false, false, true],
            'public column' => [MagicBaseConst::SCOPE_PUBLIC, 'owner', false, false, true],
            'disabled column' => [MagicBaseConst::SCOPE_DISABLED, 'owner', false, false, false],
            'explicit grant' => [MagicBaseConst::SCOPE_DISABLED, 'owner', false, true, true],
            'manager' => [MagicBaseConst::SCOPE_DISABLED, 'owner', true, false, true],
        ];
    }

    public function testAnonymousSelectionCannotExposePrivateColumns(): void
    {
        $authorization = (new MagicUserAuthorization())->setId('')->setOrganizationCode('org');
        foreach ([MagicBaseConst::SCOPE_PRIVATE_USER, MagicBaseConst::SCOPE_PRIVATE_ORG, MagicBaseConst::SCOPE_PRIVATE_DEPARTMENT, MagicBaseConst::SCOPE_DISABLED] as $scope) {
            $column = new MagicBaseColumnEntity(['id' => 10, 'column_key' => 'secret', 'dynamic_permission' => ['read_scope' => $scope]]);
            $row = new MagicBaseRowEntity(['record_id' => 1, 'created_by' => 'owner', 'organization_code' => 'org', 'data' => ['secret' => 'hidden']]);
            foreach ([[], ['record_id', 'secret']] as $fields) {
                $result = $this->support()->formatRow($authorization, 11, new MagicBaseTableEntity(), $row, $this->access($column), new SelectQuery(['fields' => $fields]), new ActorContext('', ''))->toArray();
                self::assertArrayNotHasKey('secret', $result, $scope);
            }
        }
    }

    #[DataProvider('anonymousQueryCases')]
    public function testAnonymousQueryCannotInferHiddenColumns(array $filter, array $sort): void
    {
        $column = new MagicBaseColumnEntity(['id' => 10, 'column_key' => 'secret', 'data_type' => 'text', 'dynamic_permission' => ['read_scope' => MagicBaseConst::SCOPE_PRIVATE_ORG]]);
        $criteria = new MagicBaseRowQueryCriteriaDomainService(new MagicBaseRowFilterDomainService());
        $this->expectException(MagicBaseColumnAccessDeniedException::class);
        $criteria->buildReadableQuery('org', new MagicBaseTableEntity(), $this->access($column), new ActorContext('', ''), $filter, $sort, 1, 20);
    }

    public static function anonymousQueryCases(): array
    {
        return [
            [['secret' => ['eq' => 'guess']], []],
            [['logic' => 'or', 'items' => [['field' => 'secret', 'operator' => 'eq', 'value' => 'guess']]], []],
            [[], [['field' => 'secret', 'order' => 'asc']]],
        ];
    }

    public function testAnonymousQueryCanFilterAndSortPublicColumns(): void
    {
        $column = new MagicBaseColumnEntity(['id' => 10, 'column_key' => 'rank', 'data_type' => 'number', 'dynamic_permission' => ['read_scope' => MagicBaseConst::SCOPE_PUBLIC]]);
        $criteria = new MagicBaseRowQueryCriteriaDomainService(new MagicBaseRowFilterDomainService());
        $sort = [['field' => 'rank', 'order' => 'asc']];
        $query = $criteria->buildReadableQuery('org', new MagicBaseTableEntity(), $this->access($column), new ActorContext('', ''), ['rank' => ['lte' => 10]], $sort, 1, 100);
        self::assertSame($sort, $query->getSorts());
    }

    #[DataProvider('unreadableWriteCases')]
    public function testWrittenRowDoesNotExposeUnreadableContentsOrResolveRelations(string $tableScope, string $rowScope): void
    {
        // Uninitialized metadata would fail if a denied write response tried to resolve relations.
        $support = $this->support();
        $table = new MagicBaseTableEntity(['dynamic_permissions' => ['table' => ['read_scope' => $tableScope], 'row' => ['read_scope' => $rowScope]]]);
        $row = new MagicBaseRowEntity(['record_id' => 123, 'created_by' => 'owner', 'data' => ['secret' => 'hidden']]);
        $access = $this->access(new MagicBaseColumnEntity(['id' => 10, 'column_key' => 'secret']));
        $result = $support->formatWrittenRow(new MagicUserAuthorization(), 11, $table, $row, $access, new SelectQuery(['relations' => ['customer' => ['fields' => ['record_id']]]]), new ActorContext('reader', 'org'));
        self::assertSame(['id' => '123'], $result->toArray());
    }

    public static function unreadableWriteCases(): array
    {
        return [
            'table denied' => [MagicBaseConst::SCOPE_DISABLED, MagicBaseConst::SCOPE_PUBLIC],
            'row denied' => [MagicBaseConst::SCOPE_PUBLIC, MagicBaseConst::SCOPE_DISABLED],
            'another users row' => [MagicBaseConst::SCOPE_PUBLIC, MagicBaseConst::SCOPE_PRIVATE_USER],
        ];
    }

    public function testReadableWriteResponseStillAppliesColumnPermissions(): void
    {
        $support = $this->support();
        $column = new MagicBaseColumnEntity(['id' => 10, 'column_key' => 'secret', 'dynamic_permission' => ['read_scope' => MagicBaseConst::SCOPE_DISABLED]]);
        $row = new MagicBaseRowEntity(['record_id' => 123, 'data' => ['secret' => 'hidden']]);
        $result = $support->formatWrittenRow(new MagicUserAuthorization(), 11, new MagicBaseTableEntity(), $row, $this->access($column), new SelectQuery(['fields' => ['record_id', 'secret']]), new ActorContext('reader', 'org'));
        self::assertSame(['record_id' => '123'], $result->toArray());
    }

    #[DataProvider('relationOperations')]
    public function testRelationsRequireReadableTargetBeforeStorageQuery(string $operation): void
    {
        $authorization = new MagicUserAuthorization();
        $authorization->setOrganizationCode('org');
        $accessControl = new DeniedTargetAccessControl();
        $relations = $this->createMock(MagicBaseRelationRepositoryInterface::class);
        $relations->method('listRelations')->willReturn(new MagicBaseEntityCollection([
            new MagicBaseRelationEntity(['source_table_id' => 12, 'target_table_id' => 22, 'relation_name' => 'customer', 'source_column_key' => 'customer_id', 'target_column_key' => 'record_id', 'relation_type' => MagicBaseConst::RELATION_HAS_MANY]),
        ]));
        $metadata = new MagicBaseMetadataDomainService($this->createMock(MagicBaseTableRepositoryInterface::class), $relations, $this->createMock(MagicBasePermissionRepositoryInterface::class), $this->createMock(MagicBaseMigrationLogRepositoryInterface::class));
        $support = $this->support($accessControl, $metadata);
        $table = new MagicBaseTableEntity(['id' => 12]);
        $row = new MagicBaseRowEntity(['record_id' => 1, 'data' => ['customer_id' => 7]]);
        $access = $this->access(new MagicBaseColumnEntity(['id' => 10, 'column_key' => 'customer_id']));
        $actor = new ActorContext('reader', 'org');
        $select = new SelectQuery(['relations' => ['customer' => ['fields' => ['record_id']]]]);
        $this->expectExceptionMessage('Target access denied: org/11/22');
        match ($operation) {
            'row' => $support->formatRow($authorization, 11, $table, $row, $access, $select, $actor),
            'write' => $support->formatWrittenRow($authorization, 11, $table, $row, $access, $select, $actor),
            'page' => $support->formatRows($authorization, 11, $table, [$row], $access, $select, $actor),
            'filter' => $support->resolveFiltersForRowStorage($authorization, 11, $table, $access, $actor, ['customer.name' => ['eq' => 'secret']]),
        };
    }

    public static function relationOperations(): array
    {
        return [['row'], ['page'], ['filter'], ['write']];
    }

    #[DataProvider('hiddenRelationSources')]
    public function testRelationExpansionCannotRevealUnreadableSourceKeys(string $userId, string $scope): void
    {
        $authorization = (new MagicUserAuthorization())->setOrganizationCode('org');
        $relations = $this->createMock(MagicBaseRelationRepositoryInterface::class);
        $relations->method('listRelations')->willReturn(new MagicBaseEntityCollection([
            new MagicBaseRelationEntity(['source_table_id' => 12, 'target_table_id' => 22, 'relation_name' => 'customer', 'source_column_key' => 'customer_id', 'target_column_key' => 'record_id']),
        ]));
        $metadata = new MagicBaseMetadataDomainService($this->createMock(MagicBaseTableRepositoryInterface::class), $relations, $this->createMock(MagicBasePermissionRepositoryInterface::class), $this->createMock(MagicBaseMigrationLogRepositoryInterface::class));
        // This fails if an unreadable source value reaches target lookup or storage.
        $support = $this->support(new DeniedTargetAccessControl(), $metadata);
        $table = new MagicBaseTableEntity(['id' => 12]);
        $row = new MagicBaseRowEntity(['record_id' => 1, 'created_by' => 'owner', 'organization_code' => 'other-org', 'data' => ['customer_id' => 7]]);
        $access = $this->access(new MagicBaseColumnEntity(['id' => 10, 'column_key' => 'customer_id', 'dynamic_permission' => ['read_scope' => $scope]]));
        $actor = new ActorContext($userId, $userId === '' ? '' : 'org');
        $select = new SelectQuery(['fields' => ['customer_id'], 'relations' => ['customer' => ['fields' => ['record_id']]]]);
        self::assertSame(['customer' => null], $support->formatRow($authorization, 11, $table, $row, $access, $select, $actor)->toArray());
        self::assertSame(['customer' => null], $support->formatRows($authorization, 11, $table, [$row], $access, $select, $actor)[0]->toArray());
    }

    public static function hiddenRelationSources(): array
    {
        $cases = [];
        foreach (['', 'reader'] as $userId) {
            foreach (['disabled', 'private_user', 'private_org', 'private_department'] as $scope) {
                $cases[] = [$userId, $scope];
            }
        }
        return $cases;
    }

    private function access(MagicBaseColumnEntity $column, array $permissions = [], bool $manager = false): MagicBaseAccessContext
    {
        return new MagicBaseAccessContext(new MagicBaseColumnIndex([$column->getColumnKey() => $column]), new MagicBaseEntityCollection(), new MagicBaseEntityCollection(), new MagicBaseEntityCollection(), new MagicBasePermissionIndex([10 => new MagicBaseEntityCollection($permissions)]), new MagicBasePermissionIndex([]), $manager);
    }

    private function support(?MagicBaseAccessControl $access = null, ?MagicBaseMetadataDomainService $metadata = null, ?MagicBaseRowStorageResolverDomainService $storage = null): MagicBaseRowQuerySupport
    {
        return new MagicBaseRowQuerySupport($metadata ?? (new ReflectionClass(MagicBaseMetadataDomainService::class))->newInstanceWithoutConstructor(), $access ?? (new ReflectionClass(MagicBaseAccessControl::class))->newInstanceWithoutConstructor(), $storage ?? (new ReflectionClass(MagicBaseRowStorageResolverDomainService::class))->newInstanceWithoutConstructor(), (new ReflectionClass(MagicBaseRowQueryCriteriaDomainService::class))->newInstanceWithoutConstructor(), new MagicBasePermissionDomainService());
    }
}

/** @internal */
readonly class DeniedTargetAccessControl extends MagicBaseAccessControl
{
    public function __construct()
    {
    }

    public function requireReadableTable(MagicUserAuthorization $authorization, int $projectId, int $tableId): MagicBaseTableAccessContext
    {
        throw new RuntimeException(sprintf('Target access denied: %s/%d/%d', $authorization->getOrganizationCode(), $projectId, $tableId));
    }

    public function loadTableContext(MagicUserAuthorization $authorization, int $projectId, int $tableId): MagicBaseTableAccessContext
    {
        throw new RuntimeException('Unexpected unauthenticated target lookup');
    }
}
