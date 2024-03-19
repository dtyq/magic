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
        if (! Schema::hasTable('magic_super_magic_agents')) {
            return;
        }

        Schema::table('magic_super_magic_agents', function (Blueprint $table) {
            // 添加多语言字段
            if (! Schema::hasColumn('magic_super_magic_agents', 'name_i18n')) {
                $table->json('name_i18n')->nullable()->after('modifier')->comment('Agent 名称（多语言），格式：{"zh":"市场分析师","en":"Marketing Analyst"}');
            }
            if (! Schema::hasColumn('magic_super_magic_agents', 'role_i18n')) {
                $table->json('role_i18n')->nullable()->after('name_i18n')->comment('角色定位（多语言），格式：{"zh":["市场分析师","内容创作者"],"en":["Marketing Analyst","Content Creator"]}');
            }
            if (! Schema::hasColumn('magic_super_magic_agents', 'description_i18n')) {
                $table->json('description_i18n')->nullable()->after('role_i18n')->comment('核心职责与适用场景描述（多语言），格式：{"zh":"...","en":"..."}');
            }

            // 添加来源相关字段
            if (! Schema::hasColumn('magic_super_magic_agents', 'source_type')) {
                $table->string('source_type', 32)->default('LOCAL_CREATE')->after('description_i18n')->comment('关联来源类型：LOCAL_CREATE=本地创建, STORE=商店添加');
            }
            if (! Schema::hasColumn('magic_super_magic_agents', 'source_id')) {
                $table->bigInteger('source_id')->nullable()->after('source_type')->comment('来源关联 ID：source_type=STORE 时关联 magic_super_magic_agent_market.id，其余为 NULL');
            }

            // 添加版本相关字段
            if (! Schema::hasColumn('magic_super_magic_agents', 'version_id')) {
                $table->bigInteger('version_id')->nullable()->after('source_id')->comment('版本ID，对应 magic_super_magic_agent_versions.id；source_type=STORE 时有值，其他为空');
            }
            if (! Schema::hasColumn('magic_super_magic_agents', 'version_code')) {
                $table->string('version_code', 32)->nullable()->after('version_id')->comment('版本号，对应 magic_super_magic_agent_versions.version；source_type=STORE 时有值，其他为空');
            }

            // 添加置顶字段
            if (! Schema::hasColumn('magic_super_magic_agents', 'pinned_at')) {
                $table->timestamp('pinned_at')->nullable()->after('version_code')->comment('置顶时间，NULL 表示未置顶');
            }

            // 项目
            if (! Schema::hasColumn('magic_super_magic_agents', 'project_id')) {
                $table->bigInteger('project_id')->nullable()->comment('项目ID');
            }
        });

        // 添加索引
        Schema::table('magic_super_magic_agents', function (Blueprint $table) {
            // 组织维度置顶排序索引
            if (! Schema::hasIndex('magic_super_magic_agents', 'idx_org_pinned_created')) {
                $table->index(['organization_code', 'pinned_at', 'created_at'], 'idx_org_pinned_created');
            }
        });

        // 填充现有数据的 name_i18n 字段（从 name 字段生成）
        Db::statement("UPDATE `magic_super_magic_agents` SET `name_i18n` = JSON_OBJECT('en', COALESCE(`name`, '')) WHERE `name_i18n` IS NULL");

        // 将 name_i18n 字段改为 NOT NULL（填充数据后）
        Db::statement("ALTER TABLE `magic_super_magic_agents` MODIFY COLUMN `name_i18n` JSON NOT NULL COMMENT 'Agent 名称（多语言），格式：{\"zh\":\"市场分析师\",\"en\":\"Marketing Analyst\"}'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
