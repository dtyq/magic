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
        if (! Schema::hasTable('magic_skill_market')
            || ! Schema::hasTable('magic_skill_versions')
            || ! Schema::hasColumn('magic_skill_market', 'search_text')) {
            return;
        }

        Db::table('magic_skill_market')
            ->select(['id', 'skill_version_id'])
            ->orderBy('id')
            ->chunkById(self::CHUNK_SIZE, function ($marketRows): void {
                $rows = array_map(static fn ($row) => (array) $row, $marketRows->all());
                $versionIds = array_values(array_unique(array_filter(array_map(
                    static fn (array $row) => (int) ($row['skill_version_id'] ?? 0),
                    $rows
                ))));

                if ($versionIds === []) {
                    return;
                }

                $versions = Db::table('magic_skill_versions')
                    ->select([
                        'id',
                        'package_name',
                        'package_description',
                        'version',
                        'name_i18n',
                        'description_i18n',
                        'version_description_i18n',
                    ])
                    ->whereIn('id', $versionIds)
                    ->get()
                    ->keyBy('id');

                foreach ($rows as $row) {
                    $version = $versions->get((int) ($row['skill_version_id'] ?? 0));
                    if ($version === null) {
                        continue;
                    }

                    Db::table('magic_skill_market')
                        ->where('id', $row['id'])
                        ->update([
                            'search_text' => $this->buildSearchText((array) $version),
                        ]);
                }
            }, 'id');
    }

    public function down(): void
    {
    }

    private function buildSearchText(array $version): string
    {
        $values = [];
        $seen = [];

        $this->appendText($values, $seen, $version['package_name'] ?? null);
        $this->appendText($values, $seen, $version['package_description'] ?? null);
        $this->appendText($values, $seen, $version['version'] ?? null);
        $this->appendI18nTexts($values, $seen, $this->decodeJsonArray($version['name_i18n'] ?? null));
        $this->appendI18nTexts($values, $seen, $this->decodeJsonArray($version['description_i18n'] ?? null));
        $this->appendI18nTexts($values, $seen, $this->decodeJsonArray($version['version_description_i18n'] ?? null));

        return implode(' ', $values);
    }

    /**
     * @param array<int, string> $values
     * @param array<string, bool> $seen
     */
    private function appendText(array &$values, array &$seen, mixed $text): void
    {
        if (! is_string($text)) {
            return;
        }

        $normalized = $this->normalizeText($text);
        if ($normalized === null || isset($seen[$normalized])) {
            return;
        }

        $seen[$normalized] = true;
        $values[] = $normalized;
    }

    /**
     * @param array<int, string> $values
     * @param array<string, bool> $seen
     * @param array<mixed> $texts
     */
    private function appendI18nTexts(array &$values, array &$seen, array $texts): void
    {
        foreach ($texts as $text) {
            $this->appendText($values, $seen, $text);
        }
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
