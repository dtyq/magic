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
        if (! Schema::hasTable('magic_super_magic_agents')) {
            return;
        }

        Schema::table('magic_super_magic_agents', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_magic_agents', 'latest_published_at')) {
                $table->dateTime('latest_published_at')->nullable()->after('file_key')->comment('Latest published timestamp');
            }
        });
    }

    public function down(): void
    {
    }
};
