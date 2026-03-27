<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('magic_super_magic_agent_market')) {
            return;
        }

        Schema::table('magic_super_magic_agent_market', static function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_magic_agent_market', 'is_featured')) {
                $table->boolean('is_featured')
                    ->default(false)
                    ->after('sort_order')
                    ->comment('是否精选');
            }

            if (! Schema::hasIndex('magic_super_magic_agent_market', 'idx_featured_sort_order')) {
                $table->index(['is_featured', 'sort_order'], 'idx_featured_sort_order');
            }
        });
    }

    public function down(): void
    {
    }
};
