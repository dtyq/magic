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
        Schema::table('magic_super_agent_workspaces', function (Blueprint $table) {
            $table->string('workspace_type', 32)
                ->default('default')
                ->after('status')
                ->comment('工作区类型：default-默认，finance-金融，audio-录音');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
