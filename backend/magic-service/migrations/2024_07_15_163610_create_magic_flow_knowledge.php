<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateMagicFlowKnowledge extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('magic_flow_knowledge')) {
            Schema::create('magic_flow_knowledge', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('code')->default('')->unique()->comment('知识库唯一 code');
                $table->integer('version')->default(1)->comment('版本');
                $table->string('name')->default('')->comment('知识库名称');
                $table->string('description')->default('')->comment('知识库描述');
                $table->tinyInteger('type')->default(1)->comment('知识库类型 1 自建文本 2 天书知识库云文档');
                $table->boolean('enabled')->default(1)->comment('1 启用 0 禁用');
                $table->tinyInteger('sync_status')->default(0)->comment('同步状态 0 未同步 1 同步成功 2 同步失败');
                $table->tinyInteger('sync_times')->default(0)->comment('同步次数');
                $table->string('sync_status_message', 1000)->default('')->comment('同步状态消息');
                $table->string('model')->default('')->comment('嵌入模型');
                $table->string('vector_db')->default('')->comment('向量数据库');

                $table->string('organization_code')->default('')->comment('组织代码');
                $table->string('created_uid')->default('')->comment('创建者用户ID');
                $table->timestamp('created_at')->nullable()->comment('创建时间');
                $table->string('updated_uid')->default('')->comment('更新者用户ID');
                $table->timestamp('updated_at')->nullable()->comment('更新时间');
                $table->timestamp('deleted_at')->nullable()->comment('删除时间');
            });
        }

        if (! Schema::hasTable('magic_flow_knowledge_fragment')) {
            Schema::create('magic_flow_knowledge_fragment', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('knowledge_code')->default('')->comment('关联的知识库唯一 code');
                $table->text('content')->nullable(false)->comment('文本片段');
                $table->json('metadata')->nullable()->comment('自定义元数据');
                $table->string('business_id')->default('')->comment('业务 ID');
                $table->tinyInteger('sync_status')->default(0)->comment('同步状态 0 未同步 1 同步成功 2 同步失败');
                $table->tinyInteger('sync_times')->default(0)->comment('同步次数');
                $table->string('sync_status_message', 1000)->default('')->comment('同步状态消息');
                $table->string('point_id')->default('')->comment('片段ID');
                $table->text('vector')->nullable()->comment('向量值');

                $table->string('created_uid')->default('')->comment('创建者用户ID');
                $table->timestamp('created_at')->nullable()->comment('创建时间');
                $table->string('updated_uid')->default('')->comment('更新者用户ID');
                $table->timestamp('updated_at')->nullable()->comment('更新时间');
                $table->timestamp('deleted_at')->nullable()->comment('删除时间');
            });
        }

        // todo 索引
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
}
