<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\SuperMagic\Skill;

use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class SkillMarketCategoryMigrationContractTest extends TestCase
{
    public function testSkillMigrationsCreateCategoryRelationTable(): void
    {
        $migrationSources = $this->getSkillMigrationSources();

        $this->assertNotEmpty(
            array_filter(
                $migrationSources,
                static fn (string $source): bool => str_contains($source, "create('magic_skill_category_relations'")
            ),
            'Skill migrations must create magic_skill_category_relations.'
        );
    }

    public function testSkillCategoryRelationMigrationDoesNotBackfillFromMarketCategoryId(): void
    {
        $relationMigrationSource = implode("\n", $this->getCategoryRelationMigrationSources());

        $this->assertDoesNotMatchRegularExpression(
            '/magic_skill_market.*category_id|category_id.*magic_skill_market/s',
            $relationMigrationSource,
            'Skill category relation migrations must not backfill from magic_skill_market.category_id.'
        );
    }

    /**
     * @return list<string>
     */
    private function getSkillMigrationSources(): array
    {
        $migrationFiles = glob(dirname(__DIR__, 5) . '/migrations/*skill*.php') ?: [];

        return array_map(
            static fn (string $migrationFile): string => (string) file_get_contents($migrationFile),
            $migrationFiles
        );
    }

    /**
     * @return list<string>
     */
    private function getCategoryRelationMigrationSources(): array
    {
        $migrationFiles = glob(dirname(__DIR__, 5) . '/migrations/*skill*category*relation*.php') ?: [];

        return array_map(
            static fn (string $migrationFile): string => (string) file_get_contents($migrationFile),
            $migrationFiles
        );
    }
}
