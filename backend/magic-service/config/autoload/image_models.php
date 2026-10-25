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
        // Nano Banana Pro / Google Gemini 3 Pro Image (支持 1K/2K/4K)
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'gemini-3.1-pro-image', 'match_type' => 'fuzzy'],
                ['field' => 'model_version', 'value' => 'gemini-3-pro', 'match_type' => 'fuzzy'],
                ['field' => 'model_id', 'value' => 'gemini-3-pro', 'match_type' => 'fuzzy'],
            ],
            'config' => [
                // 默认分辨率
                'default_scale' => '2K',
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
                'max_output_images' => 1,
            ],
        ],

        // ==========================================================
        // Nano Banana / Google Gemini 3.1 Flash Image (支持 512/1K/2K/4K)
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'gemini-3.1-flash-image', 'match_type' => 'fuzzy'],
                ['field' => 'model_id', 'value' => 'gemini-3.1-flash-image', 'match_type' => 'fuzzy'],
            ],
            'config' => [
                'sizes' => [
                    // 1:1
                    ['label' => '1:1', 'value' => '1024x1024', 'scale' => '1K'],
                    ['label' => '1:1', 'value' => '2048x2048', 'scale' => '2K'],
                    ['label' => '1:1', 'value' => '4096x4096', 'scale' => '4K'],
                    // 1:4
                    ['label' => '1:4', 'value' => '512x2048', 'scale' => '1K'],
                    ['label' => '1:4', 'value' => '1024x4096', 'scale' => '2K'],
                    ['label' => '1:4', 'value' => '2048x8192', 'scale' => '4K'],
                    // 1:8
                    ['label' => '1:8', 'value' => '384x3072', 'scale' => '1K'],
                    ['label' => '1:8', 'value' => '768x6144', 'scale' => '2K'],
                    ['label' => '1:8', 'value' => '1536x12288', 'scale' => '4K'],
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
                    // 4:1
                    ['label' => '4:1', 'value' => '2048x512', 'scale' => '1K'],
                    ['label' => '4:1', 'value' => '4096x1024', 'scale' => '2K'],
                    ['label' => '4:1', 'value' => '8192x2048', 'scale' => '4K'],
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
                    // 8:1
                    ['label' => '8:1', 'value' => '3072x384', 'scale' => '1K'],
                    ['label' => '8:1', 'value' => '6144x768', 'scale' => '2K'],
                    ['label' => '8:1', 'value' => '12288x1536', 'scale' => '4K'],
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
                'max_output_images' => 1,
            ],
        ],
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'gemini-3', 'match_type' => 'fuzzy'],
                ['field' => 'model_id', 'value' => 'gemini-3', 'match_type' => 'fuzzy'],
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
                'max_output_images' => 1,
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
                'max_output_images' => 1,
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
                'max_output_images' => 8,
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
                'max_output_images' => 8,
            ],
        ],

        // ==========================================================
        // Doubao Seedream 5.0 pro（支持 1K/2K 档位；自定义尺寸总像素范围：[1280x720=921600, 2048x2048x1.1025≈4624220]）- model_id 匹配
        // 官方限制：输出宽高比 [1/16, 16]；输入图片宽高需 >14px、单图不超过 30MB、最多 10 张参考图。
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_id', 'value' => 'seedream-5.0-pro', 'match_type' => 'fuzzy'],
                ['field' => 'model_id', 'value' => 'seedream-5-0-pro', 'match_type' => 'fuzzy'],
            ],
            'config' => [
                'default_scale' => '2K',
                'sizes' => [
                    // 1K 档
                    ['label' => '1:1', 'value' => '1024x1024', 'scale' => '1K'],
                    ['label' => '4:3', 'value' => '1152x864', 'scale' => '1K'],
                    ['label' => '3:4', 'value' => '864x1152', 'scale' => '1K'],
                    ['label' => '16:9', 'value' => '1424x800', 'scale' => '1K'],
                    ['label' => '9:16', 'value' => '800x1424', 'scale' => '1K'],
                    ['label' => '3:2', 'value' => '1248x832', 'scale' => '1K'],
                    ['label' => '2:3', 'value' => '832x1248', 'scale' => '1K'],
                    ['label' => '21:9', 'value' => '1568x672', 'scale' => '1K'],
                    // 2K 档
                    ['label' => '1:1', 'value' => '2048x2048', 'scale' => '2K'],
                    ['label' => '4:3', 'value' => '2368x1776', 'scale' => '2K'],
                    ['label' => '3:4', 'value' => '1776x2368', 'scale' => '2K'],
                    ['label' => '16:9', 'value' => '2816x1584', 'scale' => '2K'],
                    ['label' => '9:16', 'value' => '1584x2816', 'scale' => '2K'],
                    ['label' => '3:2', 'value' => '2496x1664', 'scale' => '2K'],
                    ['label' => '2:3', 'value' => '1664x2496', 'scale' => '2K'],
                    ['label' => '21:9', 'value' => '3136x1344', 'scale' => '2K'],
                ],
                'total_pixels_range' => [
                    'min' => 921600,
                    'max' => 4624220,
                ],
                'max_reference_images' => 10,
                'max_output_images' => 1,
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
                'max_output_images' => 8,
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
                'max_output_images' => 1,
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
                'max_output_images' => 1,
            ],
        ],

        // ==========================================================
        // Qwen Image Plus (不支持放大倍数，n 固定为 1)
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'qwen-image-plus'],
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
                'max_output_images' => 1,
            ],
        ],

        // ==========================================================
        // Qwen Image Edit Plus / Max (支持 n 参数批量出图)
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'qwen-image-edit-plus'],
                ['field' => 'model_version', 'value' => 'qwen-image-edit-max'],
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
                'max_output_images' => 6,
            ],
        ],

        // ==========================================================
        // Qwen Image 2.0 / 2.0 Pro / 3.0 Pro (支持 n 参数批量出图)
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'qwen-image-2.0'],
                ['field' => 'model_version', 'value' => 'qwen-image-2.0-pro'],
                ['field' => 'model_version', 'value' => 'qwen-image-3.0-pro'],
                ['field' => 'model_version', 'value' => 'qwen-image-3.0'],
                ['field' => 'model_id', 'value' => 'qwen-image'],
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
                'max_output_images' => 6,
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
                'max_output_images' => 1,
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
                'max_output_images' => 1,
            ],
        ],

        // ==========================================================
        // Wangsu GPT Image 2.5（透明背景 + 6 档画质只对 2.5 开放）
        // 必须排在 gpt-image-2 之前：fuzzy 是 str_contains，且 matchConfig 首个命中即返回。
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'gpt-image-2.5', 'match_type' => 'fuzzy'],
                ['field' => 'model_version', 'value' => 'gpt-image-2_5', 'match_type' => 'fuzzy'],
                ['field' => 'model_version', 'value' => 'gpt-image-2-5', 'match_type' => 'fuzzy'],
                ['field' => 'model_id', 'value' => 'gpt-image-2.5', 'match_type' => 'fuzzy'],
                ['field' => 'model_id', 'value' => 'gpt-image-2_5', 'match_type' => 'fuzzy'],
                ['field' => 'model_id', 'value' => 'gpt-image-2-5', 'match_type' => 'fuzzy'],
            ],
            'config' => [
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
                // 对未显式列出的任意尺寸做总像素约束，保持在官方允许范围内。
                'total_pixels_range' => [
                    'min' => 655360,
                    'max' => 8294400,
                ],
                'max_reference_images' => 14,
                'max_output_images' => 10,
                'image_settings' => [
                    [
                        // 2.5 独有：比 gpt-image-2 多 xhigh / max 两档（文案共用 image_model_settings.quality，不另开 key）
                        'key' => 'image_generation_config.quality',
                        'label' => 'i18n:image_generate.image_model_settings.quality.label',
                        'description' => 'i18n:image_generate.image_model_settings.quality.description',
                        'component' => 'single_select',
                        'variant' => 'segmented',
                        'default' => 'auto',
                        'options' => [
                            [
                                'label' => 'i18n:image_generate.image_model_settings.quality.options.auto',
                                'value' => 'auto',
                            ],
                            [
                                'label' => 'i18n:image_generate.image_model_settings.quality.options.low',
                                'value' => 'low',
                            ],
                            [
                                'label' => 'i18n:image_generate.image_model_settings.quality.options.medium',
                                'value' => 'medium',
                            ],
                            [
                                'label' => 'i18n:image_generate.image_model_settings.quality.options.high',
                                'value' => 'high',
                            ],
                            [
                                'label' => 'i18n:image_generate.image_model_settings.quality.options.xhigh',
                                'value' => 'xhigh',
                            ],
                            [
                                'label' => 'i18n:image_generate.image_model_settings.quality.options.max',
                                'value' => 'max',
                            ],
                        ],
                    ],
                    [
                        // 2.5 独有：三态透明背景。自动（auto，等同声明默认值，前端原样提交，后端视为「用户没动过」）/ 保留背景（opaque）/ 透明背景（transparent）
                        'key' => 'image_generation_config.background',
                        'label' => 'i18n:image_generate.image_model_settings.background.label',
                        'description' => 'i18n:image_generate.image_model_settings.background.description',
                        'component' => 'single_select',
                        'default' => 'auto',
                        'options' => [
                            [
                                'label' => 'i18n:image_generate.image_model_settings.background.options.auto',
                                'value' => 'auto',
                            ],
                            [
                                'label' => 'i18n:image_generate.image_model_settings.background.options.opaque',
                                'value' => 'opaque',
                            ],
                            [
                                'label' => 'i18n:image_generate.image_model_settings.background.options.transparent',
                                'value' => 'transparent',
                            ],
                        ],
                    ],
                ],
                // 避免 2:3 这类已声明比例被直接解析成 682x1024 之类的“换算尺寸”。
                'prefer_declared_sizes' => true,
            ],
        ],

        // ==========================================================
        // Wangsu GPT Image（2.5 以外的版本：只有质量，不提供透明背景）
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'gpt-image-2', 'match_type' => 'fuzzy'],
                ['field' => 'model_id', 'value' => 'gpt-image-2', 'match_type' => 'fuzzy'],
            ],
            'config' => [
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
                // 对未显式列出的任意尺寸做总像素约束，保持在官方允许范围内。
                'total_pixels_range' => [
                    'min' => 655360,
                    'max' => 8294400,
                ],
                'max_reference_images' => 14,
                'max_output_images' => 10,
                'image_settings' => [
                    [
                        // 特殊项：质量
                        'key' => 'image_generation_config.quality',
                        'label' => 'i18n:image_generate.image_model_settings.quality.label',
                        'description' => 'i18n:image_generate.image_model_settings.quality.description',
                        'component' => 'single_select',
                        'variant' => 'segmented',
                        'default' => 'auto',
                        // 顺序与 2.5 一致：自动在最前，其余由低到高
                        'options' => [
                            [
                                'label' => 'i18n:image_generate.image_model_settings.quality.options.auto',
                                'value' => 'auto',
                            ],
                            [
                                'label' => 'i18n:image_generate.image_model_settings.quality.options.low',
                                'value' => 'low',
                            ],
                            [
                                'label' => 'i18n:image_generate.image_model_settings.quality.options.medium',
                                'value' => 'medium',
                            ],
                            [
                                'label' => 'i18n:image_generate.image_model_settings.quality.options.high',
                                'value' => 'high',
                            ],
                        ],
                    ],
                ],
                // 避免 2:3 这类已声明比例被直接解析成 682x1024 之类的“换算尺寸”。
                'prefer_declared_sizes' => true,
            ],
        ],

        // ==========================================================
        // 兜底：所有 Gemini 系列生图模型（未在上面精确命中的）
        // 尺寸沿用 Nano Banana 2（gemini-3.1-flash-image）那套：1K/2K/4K，14 种比例。
        //
        // ⚠️ 必须放在 models 的最后一项：SizeManager::matchConfig 是「按块顺序遍历、
        // 首个命中即返回」，所以上面那些更精确的 gemini 块必须先于本块被检查。
        // 新增更精确的 gemini 块时，请插到本块之前，不要插到它后面。
        // ==========================================================
        [
            'match' => [
                ['field' => 'model_version', 'value' => 'gemini', 'match_type' => 'fuzzy'],
                ['field' => 'model_id', 'value' => 'gemini', 'match_type' => 'fuzzy'],
            ],
            'config' => [
                'sizes' => [
                    // 1:1
                    ['label' => '1:1', 'value' => '1024x1024', 'scale' => '1K'],
                    ['label' => '1:1', 'value' => '2048x2048', 'scale' => '2K'],
                    ['label' => '1:1', 'value' => '4096x4096', 'scale' => '4K'],
                    // 1:4
                    ['label' => '1:4', 'value' => '512x2048', 'scale' => '1K'],
                    ['label' => '1:4', 'value' => '1024x4096', 'scale' => '2K'],
                    ['label' => '1:4', 'value' => '2048x8192', 'scale' => '4K'],
                    // 1:8
                    ['label' => '1:8', 'value' => '384x3072', 'scale' => '1K'],
                    ['label' => '1:8', 'value' => '768x6144', 'scale' => '2K'],
                    ['label' => '1:8', 'value' => '1536x12288', 'scale' => '4K'],
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
                    // 4:1
                    ['label' => '4:1', 'value' => '2048x512', 'scale' => '1K'],
                    ['label' => '4:1', 'value' => '4096x1024', 'scale' => '2K'],
                    ['label' => '4:1', 'value' => '8192x2048', 'scale' => '4K'],
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
                    // 8:1
                    ['label' => '8:1', 'value' => '3072x384', 'scale' => '1K'],
                    ['label' => '8:1', 'value' => '6144x768', 'scale' => '2K'],
                    ['label' => '8:1', 'value' => '12288x1536', 'scale' => '4K'],
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
                'max_output_images' => 1,
            ],
        ],
    ],
];
