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
                ['field' => 'model_version', 'value' => 'gemini-3', 'match_type' => 'fuzzy'],
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
                ['field' => 'model_id', 'value' => 'seedream-4-0', 'match_type' => 'fuzzy'],
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
                ['field' => 'model_id', 'value' => 'seedream-4-5', 'match_type' => 'fuzzy'],
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
        // Doubao Seedream 5.0 lite（1K/4K 等档位及中间过渡暂不支持文档说明；配置 2K/3K 两档尺寸）- model_id 匹配
        // 总像素范围：[2560x1440=3686400, 3072x3072x1.1025≈10404496]
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_id', 'value' => 'seedream-5.0-lite', 'match_type' => 'fuzzy'],
                ['field' => 'model_id', 'value' => 'seedream-5-0-lite', 'match_type' => 'fuzzy'],
            ],
            'config' => [
                'supported_output_formats' => [
                    'image/jpeg' => 'jpeg',
                    'image/png' => 'png',
                ],
                'sizes' => [
                    // 2K 档
                    ['label' => '1:1', 'value' => '2048x2048', 'scale' => '2K'],
                    ['label' => '3:4', 'value' => '1728x2304', 'scale' => '2K'],
                    ['label' => '4:3', 'value' => '2304x1728', 'scale' => '2K'],
                    ['label' => '16:9', 'value' => '2848x1600', 'scale' => '2K'],
                    ['label' => '9:16', 'value' => '1600x2848', 'scale' => '2K'],
                    ['label' => '3:2', 'value' => '2496x1664', 'scale' => '2K'],
                    ['label' => '2:3', 'value' => '1664x2496', 'scale' => '2K'],
                    ['label' => '21:9', 'value' => '3136x1344', 'scale' => '2K'],
                    // 3K 档
                    ['label' => '1:1', 'value' => '3072x3072', 'scale' => '3K'],
                    ['label' => '3:4', 'value' => '2592x3456', 'scale' => '3K'],
                    ['label' => '4:3', 'value' => '3456x2592', 'scale' => '3K'],
                    ['label' => '16:9', 'value' => '4096x2304', 'scale' => '3K'],
                    ['label' => '9:16', 'value' => '2304x4096', 'scale' => '3K'],
                    ['label' => '2:3', 'value' => '2496x3744', 'scale' => '3K'],
                    ['label' => '3:2', 'value' => '3744x2496', 'scale' => '3K'],
                    ['label' => '21:9', 'value' => '4704x2016', 'scale' => '3K'],
                ],
                'total_pixels_range' => [
                    'min' => 3686400,
                    'max' => 10404496,
                ],
                'max_reference_images' => 10,
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
                'max_reference_images' => 14,
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
                'max_reference_images' => 14,
            ],
        ],

        // ==========================================================
        // Wangsu GPT Image
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'gpt-image-2', 'match_type' => 'fuzzy'],
            ],
            'config' => [
                // 沿用同文件其他模型的标准比例标签，避免前端看到 7:4 / 7:3 这类“尺寸即比例”的特殊写法。
                // 同一比例按 1K -> 2K -> 4K 排列，ratio label 默认命中首个已声明档位，也就是 1K。
                // 业务若传入 1344x576、1792x1024 这类未显式列出的精确尺寸，仍会由 total_pixels_range 原样兜底。
                // 这里的 4K 沿用前端已有高分档位语义，具体宽高仍需受 gpt-image-2 官方像素上限约束。
                'sizes' => [
                    // 1:1
                    ['label' => '1:1', 'value' => '1024x1024', 'scale' => '1K'],
                    ['label' => '1:1', 'value' => '2048x2048', 'scale' => '2K'],
                    ['label' => '1:1', 'value' => '2880x2880', 'scale' => '4K'],
                    // 2:3
                    ['label' => '2:3', 'value' => '1024x1536', 'scale' => '1K'],
                    ['label' => '2:3', 'value' => '1664x2496', 'scale' => '2K'],
                    ['label' => '2:3', 'value' => '2336x3504', 'scale' => '4K'],
                    // 3:2
                    ['label' => '3:2', 'value' => '1536x1024', 'scale' => '1K'],
                    ['label' => '3:2', 'value' => '2496x1664', 'scale' => '2K'],
                    ['label' => '3:2', 'value' => '3504x2336', 'scale' => '4K'],
                    // 3:4
                    ['label' => '3:4', 'value' => '864x1152', 'scale' => '1K'],
                    ['label' => '3:4', 'value' => '1728x2304', 'scale' => '2K'],
                    ['label' => '3:4', 'value' => '2448x3264', 'scale' => '4K'],
                    // 4:3
                    ['label' => '4:3', 'value' => '1152x864', 'scale' => '1K'],
                    ['label' => '4:3', 'value' => '2304x1728', 'scale' => '2K'],
                    ['label' => '4:3', 'value' => '3264x2448', 'scale' => '4K'],
                    // 9:16
                    ['label' => '9:16', 'value' => '864x1536', 'scale' => '1K'],
                    ['label' => '9:16', 'value' => '1440x2560', 'scale' => '2K'],
                    ['label' => '9:16', 'value' => '2160x3840', 'scale' => '4K'],
                    // 16:9
                    ['label' => '16:9', 'value' => '1536x864', 'scale' => '1K'],
                    ['label' => '16:9', 'value' => '2560x1440', 'scale' => '2K'],
                    ['label' => '16:9', 'value' => '3840x2160', 'scale' => '4K'],
                    // 21:9
                    ['label' => '21:9', 'value' => '1344x576', 'scale' => '1K'],
                    ['label' => '21:9', 'value' => '2688x1152', 'scale' => '2K'],
                    ['label' => '21:9', 'value' => '3696x1584', 'scale' => '4K'],
                ],
                // 对未显式列出的任意尺寸做总像素约束，保持在 gpt-image-2 官方允许范围内。
                'total_pixels_range' => [
                    'min' => 655360,
                    'max' => 8294400,
                ],
                'max_reference_images' => 14,
                // 避免 2:3 这类已声明比例被直接解析成 682x1024 之类的“换算尺寸”。
                'prefer_declared_sizes' => true,
            ],
        ],
    ],
];
