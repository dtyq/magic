<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // Default prompt for image convert high definition
    'default_convert_high_prompt' => 'Please perform a high-fidelity upscale on this image. Increase the resolution while maintaining 100% consistency with the original style, colors, and composition. Remove all blur, noise, and compression artifacts. Sharpen the edges and enhance the clarity of all textures. Ensure the output is crystal clear and looks like a high-resolution original source, regardless of the artistic medium. ',

    'models' => [
        // ==========================================================
        // Nano Banana Pro / Google Gemini 3.0 (支持 1K/2K/4K)
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'gemini-3,1-pro-image-preview'],
                ['field' => 'model_version', 'value' => 'gemini-3.1-flash-image-preview'],
                ['field' => 'model_version', 'value' => 'gemini-3-pro-image-preview'],
                ['field' => 'model_version', 'value' => 'gemini-3-pro-image'],
            ],
            'config' => [
                'sizes' => [
                    // 1:1
                    ['label' => '1:1', 'value' => '1024x1024', 'scale' => '1K'],
                    ['label' => '1:1', 'value' => '2048x2048', 'scale' => '2K'],
                    ['label' => '1:1', 'value' => '4096x4096', 'scale' => '4K'],
                    // 2:3
                    ['label' => '2:3', 'value' => '848x1264', 'scale' => '1K'],
                    ['label' => '2:3', 'value' => '1696x2528', 'scale' => '2K'],
                    ['label' => '2:3', 'value' => '3392x5056', 'scale' => '4K'],
                    // 3:2
                    ['label' => '3:2', 'value' => '1264x848', 'scale' => '1K'],
                    ['label' => '3:2', 'value' => '2528x1696', 'scale' => '2K'],
                    ['label' => '3:2', 'value' => '5056x3392', 'scale' => '4K'],
                    // 3:4
                    ['label' => '3:4', 'value' => '896x1200', 'scale' => '1K'],
                    ['label' => '3:4', 'value' => '1792x2400', 'scale' => '2K'],
                    ['label' => '3:4', 'value' => '3584x4800', 'scale' => '4K'],
                    // 4:3
                    ['label' => '4:3', 'value' => '1200x896', 'scale' => '1K'],
                    ['label' => '4:3', 'value' => '2400x1792', 'scale' => '2K'],
                    ['label' => '4:3', 'value' => '4800x3584', 'scale' => '4K'],
                    // 4:5
                    ['label' => '4:5', 'value' => '928x1152', 'scale' => '1K'],
                    ['label' => '4:5', 'value' => '1856x2304', 'scale' => '2K'],
                    ['label' => '4:5', 'value' => '3712x4608', 'scale' => '4K'],
                    // 5:4
                    ['label' => '5:4', 'value' => '1152x928', 'scale' => '1K'],
                    ['label' => '5:4', 'value' => '2304x1856', 'scale' => '2K'],
                    ['label' => '5:4', 'value' => '4608x3712', 'scale' => '4K'],
                    // 9:16
                    ['label' => '9:16', 'value' => '768x1376', 'scale' => '1K'],
                    ['label' => '9:16', 'value' => '1536x2752', 'scale' => '2K'],
                    ['label' => '9:16', 'value' => '3072x5504', 'scale' => '4K'],
                    // 16:9
                    ['label' => '16:9', 'value' => '1376x768', 'scale' => '1K'],
                    ['label' => '16:9', 'value' => '2752x1536', 'scale' => '2K'],
                    ['label' => '16:9', 'value' => '5504x3072', 'scale' => '4K'],
                    // 21:9
                    ['label' => '21:9', 'value' => '1584x672', 'scale' => '1K'],
                    ['label' => '21:9', 'value' => '3168x1344', 'scale' => '2K'],
                    ['label' => '21:9', 'value' => '6336x2688', 'scale' => '4K'],
                ],
                'max_reference_images' => 14,
            ],
        ],

        // ==========================================================
        // Nano Banana / Google Gemini 2.5 (仅支持 1K)
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'gemini-2.5-flash-image'],
            ],
            'config' => [
                'sizes' => [
                    ['label' => '1:1', 'value' => '1024x1024', 'scale' => null],
                    ['label' => '2:3', 'value' => '1024x1536', 'scale' => null],
                    ['label' => '3:2', 'value' => '1536x1024', 'scale' => null],
                    ['label' => '3:4', 'value' => '1024x1365', 'scale' => null],
                    ['label' => '4:3', 'value' => '1365x1024', 'scale' => null],
                    ['label' => '4:5', 'value' => '1024x1280', 'scale' => null],
                    ['label' => '5:4', 'value' => '1280x1024', 'scale' => null],
                    ['label' => '9:16', 'value' => '1024x1820', 'scale' => null],
                    ['label' => '16:9', 'value' => '1820x1024', 'scale' => null],
                    ['label' => '21:9', 'value' => '2389x1024', 'scale' => null],
                ],
                'max_reference_images' => 14,
            ],
        ],

        // ==========================================================
        // Doubao Seedream 4.0 (不支持放大倍数) - 使用 model_id 匹配
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_id', 'value' => 'seedream-4-0'],
            ],
            'config' => [
                'sizes' => [
                    ['label' => '1:1', 'value' => '2048x2048', 'scale' => null],
                    ['label' => '2:3', 'value' => '1664x2496', 'scale' => null],
                    ['label' => '3:2', 'value' => '2496x1664', 'scale' => null],
                    ['label' => '3:4', 'value' => '1728x2304', 'scale' => null],
                    ['label' => '4:3', 'value' => '2304x1728', 'scale' => null],
                    ['label' => '9:16', 'value' => '1440x2560', 'scale' => null],
                    ['label' => '16:9', 'value' => '2560x1440', 'scale' => null],
                    ['label' => '21:9', 'value' => '2048x2048', 'scale' => null],
                ],
                'total_pixels_range' => [
                    'min' => 921600,
                    'max' => 16777216,
                ],
                'max_reference_images' => 14,
            ],
        ],

        // ==========================================================
        // Doubao Seedream 4.5 (支持放大倍数 2X/4X) - 使用 model_id 匹配
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_id', 'value' => 'seedream-4-5'],
            ],
            'config' => [
                'sizes' => [
                    // 1:1
                    ['label' => '1:1', 'value' => '2048x2048', 'scale' => '2K'],
                    ['label' => '1:1', 'value' => '4096x4096', 'scale' => '4K'],
                    // 2:3
                    ['label' => '2:3', 'value' => '1664x2496', 'scale' => '2K'],
                    ['label' => '2:3', 'value' => '2731x4096', 'scale' => '4K'],
                    // 3:2
                    ['label' => '3:2', 'value' => '2496x1664', 'scale' => '2K'],
                    ['label' => '3:2', 'value' => '4096x2731', 'scale' => '4K'],
                    // 3:4
                    ['label' => '3:4', 'value' => '1728x2304', 'scale' => '2K'],
                    ['label' => '3:4', 'value' => '3072x4096', 'scale' => '4K'],
                    // 4:3
                    ['label' => '4:3', 'value' => '2304x1728', 'scale' => '2K'],
                    ['label' => '4:3', 'value' => '4096x3072', 'scale' => '4K'],
                    // 9:16
                    ['label' => '9:16', 'value' => '1440x2560', 'scale' => '2K'],
                    ['label' => '9:16', 'value' => '2304x4096', 'scale' => '4K'],
                    // 16:9
                    ['label' => '16:9', 'value' => '2560x1440', 'scale' => '2K'],
                    ['label' => '16:9', 'value' => '4096x2304', 'scale' => '4K'],
                    // 21:9
                    ['label' => '21:9', 'value' => '2048x878', 'scale' => '2K'],
                    ['label' => '21:9', 'value' => '4096x1755', 'scale' => '4K'],
                ],
                'total_pixels_range' => [
                    'min' => 3686400,
                    'max' => 16777216,
                ],
                'max_reference_images' => 14,
            ],
        ],

        // ==========================================================
        // Qwen Image (不支持放大倍数)
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'qwen-image'],
            ],
            'config' => [
                'sizes' => [
                    ['label' => '1:1', 'value' => '1328x1328', 'scale' => null],
                    ['label' => '3:4', 'value' => '1104x1472', 'scale' => null],
                    ['label' => '4:3', 'value' => '1472x1104', 'scale' => null],
                    ['label' => '9:16', 'value' => '928x1664', 'scale' => null],
                    ['label' => '16:9', 'value' => '1664x928', 'scale' => null],
                ],
            ],
        ],

        // ==========================================================
        // Qwen Image Edit (不支持放大倍数)
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'qwen-image-edit'],
            ],
            'config' => [
                'sizes' => [],
                'max_reference_images' => 3,
            ],
        ],

        // ==========================================================
        // Qwen Image Edit Plus (不支持放大倍数)
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'qwen-image-plus'],
                ['field' => 'model_version', 'value' => 'qwen-image-edit-plus'],
                ['field' => 'model_version', 'value' => 'qwen-image-edit-max'],
                ['field' => 'model_version', 'value' => 'qwen-image-2.0'],
                ['field' => 'model_version', 'value' => 'qwen-image-2.0-pro'],
            ],
            'config' => [
                'sizes' => [
                    // 1:1
                    ['label' => '1:1', 'value' => '1536x1536', 'scale' => null],
                    // 2:3
                    ['label' => '2:3', 'value' => '1024x1536', 'scale' => null],
                    // 3:2
                    ['label' => '3:2', 'value' => '1536x1024', 'scale' => null],
                    // 3:4
                    ['label' => '3:4', 'value' => '1080x1440', 'scale' => null],
                    // 4:3
                    ['label' => '4:3', 'value' => '1440x1080', 'scale' => null],
                    // 9:16
                    ['label' => '9:16', 'value' => '1080x1920', 'scale' => null],
                    // 16:9
                    ['label' => '16:9', 'value' => '1920x1080', 'scale' => null],
                    // 21:9
                    ['label' => '21:9', 'value' => '2048x872', 'scale' => null],
                ],
                'total_pixels_range' => [
                    'min' => 262144,
                    'max' => 4194304,
                ],
                'max_reference_images' => 3,
            ],
        ],

        // ==========================================================
        // Azure OpenAI Image Generate
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'AzureOpenAI-ImageGenerate'],
            ],
            'config' => [
                'sizes' => [
                    ['label' => '1:1', 'value' => '1024x1024', 'scale' => null],
                    ['label' => '2:3', 'value' => '1024x1536', 'scale' => null],
                    ['label' => '3:2', 'value' => '1536x1024', 'scale' => null],
                ],
            ],
        ],

        // ==========================================================
        // Azure OpenAI Image Edit
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'AzureOpenAI-ImageEdit'],
            ],
            'config' => [
                'sizes' => [
                    ['label' => '1:1', 'value' => '1024x1024', 'scale' => null],
                    ['label' => '2:3', 'value' => '1024x1536', 'scale' => null],
                    ['label' => '3:2', 'value' => '1536x1024', 'scale' => null],
                ],
            ],
        ],
    ],
];
