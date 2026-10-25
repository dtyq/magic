<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\MagicBase\Service;

use App\Domain\MagicBase\Entity\MagicBaseColumnEntity;
use App\Domain\MagicBase\Entity\MagicBaseRowEntity;
use App\Domain\MagicBase\Entity\MagicBaseTableEntity;
use App\Domain\MagicBase\Entity\MagicBaseTablePermissionEntity;
use App\Domain\MagicBase\Entity\ValueObject\ActorContext;
use App\Domain\MagicBase\Service\MagicBasePermissionDomainService;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class MagicBaseDefaultPermissionsTest extends TestCase
{
    public function testDefaultPermissionsAllowReadingButOnlyCreatorsCanEditRows(): void
    {
        $permissions = new MagicBasePermissionDomainService();
        $table = new MagicBaseTableEntity();
        $column = new MagicBaseColumnEntity();
        $row = new MagicBaseRowEntity();
        $row->setCreatedBy('creator');
        foreach (['', 'visitor', 'creator'] as $userId) {
            $actor = new ActorContext($userId, 'org', []);
            self::assertTrue($permissions->canReadTable($actor, $table, [], false));
            self::assertTrue($permissions->canReadRow($actor, $row, $table, [], false));
            self::assertTrue($permissions->canReadColumn($actor, $row, $column, [], false));
            self::assertFalse($permissions->canInsertTable($actor, $table, [], false));
            self::assertSame($userId === 'creator', $permissions->canEditRow($actor, $row, $table, [], false));
            self::assertSame($userId === 'creator', $permissions->canDeleteRow($actor, $row, $table, [], false));
            self::assertSame($userId === 'creator', $permissions->canEditColumn($actor, $row, $column, [], false));
        }
    }

    public function testManagersAndExplicitInsertGrantsCanStillWrite(): void
    {
        $permissions = new MagicBasePermissionDomainService();
        $actor = new ActorContext('visitor', 'org', []);
        $table = new MagicBaseTableEntity();
        $row = new MagicBaseRowEntity();
        $row->setCreatedBy('creator');
        $grant = new MagicBaseTablePermissionEntity();
        $grant->setSubjectType('user');
        $grant->setSubjectId('visitor');
        $grant->setPermissionLevel('insert');

        self::assertTrue($permissions->canInsertTable($actor, $table, [$grant], false));
        self::assertTrue($permissions->canInsertTable($actor, $table, [], true));
        self::assertTrue($permissions->canEditRow($actor, $row, $table, [], true));
        self::assertTrue($permissions->canDeleteRow($actor, $row, $table, [], true));
        self::assertTrue($permissions->canEditColumn($actor, $row, new MagicBaseColumnEntity(), [], true));
    }

    public function testExplicitSavedPublicPermissionsArePreserved(): void
    {
        $permissions = new MagicBasePermissionDomainService();
        $actor = new ActorContext('visitor', 'org', []);
        $table = new MagicBaseTableEntity();
        $table->setDynamicPermissions([
            'table' => ['insert_scope' => 'public'],
            'row' => ['edit_scope' => 'public', 'delete_scope' => 'public'],
        ]);
        $column = new MagicBaseColumnEntity();
        $column->setDynamicPermission(['edit_scope' => 'public']);
        $row = new MagicBaseRowEntity();
        $row->setCreatedBy('creator');

        self::assertTrue($permissions->canInsertTable($actor, $table, [], false));
        self::assertTrue($permissions->canEditRow($actor, $row, $table, [], false));
        self::assertTrue($permissions->canDeleteRow($actor, $row, $table, [], false));
        self::assertTrue($permissions->canEditColumn($actor, $row, $column, [], false));
    }
}
