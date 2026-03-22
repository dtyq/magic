<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    private const CHUNK_SIZE = 200;

    public function up(): void
    {
        $this->backfillSkillVersions();
        $this->backfillSkills();
    }

    public function down(): void
    {
    }

    private function backfillSkillVersions(): void
    {
        if (! Schema::hasTable('magic_skill_versions') || ! Schema::hasColumn('magic_skill_versions', 'search_text')) {
            return;
        }

        Db::table('magic_skill_versions')
            ->select([
                'id',
                'package_name',
                'package_description',
                'version',
                'name_i18n',
                'description_i18n',
                'version_description_i18n',
            ])
            ->orderBy('id')
            ->chunkById(self::CHUNK_SIZE, function ($versions): void {
                foreach ($versions as $version) {
                    $row = (array) $version;
                    Db::table('magic_skill_versions')
                        ->where('id', $row['id'])
                        ->update([
                            'search_text' => $this->buildSearchText(
                                [
                                    $row['package_name'] ?? null,
                                    $row['package_description'] ?? null,
                                    $row['version'] ?? null,
                                ],
                                [
                                    $this->decodeJsonArray($row['name_i18n'] ?? null),
                                    $this->decodeJsonArray($row['description_i18n'] ?? null),
                                    $this->decodeJsonArray($row['version_description_i18n'] ?? null),
                                ]
                            ),
                        ]);
                }
            }, 'id');
    }

    private function backfillSkills(): void
    {
        if (! Schema::hasTable('magic_skills') || ! Schema::hasColumn('magic_skills', 'search_text')) {
            return;
        }

        Db::table('magic_skills')
            ->select([
                'id',
                'package_name',
                'package_description',
                'version_code',
                'name_i18n',
                'description_i18n',
            ])
            ->orderBy('id')
            ->chunkById(self::CHUNK_SIZE, function ($skills): void {
                foreach ($skills as $skill) {
                    $row = (array) $skill;
                    Db::table('magic_skills')
                        ->where('id', $row['id'])
                        ->update([
                            'search_text' => $this->buildSearchText(
                                [
                                    $row['package_name'] ?? null,
                                    $row['package_description'] ?? null,
                                    $row['version_code'] ?? null,
                                ],
                                [
                                    $this->decodeJsonArray($row['name_i18n'] ?? null),
                                    $this->decodeJsonArray($row['description_i18n'] ?? null),
                                ]
                            ),
                        ]);
                }
            }, 'id');
    }

    /**
     * @param array<int, mixed> $plainTexts
     * @param array<int, mixed> $structuredTexts
     */
    private function buildSearchText(array $plainTexts, array $structuredTexts): string
    {
        $values = [];
        $seen = [];

        foreach ($plainTexts as $text) {
            $this->appendValue($values, $seen, $text);
        }

        foreach ($structuredTexts as $text) {
            $this->appendValue($values, $seen, $text);
        }

        return implode(' ', $values);
    }

    /**
     * @param array<int, string> $values
     * @param array<string, bool> $seen
     */
    private function appendValue(array &$values, array &$seen, mixed $value): void
    {
        if (is_array($value)) {
            foreach ($value as $item) {
                $this->appendValue($values, $seen, $item);
            }
            return;
        }

        if (! is_string($value)) {
            return;
        }

        $normalized = $this->normalizeText($value);
        if ($normalized === null || isset($seen[$normalized])) {
            return;
        }

        $seen[$normalized] = true;
        $values[] = $normalized;
    }

    /**
     * @return array<mixed>
     */
    private function decodeJsonArray(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value) || $value === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function normalizeText(string $text): ?string
    {
        $text = trim($text);
        if ($text === '') {
            return null;
        }

        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return mb_strtolower($text, 'UTF-8');
    }
};
