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
        Schema::create('magic_bots', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('bot_version_id')->comment('助理绑定的版本id');
            $table->string('flow_code')->comment('工作流id');
            $table->json('instructs')->comment('交互指令');
            $table->string('robot_name')->comment('助理名称');
            $table->string('robot_avatar')->comment('助理头像');
            $table->string('robot_description')->comment('助理描述');
            $table->string('organization_code')->comment('组织编码');
            $table->integer('status')->comment('助理状态:启用｜禁用');
            $table->string('created_uid')->default('')->comment('发布人');
            $table->timestamp('created_at')->nullable()->comment('创建时间');
            $table->string('updated_uid')->default('')->comment('更新者用户ID');
            $table->timestamp('updated_at')->nullable()->comment('更新时间');
            $table->timestamp('deleted_at')->nullable()->comment('删除时间');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_bot_versions');
    }
};
