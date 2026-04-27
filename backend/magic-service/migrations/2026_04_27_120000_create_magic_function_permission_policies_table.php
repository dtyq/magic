<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('magic_function_permission_policies')) {
            return;
        }

        Schema::create('magic_function_permission_policies', static function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->string('function_code', 128)->comment('功能编码');
            $table->tinyInteger('enabled')->default(0)->comment('是否启用功能权限控制');
            $table->json('binding_scope')->nullable()->comment('绑定范围');
            $table->string('remark', 255)->nullable()->comment('备注');
            $table->timestamps();

            $table->unique(['organization_code', 'function_code'], 'uk_org_function_code');
            $table->comment('前台功能权限策略表');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_function_permission_policies');
    }
};
