<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google;

use Exception;
use GuzzleHttp\Client;
use Hyperf\Codec\Json;

class GoogleGeminiAPI
{
    protected const REQUEST_TIMEOUT = 300;

    protected string $apiUrl;

    protected string $accessToken;

    protected string $modelId;

    public function __construct(string $accessToken, string $apiUrl, string $modelId = 'gemini-2.5-flash-image-preview')
    {
        $this->accessToken = $accessToken;
        $this->apiUrl = rtrim($apiUrl, '/');
        $this->modelId = $modelId;
    }

    public function setAccessToken(string $accessToken): void
    {
        $this->accessToken = $accessToken;
    }

    public function setModelId(string $modelId): void
    {
        $this->modelId = $modelId;
    }

    public function generateImageFromText(string $prompt, array $config = []): array
    {
        $defaultConfig = [
            'temperature' => 0.7,
            'candidateCount' => 1,
            'maxOutputTokens' => 2048,
        ];

        $config = array_merge($defaultConfig, $config);

        $contents = [
            [
                'parts' => [
                    [
                        'text' => $prompt,
                    ],
                ],
            ],
        ];

        $generationConfig = [
            'temperature' => $config['temperature'],
            'candidateCount' => $config['candidateCount'],
            'maxOutputTokens' => $config['maxOutputTokens'],
        ];

        return $this->generateContent($contents, $generationConfig);
    }

    public function editLocalImage(string $imagePath, string $instructions): array
    {
        if (! file_exists($imagePath)) {
            throw new Exception("图像文件不存在: {$imagePath}");
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $imagePath);
        finfo_close($finfo);

        $imageData = base64_encode(file_get_contents($imagePath));

        $contents = [
            [
                'role' => 'user',
                'parts' => [
                    [
                        'inlineData' => [
                            'mimeType' => $mimeType,
                            'data' => $imageData,
                        ],
                    ],
                    [
                        'text' => $instructions,
                    ],
                ],
            ],
        ];

        // 为图像编辑设置正确的生成配置
        $generationConfig = [
            'temperature' => 1,
            'maxOutputTokens' => 32768,
            'responseModalities' => ['TEXT', 'IMAGE'], // 关键：指定我们需要图像响应
            'topP' => 0.95,
        ];

        return $this->generateContent($contents, $generationConfig);
    }

    public function generateContent(array $contents, ?array $generationConfig = null, ?array $safetySettings = null): array
    {
        if ($generationConfig === null) {
            $generationConfig = [
                'temperature' => 1,
                'maxOutputTokens' => 32768,
                'responseModalities' => ['TEXT', 'IMAGE'],
                'topP' => 0.95,
            ];
        }

        if ($safetySettings === null) {
            $safetySettings = $this->getDefaultSafetySettings();
        }

        $payload = [
            'contents' => $contents,
            'generationConfig' => $generationConfig,
            'safetySettings' => $safetySettings,
        ];

        return $this->makeRequest('generateContent', $payload);
    }

    public function editBase64Image(string $imageBase64, string $mimeType, string $instructions): array
    {
        $contents = [
            [
                'role' => 'user',
                'parts' => [
                    [
                        'inlineData' => [
                            'mimeType' => $mimeType,
                            'data' => $imageBase64,
                        ],
                    ],
                    [
                        'text' => $instructions,
                    ],
                ],
            ],
        ];

        // 为图像编辑设置正确的生成配置
        $generationConfig = [
            'temperature' => 1,
            'maxOutputTokens' => 32768,
            'responseModalities' => ['TEXT', 'IMAGE'], // 关键：指定我们需要图像响应
            'topP' => 0.95,
        ];

        return $this->generateContent($contents, $generationConfig);
    }

    protected function makeRequest(string $endpoint, array $payload): array
    {
        $url = "{$this->apiUrl}/models/{$this->modelId}:{$endpoint}";

        $headers = [
            'Content-Type' => 'application/json',
            'x-goog-api-key' => $this->accessToken,
        ];

        $client = new Client(['timeout' => self::REQUEST_TIMEOUT]);

        $response = $client->post($url, [
            'headers' => $headers,
            'json' => $payload,
        ]);

        $result = Json::decode($response->getBody()->getContents());

        if ($response->getStatusCode() !== 200) {
            $errorMessage = $result['error']['message'] ?? "HTTP 错误: {$response->getStatusCode()}";
            throw new Exception("API 请求失败: {$errorMessage}");
        }

        return $result;
    }

    protected function getDefaultSafetySettings(): array
    {
        return [
            [
                'category' => 'HARM_CATEGORY_HATE_SPEECH',
                'threshold' => 'BLOCK_NONE',
            ],
            [
                'category' => 'HARM_CATEGORY_DANGEROUS_CONTENT',
                'threshold' => 'BLOCK_NONE',
            ],
            [
                'category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                'threshold' => 'BLOCK_NONE',
            ],
            [
                'category' => 'HARM_CATEGORY_HARASSMENT',
                'threshold' => 'BLOCK_NONE',
            ],
        ];
    }
}
