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
        Schema::table('magic_flow_execute_logs', function (Blueprint $table) {
            $table->string('organization_code')->default('')->comment('组织代码');
            $table->string('flow_type')->default('')->comment('流程类型');
            $table->string('parent_flow_code')->default('')->comment('父流程代码');
            $table->string('operator_id')->default('')->comment('操作员ID');
            $table->integer('level')->default(0)->comment('级别');
            $table->string('execution_type')->default('')->comment('执行类型');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('', function (Blueprint $table) {
        });
    }
};
