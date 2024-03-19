<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

class CreateMagicApiOrganizationConfigTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_api_organization_configs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code')->comment('组织编码');
            $table->unsignedDecimal('total_amount', 40, 6)->comment('总额度');
            $table->unsignedDecimal('use_amount', 40, 6)->comment('使用额度')->default(0);
            $table->timestamp('created_at')->default(Db::raw('CURRENT_TIMESTAMP'))->comment('创建时间');
            $table->timestamp('updated_at')->default(Db::raw('CURRENT_TIMESTAMP'))->comment('修改时间')->nullable();
            $table->timestamp('deleted_at')->comment('逻辑删除')->nullable();
            // rpm
            $table->unsignedInteger('rpm')->comment('RPM限流')->default(5000);
            $table->unique(['organization_code'], 'idx_organization');
        });
    }

    /**
     * php bin/hyperf.php gen:migration create_magic_api_msg_log_table
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_api_organization_config');
    }
}
