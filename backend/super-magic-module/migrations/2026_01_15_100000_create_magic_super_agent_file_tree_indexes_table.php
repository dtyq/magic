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
        // 检查表是否已存在
        if (Schema::hasTable('magic_super_agent_file_tree_indexes')) {
            return;
        }

        // 创建文件树索引表（闭包表）
        Schema::create('magic_super_agent_file_tree_indexes', static function (Blueprint $table) {
            // 主键
            $table->bigIncrements('id')->comment('主键');

            // 祖先节点ID
            $table->unsignedBigInteger('ancestor_id')->comment('祖先节点ID');

            // 后代节点ID
            $table->unsignedBigInteger('descendant_id')->comment('后代节点ID');

            // 距离（0=自己，1=直接子节点，2=孙节点...）
            $table->unsignedInteger('distance')->default(0)->comment('距离：0=自己，1=直接子节点，2=孙节点...');

            // 组织编码
            $table->string('organization_code', 64)->comment('组织编码');

            // 时间戳
            $table->timestamps();

            // 唯一索引：确保同一组织内的祖先-后代关系唯一
            $table->unique(['ancestor_id', 'descendant_id', 'organization_code'], 'uk_ancestor_descendant_org');

            // 查询索引：查询某节点的所有祖先
            $table->index(['descendant_id', 'distance', 'organization_code'], 'idx_descendant_distance_org');

            // 查询索引：查询某节点的所有子孙
            $table->index(['ancestor_id', 'distance', 'organization_code'], 'idx_ancestor_distance_org');

            // 组织索引
            $table->index('organization_code', 'idx_organization_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 删除表
        Schema::dropIfExists('magic_super_agent_file_tree_indexes');
    }
};
