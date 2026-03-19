<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_recycle_bin')) {
            return;
        }

        Schema::create('magic_recycle_bin', function (Blueprint $table) {
            // 主键
            $table->bigIncrements('id');

            // 资源标识
            $table->tinyInteger('resource_type')->unsigned()->comment('资源类型：1=workspace,2=project,3=topic,4=file');
            $table->unsignedBigInteger('resource_id')->comment('资源ID，对应各业务表主键');
            $table->string('resource_name', 255)->default('')->comment('资源名称，删除时快照');

            // 所有权与操作人(与工作区/项目/话题/文件表 user_id 一致，用 string)
            $table->string('owner_id', 128)->comment('资源创建者ID');
            $table->string('deleted_by', 128)->comment('删除人ID');

            // 删除时间与有效期（deleted_at 由业务写入）
            $table->timestamp('deleted_at')->comment('删除时间');
            $table->unsignedInteger('retain_days')->default(30)->comment('有效期(天)');

            // 父级关联(用于恢复时排除用户曾删的子资源)
            $table->unsignedBigInteger('parent_id')->nullable()->comment('父级资源ID：file/topic=project_id，project=workspace_id，workspace=NULL');

            // 扩展信息(可选，列表也可从原表JOIN)
            $table->json('extra_data')->nullable()->comment('扩展信息：父级名称等');

            // 审计字段（与项目内 2025_06_23 project、2025_08_27 operation_logs 等保持一致）
            $table->timestamp('created_at')->nullable()->comment('创建时间');
            $table->timestamp('updated_at')->nullable()->comment('更新时间');

            // 第一阶段仅主键，不建业务索引；后续若有性能需求再补 idx_owner_deleted、idx_deleted_at
        });

        // 添加表注释
        Db::statement("ALTER TABLE magic_recycle_bin COMMENT '回收站统一表'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_recycle_bin');
    }
};
