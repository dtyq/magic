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
        Schema::create('magic_bot_versions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('flow_code')->comment('工作流code');
            $table->string('flow_version')->comment('工作流版本');
            $table->json('instruct')->comment('交互指令');
            $table->bigInteger('root_id')->comment('根id');
            $table->string('robot_name')->comment('助理名称');
            $table->string('robot_avatar')->comment('助理头像');
            $table->string('robot_description')->comment('助理描述');

            $table->string('version_description', 255)->default('')->comment('描述');
            $table->string('version_number')->nullable()->comment('版本号');
            $table->integer('release_scope')->nullable()->comment('发布范围.1:发布到企业内部 2:发布到应用市场');

            $table->integer('approval_status')->default(3)->nullable(false)->comment('审批状态');
            $table->integer('review_status')->default(0)->nullable(false)->comment('审核状态');
            $table->integer('enterprise_release_status')->default(0)->nullable(false)->comment('发布到企业内部状态');
            $table->integer('app_market_status')->default(0)->nullable(false)->comment('发布到应用市场状态');

            $table->string('organization_code')->comment('组织编码');

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
        Schema::dropIfExists('magic_bot_version');
    }
};
