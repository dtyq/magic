<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // Whether to require public IP validation for SSRF defense
    // Set too false to allow private IP ranges (use with caution, security risk)
    'require_public_ip' => (bool) env('SSRF_REQUIRE_PUBLIC_IP', true),
];
