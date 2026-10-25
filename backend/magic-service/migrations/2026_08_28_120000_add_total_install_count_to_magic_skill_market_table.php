<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('magic_skill_market')) {
            return;
        }

        if (! Schema::hasColumn('magic_skill_market', 'total_install_count')) {
            Schema::table('magic_skill_market', static function (Blueprint $table) {
                $table->bigInteger('total_install_count')
                    ->default(0)
                    ->after('base_install_count');
            });
        }

        Db::statement('UPDATE magic_skill_market SET total_install_count = install_count + base_install_count');

        Schema::table('magic_skill_market', static function (Blueprint $table) {
            if (Schema::hasIndex('magic_skill_market', 'idx_featured_sort_order')) {
                $table->dropIndex('idx_featured_sort_order');
            }

            $table->index(
                ['is_featured', 'sort_order', 'total_install_count', 'id'],
                'idx_featured_sort_order'
            );
        });
    }

    public function down(): void
    {
    }
};
