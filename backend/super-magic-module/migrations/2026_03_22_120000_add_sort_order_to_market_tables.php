<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_skill_market')) {
            Schema::table('magic_skill_market', static function (Blueprint $table) {
                if (! Schema::hasColumn('magic_skill_market', 'sort_order')) {
                    $table->integer('sort_order')
                        ->nullable()
                        ->after('install_count')
                        ->comment('排序值，数值越大越靠前；NULL 时按创建时间排序');
                }
            });
        }

        if (Schema::hasTable('magic_super_magic_agent_market')) {
            Schema::table('magic_super_magic_agent_market', static function (Blueprint $table) {
                if (! Schema::hasColumn('magic_super_magic_agent_market', 'sort_order')) {
                    $table->integer('sort_order')
                        ->nullable()
                        ->after('install_count')
                        ->comment('排序值，数值越大越靠前；NULL 时按创建时间排序');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
