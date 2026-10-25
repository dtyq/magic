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
        if (Schema::hasTable('magic_data_archive_task_records')) {
            return;
        }

        Schema::create('magic_data_archive_task_records', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('archive_type', 64);
            $table->string('archive_mode', 16)->default('full');
            $table->date('stat_date');
            $table->string('source_start_id', 128)->default('');
            $table->string('source_end_id', 128)->default('');
            $table->string('status', 16)->default('pending');
            $table->unsignedBigInteger('archived_count')->default(0);
            $table->json('extra')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->unique(['archive_type', 'stat_date'], 'uk_data_archive_task_type_date');
            $table->index(['status', 'stat_date'], 'idx_data_archive_task_status_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_data_archive_task_records');
    }
};
