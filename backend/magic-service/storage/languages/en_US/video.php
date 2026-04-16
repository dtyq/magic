<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'input_modes' => [
        'standard' => 'Standard text-to-video mode without any reference assets.',
        'omni_reference' => 'Omni reference mode: upload 1 to :max_count image, video, or audio reference assets and combine them with a text prompt to generate a custom interactive video. Example: blend the subject from @image 1, the motion from @video 3, and the timbre from @audio 2 across 1 to :max_count assets to create an atmospheric short film.',
        'keyframe_guided' => [
            'start_end' => 'First and last frame mode: lock the starting scene with the first frame and the ending scene with the last frame, then let AI complete the motion story in between.',
            'start_only' => 'First frame only mode: lock the starting scene with the first frame, then let AI animate the scene into a coherent video story.',
        ],
        'image_reference' => [
            'single' => 'Single image reference mode: upload 1 reference image and a text prompt to generate a highly matched video. Example: reference @image 1 to generate a dynamic video.',
            'multiple' => 'Image reference mode: upload 1 to :max_count reference images and a text prompt so AI can blend style, subject, and scene details into a video that closely matches the source images. Example: reference the style of @image 1 and the scene of @image 2 to generate a smooth dynamic video.',
        ],
    ],
];
