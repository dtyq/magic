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
        Schema::create('magic_super_agent_task_file_versions', function (Blueprint $table) {
            // 主键
            $table->bigIncrements('id');

            // 文件ID，关联magic_super_agent_task_files表
            $table->unsignedBigInteger('file_id')->comment('文件ID');

            // 组织编码，用于数据隔离
            $table->string('organization_code', 64)->comment('组织编码');

            // 文件键，标识文件的具体版本位置
            $table->string('file_key', 512)->comment('文件键');

            // 版本号
            $table->unsignedInteger('version')->comment('版本号');

            // 编辑类型：1=人工编辑，2=AI编辑
            $table->unsignedTinyInteger('edit_type')->default(1)->comment('编辑类型：1=人工编辑，2=AI编辑');

            // 索引设计
            $table->index(['file_id', 'organization_code'], 'idx_file_id_org_code');
            $table->index(['file_key'], 'idx_file_key');
            $table->index(['organization_code'], 'idx_organization_code');
            $table->index(['file_id', 'version'], 'idx_file_id_version');
            $table->index(['edit_type'], 'idx_edit_type');

            // 时间字段
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_task_file_versions');
    }
};
