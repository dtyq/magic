<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Domain\Asset\Entity\ValueObject\AssetVisibility;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class AssetVisibilityTest extends TestCase
{
    public function testPersonalVisibilityPutsOwnerFirstAndDropsEmptyGroups(): void
    {
        $principals = AssetVisibility::personal(['user-2', 'user-2', ''], ['dept-1'])->principals('user-1');

        self::assertSame([
            PrincipalType::USER->value => ['user-1', 'user-2'],
            PrincipalType::DEPARTMENT->value => ['dept-1'],
        ], $principals);
    }

    public function testPersonalVisibilityKeepsOwnerWhenNoExtraPrincipalGiven(): void
    {
        // 只有用户主体的分组会保留，空的部门分组不产生写入目标。
        self::assertSame(
            [PrincipalType::USER->value => ['user-1']],
            AssetVisibility::personal()->principals('user-1'),
        );
    }

    public function testPersonalVisibilityWithoutAnyPrincipalWritesNothing(): void
    {
        self::assertSame([], AssetVisibility::personal()->principals(''));
    }

    public function testOrganizationVisibilityIgnoresCurrentUser(): void
    {
        self::assertSame(
            [PrincipalType::ORGANIZATION->value => ['official-org']],
            AssetVisibility::organization('official-org')->principals('admin-1'),
        );
    }

    public function testOrganizationVisibilityWithoutCodeWritesNothing(): void
    {
        self::assertSame([], AssetVisibility::organization('')->principals('admin-1'));
    }

    /**
     * 请求里的脏数据（数组、null）不能写进可见性表，数字 ID 统一按字符串处理。
     */
    public function testOnlyScalarPrincipalIdsAreKept(): void
    {
        self::assertSame(
            [PrincipalType::USER->value => ['user-1', '202']],
            AssetVisibility::personal([['user-9'], null, 202])->principals('user-1'),
        );
    }
}
