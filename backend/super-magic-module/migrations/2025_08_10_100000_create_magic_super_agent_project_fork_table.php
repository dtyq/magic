<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * Create magic_super_agent_project_fork table.
 */
return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_super_agent_project_fork', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('Primary key');
            $table->unsignedBigInteger('source_project_id')->comment('Source project ID');
            $table->unsignedBigInteger('fork_project_id')->comment('Forked project ID');
            $table->unsignedBigInteger('target_workspace_id')->comment('Target workspace ID');
            $table->string('user_id', 64)->comment('User ID who initiated the fork');
            $table->string('user_organization_code', 64)->comment('User organization code');
            $table->string('status', 20)->default('running')->comment('Fork status: running, finished, failed');
            $table->integer('progress')->default(0)->comment('Progress percentage 0-100');
            $table->unsignedBigInteger('current_file_id')->nullable()->comment('Current processing file ID for resume');
            $table->integer('total_files')->default(0)->comment('Total files count');
            $table->integer('processed_files')->default(0)->comment('Processed files count');
            $table->text('err_msg')->nullable()->comment('Error message if failed');
            $table->string('created_uid', 64)->comment('Created user ID');
            $table->string('updated_uid', 64)->comment('Updated user ID');
            $table->timestamps();

            // Indexes
            $table->index(['user_id', 'source_project_id'], 'idx_user_source_project');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_project_fork');
    }
};
