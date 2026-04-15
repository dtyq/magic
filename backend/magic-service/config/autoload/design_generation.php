<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'video_poll' => [
        /**
         * 延迟队列等待时间，单位毫秒，默认 10 秒.
         */
        'delay_ms' => (int) env('DESIGN_VIDEO_POLL_DELAY_MS', 10000),

        /**
         * 视频生成超时时间，单位秒，默认 3600 秒（1小时）.
         */
        'timeout_seconds' => (int) env('DESIGN_VIDEO_POLL_TIMEOUT_SECONDS', 3600),
    ],
];
