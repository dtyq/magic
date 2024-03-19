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
        Schema::create('magic_super_agent_project_audio_markers', function (Blueprint $table) {
            $table->bigInteger('id')->primary()->comment('Marker ID');
            $table->unsignedBigInteger('project_id')->comment('Project ID');
            $table->unsignedInteger('position_seconds')->comment('Audio playback position in seconds');
            $table->text('content')->comment('Marker content');
            $table->string('user_id', 64)->comment('Creator user ID');
            $table->string('user_organization_code', 64)->comment('User organization code');
            $table->string('created_uid', 64)->nullable()->comment('Created by user ID');
            $table->string('updated_uid', 64)->nullable()->comment('Updated by user ID');
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->softDeletes();

            // Indexes
            $table->index(['project_id', 'position_seconds'], 'idx_project_position');
            $table->index(['project_id', 'created_at'], 'idx_project_created');
            $table->index(['user_id', 'user_organization_code'], 'idx_user_org');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
