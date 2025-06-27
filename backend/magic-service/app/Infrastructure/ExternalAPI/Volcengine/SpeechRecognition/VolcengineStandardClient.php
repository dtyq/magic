<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\SpeechRecognition;

use App\Domain\Speech\Entity\Dto\SpeechQueryDTO;
use App\Domain\Speech\Entity\Dto\SpeechSubmitDTO;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class VolcengineStandardClient
{
    // 传统ASR接口
    private const SUBMIT_URL = 'https://openspeech.bytedance.com/api/v1/auc/submit';
    private const QUERY_URL = 'https://openspeech.bytedance.com/api/v1/auc/query';
    
    // 大模型ASR接口
    private const BIGMODEL_SUBMIT_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit';
    private const BIGMODEL_QUERY_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query';

    protected LoggerInterface $logger;

    protected Client $httpClient;

    protected array $config;

    public function __construct()
    {
        $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(self::class);
        $this->httpClient = new Client([
            'timeout' => 30,
            'connect_timeout' => 10,
        ]);
        $this->config = $this->getVolcengineConfig();
    }

    public function submitTask(SpeechSubmitDTO $submitDTO): array
    {
        $requestData = $this->buildSubmitRequest($submitDTO);

        try {
            $response = $this->httpClient->post(self::SUBMIT_URL, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer; ' . $this->config['token'],
                ],
                'json' => $requestData,
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = json_decode($responseBody, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse Volcengine response JSON', [
                    'response_body' => $responseBody,
                    'json_error' => json_last_error_msg(),
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.invalid_response_format');
            }

            $this->logger->info('Volcengine speech recognition task submitted successfully', [
                'response' => $result,
            ]);

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('Failed to submit task to Volcengine', [
                'error' => $e->getMessage(),
                'request_data' => $requestData,
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('Exception occurred while submitting task to Volcengine', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.submit_exception', [
                'original_error' => $e->getMessage(),
            ]);
        }
    }

    public function queryResult(SpeechQueryDTO $queryDTO): array
    {
        $requestData = $this->buildQueryRequest($queryDTO);

        try {
            $response = $this->httpClient->post(self::QUERY_URL, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer; ' . $this->config['token'],
                ],
                'json' => $requestData,
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = json_decode($responseBody, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse Volcengine response JSON', [
                    'response_body' => $responseBody,
                    'json_error' => json_last_error_msg(),
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.invalid_response_format');
            }

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('Failed to query result from Volcengine', [
                'task_id' => $queryDTO->getTaskId(),
                'error' => $e->getMessage(),
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('Exception occurred while querying result from Volcengine', [
                'task_id' => $queryDTO->getTaskId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.query_exception', [
                'original_error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 提交大模型ASR任务
     */
    public function submitBigModelTask(SpeechSubmitDTO $submitDTO): array
    {
        $requestData = $this->buildBigModelSubmitRequest($submitDTO);
        $requestId = $this->generateRequestId();

        try {
            $response = $this->httpClient->post(self::BIGMODEL_SUBMIT_URL, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-Api-App-Key' => $this->config['app_id'],
                    'X-Api-Access-Key' => $this->config['access_key'],
                    'X-Api-Resource-Id' => 'volc.bigasr.auc',
                    'X-Api-Request-Id' => $requestId,
                    'X-Api-Sequence' => '-1',
                ],
                'json' => $requestData,
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = json_decode($responseBody, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse Volcengine BigModel response JSON', [
                    'response_body' => $responseBody,
                    'json_error' => json_last_error_msg(),
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.bigmodel.invalid_response_format');
            }

            $this->logger->info('Volcengine BigModel speech recognition task submitted successfully', [
                'request_id' => $requestId,
                'response' => $result,
            ]);

            // 返回结果中包含request_id，用于后续查询
            $result['request_id'] = $requestId;
            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('Failed to submit BigModel task to Volcengine', [
                'error' => $e->getMessage(),
                'request_data' => $requestData,
                'request_id' => $requestId,
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('Exception occurred while submitting BigModel task to Volcengine', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => $requestId,
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.bigmodel.submit_exception', [
                'original_error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 查询大模型ASR结果
     */
    public function queryBigModelResult(string $requestId): array
    {
        try {
            $response = $this->httpClient->post(self::BIGMODEL_QUERY_URL, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-Api-App-Key' => $this->config['app_id'],
                    'X-Api-Access-Key' => $this->config['access_key'],
                    'X-Api-Resource-Id' => 'volc.bigasr.auc',
                    'X-Api-Request-Id' => $requestId,
                ],
                'json' => [],
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = json_decode($responseBody, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse Volcengine BigModel query response JSON', [
                    'response_body' => $responseBody,
                    'json_error' => json_last_error_msg(),
                    'request_id' => $requestId,
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.bigmodel.invalid_response_format');
            }

            $this->logger->info('Volcengine BigModel query result retrieved successfully', [
                'request_id' => $requestId,
                'result' => $result,
            ]);

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('Failed to query BigModel result from Volcengine', [
                'request_id' => $requestId,
                'error' => $e->getMessage(),
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('Exception occurred while querying BigModel result from Volcengine', [
                'request_id' => $requestId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.bigmodel.query_exception', [
                'original_error' => $e->getMessage(),
            ]);
        }
    }

    private function getVolcengineConfig(): array
    {
        $config = config('asr.volcengine', []);

        if (empty($config['app_id']) || empty($config['token']) || empty($config['cluster'])) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidConfig, 'speech.volcengine.config_incomplete');
        }

        // 大模型ASR需要access_key
        if (empty($config['access_key'])) {
            $this->logger->warning('BigModel ASR requires access_key in config');
        }

        return $config;
    }

    private function buildSubmitRequest(SpeechSubmitDTO $submitDTO): array
    {
        $userRequestData = $submitDTO->toVolcengineRequestData();

        $requestData = [
            'app' => [
                'appid' => $this->config['app_id'],
                'token' => $this->config['token'],
                'cluster' => $this->config['cluster'],
            ],
        ];

        return array_merge($requestData, $userRequestData);
    }

    private function buildQueryRequest(SpeechQueryDTO $queryDTO): array
    {
        return [
            'appid' => $this->config['app_id'],
            'token' => $this->config['token'],
            'cluster' => $this->config['cluster'],
            'id' => $queryDTO->getTaskId(),
        ];
    }

    /**
     * 构建大模型ASR提交请求
     */
    private function buildBigModelSubmitRequest(SpeechSubmitDTO $submitDTO): array
    {
        $userRequestData = $submitDTO->toVolcengineRequestData();
        
        // 根据官方文档，大模型ASR的请求格式
        $requestData = [
            'user' => [
                'uid' => $userRequestData['user']['uid'] ?? 'default_uid',
            ],
            'audio' => [
                'url' => $userRequestData['audio']['url'],
                'format' => $userRequestData['audio']['format'] ?? 'wav',
                'language' => $userRequestData['audio']['language'] ?? 'zh-CN',
                'use_itn' => $userRequestData['audio']['use_itn'] ?? true,
                'use_capitalize' => $userRequestData['audio']['use_capitalize'] ?? false,
                'max_lines' => $userRequestData['audio']['max_lines'] ?? 1,
                'words_per_line' => $userRequestData['audio']['words_per_line'] ?? 20,
                'speaker_number' => $userRequestData['audio']['speaker_number'] ?? 0,
                'show_utterances' => $userRequestData['audio']['show_utterances'] ?? true,
                'emotion_recognition' => $userRequestData['audio']['emotion_recognition'] ?? false,
            ],
        ];

        // 如果有热词配置
        if (!empty($userRequestData['audio']['words'])) {
            $requestData['audio']['words'] = $userRequestData['audio']['words'];
        }

        return $requestData;
    }

    /**
     * 生成请求ID
     */
    private function generateRequestId(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
    }
}
