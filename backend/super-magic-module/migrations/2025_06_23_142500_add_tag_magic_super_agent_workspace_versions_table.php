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
        Schema::table('magic_super_agent_workspace_versions', function (Blueprint $table) {
            $table->integer('tag')->default(1)->comment('版本号');
            $table->bigInteger('project_id')->default(0)->comment('项目id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
