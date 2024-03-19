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
        if (Schema::hasTable('magic_super_agent_audio_project')) {
            return;
        }

        Schema::create('magic_super_agent_audio_project', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('Primary key');
            $table->unsignedBigInteger('project_id')->nullable()->comment('Associated project ID');
            $table->unsignedBigInteger('topic_id')->nullable()->comment('Topic ID for summary chat');
            $table->string('model_id', 128)->nullable()->comment('AI model ID for summary');
            $table->string('task_key', 128)->nullable()->comment('ASR task key (unique identifier)');
            // Auto summary configuration fields
            $table->tinyInteger('auto_summary')->default(1)->comment('Auto summary: 1-enabled, 0-disabled');

            // Audio-specific fields
            $table->string('source', 32)->default('app')->comment('Recording source: app-application, device-device');
            $table->string('device_id', 100)->nullable()->comment('Device ID');
            $table->integer('duration')->unsigned()->nullable()->comment('Recording duration (seconds)');
            $table->bigInteger('file_size')->unsigned()->nullable()->comment('File size (bytes)');
            $table->json('tags')->nullable()->comment('Tags (JSON array)');

            // Phase management fields (aligned with AsrTaskStatusDTO)
            $table->string('current_phase', 32)->default('waiting')->comment('Current phase: waiting, merging, summarizing');
            $table->string('phase_status', 32)->nullable()->comment('Phase status: in_progress, completed, failed');
            $table->tinyInteger('phase_percent')->unsigned()->default(0)->comment('Phase progress: 0-100');
            $table->text('phase_error')->nullable()->comment('Error message when phase fails');

            // Audit fields
            $table->timestamps();
            $table->softDeletes();

            // Add index for task_key
            $table->index('task_key', 'idx_task_key');
        });

        echo 'Created magic_super_agent_audio_project table' . PHP_EOL;
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
