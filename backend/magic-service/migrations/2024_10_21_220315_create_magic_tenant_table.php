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
        if (Schema::hasTable('magic_tenant')) {
            return;
        }
        Schema::create('magic_tenant', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name', 255)->comment('企业名称');
            $table->string('display_id', 255)->comment('企业编号，平台内唯一');
            $table->tinyInteger('tenant_tag')->default(0)->comment('个人版/团队版标志. 1：团队版 2：个人版');
            $table->string('tenant_key', 32)->comment('企业标识');
            $table->text('avatar')->comment('企业头像');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tenant_key'], 'index_tenant_key');
            $table->index(['display_id'], 'index_display_id');
            $table->comment('企业名称、企业编号等企业信息');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_tenant');
    }
};
