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
    'errors' => [
        'generic' => 'Video generation failed. Please check your input and try again later.',
        'user_concurrency_limit' => 'Your video generation concurrency limit has been reached (maximum :limit running task(s)). Please wait for an existing task to finish before submitting another one.',
        'organization_concurrency_limit' => 'This organization has reached its video generation concurrency limit (maximum :limit running task(s)). Please wait for an existing organization task to finish before submitting another one.',

        // volcengine ark
        'SensitiveContentDetected' => 'The input or generated content may contain sensitive material. Please adjust the prompt or assets and try again.',
        'InputTextSensitiveContentDetected' => [
            'PolicyViolation' => 'The input prompt may involve copyright-related restrictions. Please remove celebrity, IP, or brand references and try again.',
        ],
        'InputImageSensitiveContentDetected' => [
            'PolicyViolation' => 'The input image may involve copyright-related restrictions. Please replace it with low-risk assets and try again.',
            'PrivacyInformation' => 'The input image may contain a real person or face. Please replace it with non-person content and try again.',
        ],
        'InputVideoSensitiveContentDetected' => [
            'PolicyViolation' => 'The input video may involve copyright-related restrictions. Please replace it with low-risk assets and try again.',
            'PrivacyInformation' => 'The input video may contain a real person or face. Please replace it with non-person content and try again.',
        ],
        'InputAudioSensitiveContentDetected' => [
            'PolicyViolation' => 'The input audio may involve copyright-related restrictions. Please replace it with royalty-free audio and try again.',
        ],
        'OutputTextSensitiveContentDetected' => 'The generated content may contain sensitive material. Please adjust the prompt and try again.',
        'OutputImageSensitiveContentDetected' => 'The generated image may contain sensitive or restricted content. Please adjust the prompt or reference assets and try again.',
        'OutputVideoSensitiveContentDetected' => [
            'PolicyViolation' => 'The request failed because the output video may be related to copyright restrictions. Please adjust your prompt, audio, or reference assets and try again.',
        ],
        'OutputAudioSensitiveContentDetected' => 'The generated audio may contain sensitive or restricted content. Please adjust the prompt or reference assets and try again.',
        'ContentSecurity' => [
            'CopyrightRisk' => 'The content may involve copyright risk. Please remove copyrighted audio or brand, celebrity, or IP references and try again.',
            'SensitiveContent' => 'The input may contain sensitive content. Please simplify the prompt and remove inappropriate or restricted content before trying again.',
            'TrademarkRisk' => 'The asset may contain a logo or trademark. Please crop, blur, or replace the marked asset and try again.',
            'ViolentContent' => 'The input may contain violent or inappropriate content. Please replace it with compliant material and try again.',
        ],
        'MissingParameter' => 'A required request parameter is missing. Please review the request and try again.',
        'InvalidParameter' => [
            'InvalidVideoDuration' => 'The requested video duration is not supported. Please switch to a supported duration and try again.',
            'InvalidResolution' => 'The requested resolution is not supported. Please use 480p or 720p and try again.',
            'EmptyInput' => 'No valid image, video, or audio input was found. Please confirm the asset upload succeeded and try again.',
        ],
        'InvalidRequestError' => 'The request format is invalid. Please review the request body and try again.',
        'InvalidArgumentError' => 'One or more request arguments are invalid. Please review the parameters and try again.',
        /*  'InvalidEndpointOrModel' => [
            'NotFound' => 'The model or inference endpoint does not exist, or your account does not have access to it. Please review the model configuration and try again.',
            'ModelIDAccessDisabled' => 'Your account is not allowed to access this model by model ID. Please use an authorized inference endpoint instead.',
        ],
        'ModelNotOpen' => 'This account has not enabled the model service yet. Please enable it in the ModelArk console and try again.',
        'NotFound' => 'The requested resource was not found. Please review the identifier and try again.',
        'UnsupportedModel' => 'The current model does not support this capability. Please switch to a compatible model and try again.',
        'AuthenticationError' => 'Authentication failed. Please review your API key or authorization settings and try again.',
        'AccessDenied' => 'Your account does not have permission to access this resource. Please review the permission settings and try again.',
        'OperationDenied' => [
            'PermissionDenied' => 'Your account is not permitted to access this model configuration. Please review the permissions and try again.',
            'CustomizationNotSupported' => 'This model version does not support the requested customization capability. Please switch to a compatible model version.',
            'ServiceNotOpen' => 'The model service is not enabled. Please activate it in the ModelArk console and try again.',
            'ServiceOverdue' => 'Your account is overdue and cannot call this service right now. Please recharge and try again.',
            'InvalidState' => 'The target resource is currently unavailable. Please try again later.',
            'UnsupportedPhase' => 'The target resource is in a special state and does not support this action right now. Please try again later.',
            'FileQuotaExceeded' => 'Your file storage quota has been exhausted. Please delete historical files and try again.',
        ],
        'AccountOverdueError' => 'Your account is overdue. Please recharge and try again.',
        'RateLimitExceeded' => [
            'EndpointRPMExceeded' => 'The inference endpoint RPM limit has been exceeded. Please try again later.',
            'EndpointTPMExceeded' => 'The inference endpoint TPM limit has been exceeded. Please try again later.',
        ],
        'ModelAccountRpmRateLimitExceeded' => 'The model RPM limit has been exceeded. Please try again later.',
        'ModelAccountTpmRateLimitExceeded' => 'The model TPM limit has been exceeded. Please try again later.',
        'APIAccountRpmRateLimitExceeded' => 'The API RPM limit has been exceeded. Please try again later.',
        'ModelAccountIpmRateLimitExceeded' => 'The model IPM limit has been exceeded. Please try again later.',
        'RequestConcurrentLimitExceeded' => 'The concurrent request limit has been reached. Please try again later.',
        'RequestBurstTooFast' => 'Traffic ramped up too quickly and triggered protection. Please slow down and try again.',
        'SetLimitExceeded' => 'The model has reached the configured Safe Experience Mode limit. Please adjust the limit or disable Safe Experience Mode and try again.',
        'InflightBatchsizeExceeded' => 'The maximum concurrency limit for the current quota has been reached. Please reduce concurrency or recharge for a higher limit.',
        'AccountRateLimitExceeded' => 'The request exceeded the RPM or TPM limit. Please try again later.',
        'QuotaExceeded' => 'The account has exceeded the available quota. Please wait for the quota to reset or enable more capacity and try again.',
        'ServerOverloaded' => 'The service is currently overloaded. Please try again later.',*/
        'InternalServiceError' => 'The service encountered an internal error. Please try again later.',
        'InvalidFileFormat' => 'The asset format is not supported. Please use JPG/PNG images, MP4 videos, or MP3/WAV audio files.',
        'FileSizeTooLarge' => 'The asset file is too large. Please compress the file and try again.',
        'AudioDurationTooLong' => 'The audio is longer than the target video duration. Please trim the audio and try again.',
    ],
];
