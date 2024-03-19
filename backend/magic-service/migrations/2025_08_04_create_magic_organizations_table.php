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
        if (Schema::hasTable('magic_organizations')) {
            return;
        }
        Schema::create('magic_organizations', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键ID');
            $table->string('magic_organization_code', 100)->unique()->comment('组织编码');
            $table->string('name', 100)->comment('组织名称');
            $table->string('platform_type', 64)->nullable()->comment('平台类型');
            $table->mediumText('logo')->nullable()->comment('组织logo');
            $table->mediumText('introduction')->nullable()->comment('企业描述');
            $table->string('contact_user')->nullable()->comment('联系人');
            $table->string('contact_mobile', 32)->nullable()->comment('联系电话');
            $table->string('industry_type')->comment('组织行业类型');
            $table->string('number', 32)->nullable()->comment('企业规模');
            $table->tinyInteger('status')->default(1)->comment('状态 1:正常 2:禁用');
            $table->string('creator_id', 64)->nullable()->comment('创建人');
            $table->tinyInteger('type')->default(0)->comment('组织类型 0:团队组织 1:个人组织');
            $table->timestamps();
            $table->softDeletes();

            // 索引
            $table->index('magic_organization_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_organizations');
    }
};
