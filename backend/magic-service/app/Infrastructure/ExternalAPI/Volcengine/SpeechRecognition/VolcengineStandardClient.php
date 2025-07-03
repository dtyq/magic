<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\SpeechRecognition;

use App\Domain\Speech\Entity\Dto\LargeModelSpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\FlashSpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\SpeechQueryDTO;
use App\Domain\Speech\Entity\Dto\SpeechSubmitDTO;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class VolcengineStandardClient
{
    private const SUBMIT_URL = 'https://openspeech.bytedance.com/api/v1/auc/submit';

    private const QUERY_URL = 'https://openspeech.bytedance.com/api/v1/auc/query';

    private const BIGMODEL_SUBMIT_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit';

    private const BIGMODEL_QUERY_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query';

    private const FLASH_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash';

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

            $responseHeaders = $this->extractResponseHeaders($response);
            return array_merge($result, $responseHeaders);
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

            $responseHeaders = $this->extractResponseHeaders($response);
            return array_merge($result, $responseHeaders);
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
    public function submitBigModelTask(LargeModelSpeechSubmitDTO $submitDTO): array
    {
        $requestData = $this->buildBigModelSubmitRequest($submitDTO);
        $requestId = $requestData['req_id'];

        try {
            $response = $this->httpClient->post(self::BIGMODEL_SUBMIT_URL, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-Api-App-Key' => $this->config['app_id'],
                    'X-Api-Access-Key' => $this->config['token'],
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

            $result['request_id'] = $requestId;
            $responseHeaders = $this->extractResponseHeaders($response);
            return array_merge($result, $responseHeaders);
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

    public function queryBigModelResult(string $requestId): array
    {
        $queryData = [
            'appkey' => $this->config['app_id'],
            'token' => $this->config['token'],
            'resource_id' => 'volc.bigasr.auc',
            'req_id' => $requestId,
        ];

        try {
            $response = $this->httpClient->post(self::BIGMODEL_QUERY_URL, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-Api-App-Key' => $this->config['app_id'],
                    'X-Api-Access-Key' => $this->config['token'],
                    'X-Api-Resource-Id' => 'volc.bigasr.auc',
                    'X-Api-Request-Id' => $requestId,
                ],
                'json' => $queryData,
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

            $responseHeaders = $this->extractResponseHeaders($response);
            return array_merge($result, $responseHeaders);
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

    public function submitFlashTask(FlashSpeechSubmitDTO $submitDTO): array
    {
        $requestData = $this->buildFlashSubmitRequest($submitDTO);
        $requestId = $requestData['req_id'];

        try {
            $response = $this->httpClient->post(self::FLASH_URL, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-Api-App-Key' => $this->config['app_id'],
                    'X-Api-Access-Key' => $this->config['token'],
                    'X-Api-Resource-Id' => 'volc.bigasr.auc_turbo',
                    'X-Api-Request-Id' => $requestId,
                    'X-Api-Sequence' => '-1',
                ],
                'json' => $requestData,
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = json_decode($responseBody, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse Volcengine Flash response JSON', [
                    'response_body' => $responseBody,
                    'json_error' => json_last_error_msg(),
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.flash.invalid_response_format');
            }

            $this->logger->info('Volcengine Flash speech recognition task submitted successfully', [
                'request_id' => $requestId,
                'response' => $result,
            ]);

            $result['request_id'] = $requestId;
            $responseHeaders = $this->extractResponseHeaders($response);
            return array_merge($result, $responseHeaders);
        } catch (GuzzleException $e) {
            $this->logger->error('Failed to submit Flash task to Volcengine', [
                'error' => $e->getMessage(),
                'request_data' => $requestData,
                'request_id' => $requestId,
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('Exception occurred while submitting Flash task to Volcengine', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => $requestId,
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.flash.submit_exception', [
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

    private function buildBigModelSubmitRequest(LargeModelSpeechSubmitDTO $submitDTO): array
    {
        $userRequestData = $submitDTO->toVolcenArray();

        $requestData = [
            'appkey' => $this->config['app_id'],
            'token' => $this->config['token'],
            'resource_id' => 'volc.bigasr.auc',
            'req_id' => IdGenerator::getSnowId(),
            'sequence' => -1,
        ];

        return array_merge($requestData, $userRequestData);
    }

    private function buildFlashSubmitRequest(FlashSpeechSubmitDTO $submitDTO): array
    {
        $userRequestData = $submitDTO->toVolcenArray();

        $requestData = [
            'appkey' => $this->config['app_id'],
            'token' => $this->config['token'],
            'resource_id' => 'volc.bigasr.auc_turbo',
            'req_id' => IdGenerator::getSnowId(),
            'sequence' => -1,
        ];

        return array_merge($requestData, $userRequestData);
    }

    private function extractResponseHeaders($response): array
    {
        $headers = $response->getHeaders();
        $result = [];

        if (isset($headers['X-Tt-Logid'][0]) && $headers['X-Tt-Logid'][0]) {
            $result['volcengine_log_id'] = $headers['X-Tt-Logid'][0];
        }

        if (isset($headers['X-Api-Status-Code'][0]) && $headers['X-Api-Status-Code'][0]) {
            $result['volcengine_status_code'] = $headers['X-Api-Status-Code'][0];
        }

        if (isset($headers['X-Api-Message'][0]) && $headers['X-Api-Message'][0]) {
            $result['volcengine_message'] = $headers['X-Api-Message'][0];
        }

        return $result;
    }
}
