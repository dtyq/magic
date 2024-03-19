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
        Schema::create('magic_flow_tool_sets', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 32)->comment('组织编码');
            $table->string('code', 80)->comment('工具集编码');
            $table->string('name', 64)->comment('工具集名称');
            $table->string('description', 255)->comment('工具集描述');
            $table->string('icon', 255)->comment('工具集图标');
            $table->boolean('enabled')->default(true)->comment('是否启用');
            $table->string('created_uid', 80)->comment('创建人');
            $table->dateTime('created_at')->comment('创建时间');
            $table->string('updated_uid', 80)->comment('修改人');
            $table->dateTime('updated_at')->comment('修改时间');
            $table->softDeletes();

            $table->unique(['organization_code', 'code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
