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
            if (! Schema::hasColumn('magic_super_magic_agents', 'file_key')) {
                $table->string('file_key', 500)->nullable()->comment('Agent 文件key')->after('project_id');
            }
        });
    }

    public function down(): void
    {
    }
};
