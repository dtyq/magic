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
        if (! Schema::hasTable('knowledge_base_ingestion_sources')) {
            Schema::create('knowledge_base_ingestion_sources', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('organization_code', 64);
                $table->string('provider', 64);
                $table->string('source_code', 128);
                $table->string('name', 255);
                $table->boolean('enabled')->default(true);
                $table->string('credential_ref', 255)->default('');
                $table->json('config');
                $table->json('sync_cursor')->nullable();
                $table->string('last_sync_status', 32)->default('');
                $table->string('last_sync_error', 1024)->default('');
                $table->dateTime('last_synced_at')->nullable();
                $table->string('created_uid', 64)->default('');
                $table->string('updated_uid', 64)->default('');
                $table->datetimes();

                $table->unique(['organization_code', 'provider', 'source_code'], 'uniq_kb_ingestion_source');
                $table->index(['organization_code', 'provider', 'enabled', 'id'], 'idx_kb_ingestion_source_enabled');
            });
        }

        if (! Schema::hasTable('knowledge_base_ingestion_items')) {
            Schema::create('knowledge_base_ingestion_items', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('organization_code', 64);
                $table->string('provider', 64);
                $table->string('source_code', 128);
                $table->string('item_ref', 191);
                $table->string('item_type', 32);
                $table->string('title', 512)->default('');
                $table->string('source_url', 1024)->default('');
                $table->string('extension', 32)->default('md');
                $table->char('raw_hash', 64)->default('');
                $table->char('clean_hash', 64)->default('');
                $table->unsignedBigInteger('clean_size')->default(0);
                $table->string('cleaner_version', 64)->default('');
                $table->string('status', 32)->default('pending');
                $table->json('snapshot_meta')->nullable();
                $table->string('last_error', 2048)->default('');
                $table->dateTime('last_pulled_at')->nullable();
                $table->dateTime('last_cleaned_at')->nullable();
                $table->datetimes();

                $table->unique(['organization_code', 'provider', 'source_code', 'item_ref'], 'uniq_kb_ingestion_item');
                $table->index(['organization_code', 'provider', 'source_code', 'status', 'id'], 'idx_kb_ingestion_item_status');
                $table->index(['organization_code', 'provider', 'source_code', 'clean_hash', 'id'], 'idx_kb_ingestion_item_clean_hash');
            });
        }

        if (! Schema::hasTable('knowledge_base_ingestion_item_contents')) {
            Schema::create('knowledge_base_ingestion_item_contents', function (Blueprint $table) {
                $table->unsignedBigInteger('item_id')->primary();
                $table->string('organization_code', 64);
                $table->string('provider', 64);
                $table->string('source_code', 128);
                $table->string('item_ref', 191);
                $table->char('clean_hash', 64);
                $table->mediumText('content');
                $table->string('content_format', 32)->default('markdown');
                $table->string('content_charset', 32)->default('utf-8');
                $table->unsignedBigInteger('content_size')->default(0);
                $table->datetimes();

                $table->index(['organization_code', 'provider', 'source_code', 'item_ref'], 'idx_kb_ingestion_content_lookup');
                $table->index(['organization_code', 'provider', 'source_code', 'clean_hash'], 'idx_kb_ingestion_content_hash');
            });
        }

        if (! Schema::hasTable('knowledge_base_ingestion_runs')) {
            Schema::create('knowledge_base_ingestion_runs', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('organization_code', 64);
                $table->string('provider', 64);
                $table->string('source_code', 128);
                $table->string('run_type', 32);
                $table->string('status', 32);
                $table->unsignedInteger('pulled_count')->default(0);
                $table->unsignedInteger('changed_count')->default(0);
                $table->unsignedInteger('cleaned_count')->default(0);
                $table->unsignedInteger('skipped_count')->default(0);
                $table->unsignedInteger('failed_count')->default(0);
                $table->string('error_summary', 2048)->default('');
                $table->dateTime('started_at');
                $table->dateTime('finished_at')->nullable();

                $table->index(['organization_code', 'provider', 'source_code', 'started_at'], 'idx_kb_ingestion_run_source');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_base_ingestion_runs');
        Schema::dropIfExists('knowledge_base_ingestion_item_contents');
        Schema::dropIfExists('knowledge_base_ingestion_items');
        Schema::dropIfExists('knowledge_base_ingestion_sources');
    }
};
