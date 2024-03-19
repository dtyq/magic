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
        if (! Schema::hasTable('magic_organizations')) {
            return;
        }

        Schema::table('magic_organizations', function (Blueprint $table) {
            // 席位数量
            if (! Schema::hasColumn('magic_organizations', 'seats')) {
                $table->unsignedInteger('seats')->default(0)->comment('席位数量')->after('number');
            }

            // 同步相关字段
            if (! Schema::hasColumn('magic_organizations', 'sync_type')) {
                $table->string('sync_type', 32)->default('')->comment('同步类型')->after('seats');
            }
            if (! Schema::hasColumn('magic_organizations', 'sync_status')) {
                $table->tinyInteger('sync_status')->default(0)->comment('同步状态')->after('sync_type');
            }
            if (! Schema::hasColumn('magic_organizations', 'sync_time')) {
                $table->timestamp('sync_time')->nullable()->comment('同步时间')->after('sync_status');
            }

            // 索引：type（组织类型）
            $table->index('type', 'idx_magic_org_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('magic_organizations')) {
            return;
        }

        Schema::table('magic_organizations', function (Blueprint $table) {
            // 先删除索引
            try {
                $table->dropIndex('idx_magic_org_sync');
            } catch (Throwable) {
            }

            try {
                $table->dropIndex('idx_magic_org_type');
            } catch (Throwable) {
            }

            // 删除字段
            if (Schema::hasColumn('magic_organizations', 'sync_time')) {
                $table->dropColumn('sync_time');
            }
            if (Schema::hasColumn('magic_organizations', 'sync_status')) {
                $table->dropColumn('sync_status');
            }
            if (Schema::hasColumn('magic_organizations', 'sync_type')) {
                $table->dropColumn('sync_type');
            }
            if (Schema::hasColumn('magic_organizations', 'seats')) {
                $table->dropColumn('seats');
            }
        });
    }
};
