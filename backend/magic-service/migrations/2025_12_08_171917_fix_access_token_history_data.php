<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    /**
     * Run the migrations.
     * Mask historical access_token data that was stored in plain text.
     */
    public function up(): void
    {
        Db::table('magic_api_access_tokens')->orderBy('id')->chunk(100, function ($tokens) {
            foreach ($tokens as $token) {
                $accessToken = $token['access_token'];

                // Skip if already masked (contains *)
                if (str_contains($accessToken, '*')) {
                    continue;
                }

                // Apply masking: keep first 7 chars + asterisks + last 4 chars
                $maskedToken = substr($accessToken, 0, 7)
                    . str_repeat('*', max(0, strlen($accessToken) - 11))
                    . substr($accessToken, -4);

                Db::table('magic_api_access_tokens')
                    ->where('id', $token['id'])
                    ->update(['access_token' => $maskedToken]);
            }
        });
    }

    /**
     * Reverse the migrations.
     * This operation is irreversible as the original token cannot be recovered.
     */
    public function down(): void
    {
        // Cannot reverse: original access_token values are not recoverable
    }
};
