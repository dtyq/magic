<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddContextDataToAsyncEventRecords extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('async_event_records')) {
            return;
        }

        if (Schema::hasColumn('async_event_records', 'context_data')) {
            return;
        }

        Schema::table('async_event_records', function (Blueprint $table) {
            $table->json('context_data')->nullable()->after('args')->comment('Coroutine context data for async execution');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('async_event_records')) {
            return;
        }

        if (! Schema::hasColumn('async_event_records', 'context_data')) {
            return;
        }

        Schema::table('async_event_records', function (Blueprint $table) {
            $table->dropColumn('context_data');
        });
    }
}
