<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Database\Migration;

use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class MicroAppProjectModeMigrationTest extends TestCase
{
    public function testBackfillTargetsActiveProjectsAndHasSafeIrreversibleDown(): void
    {
        $source = file_get_contents(
            dirname(__DIR__, 5) . '/migrations/2026_09_18_120000_backfill_micro_app_project_mode.php'
        );

        self::assertIsString($source);
        self::assertSame(0, substr_count($source, "->where('p.project_mode', 'micro-app')"));
        self::assertStringContainsString("->update(['project_mode' => 'micro-app'])", $source);
        self::assertStringNotContainsString("->update(['project_mode' => 'general'])", $source);
        self::assertStringContainsString('This historical backfill is intentionally irreversible', $source);
        self::assertStringContainsString("->whereNull('p.deleted_at')", $source);
        self::assertStringContainsString("->whereNull('ma.deleted_at')", $source);
    }
}
