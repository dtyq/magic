<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class ExtendMagicSuperAgentProjectMembersTable extends Migration
{
    /**
     * Run the migrations.
     *
     * 注意：role字段已存在为STRING类型，MemberRole枚举已支持'manage'值，无需修改表结构
     */
    public function up(): void
    {
        Schema::table('magic_super_agent_project_members', function (Blueprint $table) {
            // 新增 join_method 字段，记录成员加入方式
            $table->string('join_method', 32)
                ->default('internal')
                ->comment('加入方式：creator-创建者，internal-内部邀请，link-链接加入')
                ->after('role');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
}
