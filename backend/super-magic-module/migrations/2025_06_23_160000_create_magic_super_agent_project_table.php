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
        Schema::create('magic_super_agent_project', function (Blueprint $table) {
            $table->bigInteger('id')->primary()->comment('Project ID');
            $table->string('user_id', 36)->index()->comment('User ID');
            $table->string('user_organization_code', 64)->index()->comment('User organization code');
            $table->bigInteger('workspace_id')->index()->comment('Workspace ID');
            $table->string('project_name', 255)->comment('Project name');
            $table->text('project_description')->nullable()->comment('Project description');
            $table->string('work_dir', 512)->default('')->comment('Work directory');
            $table->tinyInteger('project_status')->default(1)->comment('Project status: 1=active, 2=archived, 3=deleted');
            $table->bigInteger('current_topic_id')->nullable()->comment('Current topic ID');
            $table->string('current_topic_status', 32)->default('')->comment('Current topic status');
            $table->string('created_uid', 36)->default('')->comment('Creator user ID');
            $table->string('updated_uid', 36)->default('')->comment('Updater user ID');
            $table->timestamp('created_at')->nullable()->comment('Created time');
            $table->timestamp('updated_at')->nullable()->comment('Updated time');
            $table->timestamp('deleted_at')->nullable()->comment('Deleted time');

            $table->index(['workspace_id', 'user_id'], 'idx_workspace_user');
            $table->index(['user_id', 'user_organization_code'], 'idx_user_org');
            $table->index(['project_name', 'workspace_id'], 'idx_name_workspace');
            $table->index('updated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_project');
    }
};
