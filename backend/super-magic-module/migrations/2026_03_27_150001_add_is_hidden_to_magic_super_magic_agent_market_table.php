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
            if (! Schema::hasColumn('magic_super_magic_agent_market', 'is_hidden')) {
                $table->boolean('is_hidden')
                    ->default(false)
                    ->after('is_featured')
                    ->comment('是否隐藏');
            }
        });
    }

    public function down(): void
    {
    }
};
