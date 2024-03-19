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
        // Make workspace_id nullable in project table
        Schema::table('magic_super_agent_project', function (Blueprint $table) {
            $table->bigInteger('workspace_id')->nullable()->change();
        });

        // Make workspace_id nullable in topics table
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->bigInteger('workspace_id')->nullable()->change();
        });

        // Make workspace_id nullable in task table
        Schema::table('magic_super_agent_task', function (Blueprint $table) {
            $table->bigInteger('workspace_id')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
