<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    /**
     * 与 config/autoload/official_agents.php 中官方数字员工 code 一致.
     *
     * @var array<int, string>
     */
    private const OFFICIAL_AGENT_CODES = [
        'data_analysis',
        'design',
        'general',
        'ppt',
        'summary',
    ];

    private const SOURCE_SYSTEM = 'SYSTEM';

    public function up(): void
    {
        if (! Schema::hasTable('magic_super_magic_agents')) {
            return;
        }

        Db::table('magic_super_magic_agents')
            ->whereIn('code', self::OFFICIAL_AGENT_CODES)
            ->whereNull('deleted_at')
            ->update(['source_type' => self::SOURCE_SYSTEM]);
    }

    public function down(): void
    {
    }
};
