<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

class CreateMagicModelAuditLogsTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_model_audit_logs')) {
            return;
        }

        Schema::create('magic_model_audit_logs', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键ID');
            $table->string('user_id', 64)->default('')->comment('Magic 用户 ID');
            $table->string('organization_code', 64)->default('')->comment('调用时组织编码');
            $table->string('ip', 45)->default('')->comment('IP地址');
            $table->string('type', 50)->default('')->comment('类型(TEXT/EMBEDDING/IMAGE/SEARCH/WEB_SCRAPE)');
            $table->string('product_code', 255)->default('')->comment('引擎/模型标识');
            $table->string('status', 20)->default('')->comment('调用状态(SUCCESS/FAIL)');
            $table->string('ak', 50)->default('')->comment('脱敏访问凭证');
            $table->bigInteger('operation_time')->default(0)->comment('操作时间戳(毫秒)');
            $table->integer('all_latency')->default(0)->comment('总耗时(毫秒)');
            $table->json('usage')->comment('花费信息(token或次数)');
            $table->json('detail_info')->nullable()->comment('详情信息');
            $table->timestamp('created_at')->default(Db::raw('CURRENT_TIMESTAMP'))->comment('创建时间');
            $table->timestamp('updated_at')->default(Db::raw('CURRENT_TIMESTAMP'))->comment('修改时间')->nullable();

            $table->index('user_id', 'idx_magic_model_audit_logs_user_id');
            $table->index('organization_code', 'idx_magic_model_audit_logs_org_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_model_audit_logs');
    }
}
