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
        if (Schema::hasTable('magic_super_magic_claw')) {
            return;
        }
        Schema::create('magic_super_magic_claw', function (Blueprint $table) {
            $table->bigInteger('id')->primary()->comment('Snowflake ID');
            $table->string('code', 64)->unique()->comment('Unique claw code');
            $table->string('name', 255)->comment('Claw name');
            $table->text('description')->nullable()->comment('Claw description');
            $table->text('icon')->nullable()->comment('Icon file key');
            $table->string('organization_code', 64)->comment('Organization code');
            $table->string('user_id', 64)->comment('Creator user ID');
            $table->unsignedBigInteger('project_id')->nullable()->comment('Associated project ID');
            $table->string('created_uid', 64)->default('')->comment('Creator user ID');
            $table->string('updated_uid', 64)->default('')->comment('Last updater user ID');
            $table->datetimes();
            $table->softDeletes();
            $table->index(['user_id', 'organization_code'], 'idx_user_organization');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_super_magic_claw');
    }
};
