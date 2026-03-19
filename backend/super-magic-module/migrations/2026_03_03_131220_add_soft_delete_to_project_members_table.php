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
        Schema::table('magic_super_agent_project_members', function (Blueprint $table) {
            $table->softDeletes()->comment('软删除时间');
        });
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_project_members', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
