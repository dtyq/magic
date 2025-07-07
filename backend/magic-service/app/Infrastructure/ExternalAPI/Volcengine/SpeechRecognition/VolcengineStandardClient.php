<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\SpeechRecognition;

use App\Domain\Speech\Entity\Dto\FlashSpeechResponse;
use App\Domain\Speech\Entity\Dto\FlashSpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\LargeModelSpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\SpeechQueryDTO;
use App\Domain\Speech\Entity\Dto\SpeechSubmitDTO;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class VolcengineStandardClient
{
    private const string SUBMIT_URL = 'https://openspeech.bytedance.com/api/v1/auc/submit';

    private const string QUERY_URL = 'https://openspeech.bytedance.com/api/v1/auc/query';

    private const string BIGMODEL_SUBMIT_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit';

    private const string BIGMODEL_QUERY_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query';

    private const string FLASH_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash';

    protected LoggerInterface $logger;

    protected Client $httpClient;

    protected array $config;

    public function __construct()
    {
        $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get(self::class);
        $this->httpClient = new Client([
            'timeout' => 30,
            'connect_timeout' => 10,
        ]);
        $this->config = $this->getVolcengineConfig();
    }

    public function submitTask(SpeechSubmitDTO $submitDTO): array
    {
        $requestData = $this->buildSubmitRequest($submitDTO);

        return $this->executeStandardRequest(
            self::SUBMIT_URL,
            $requestData,
            'speech.volcengine.submit_exception',
            'Volcengine speech recognition task submitted successfully'
        );
    }

    public function queryResult(SpeechQueryDTO $queryDTO): array
    {
        $requestData = $this->buildQueryRequest($queryDTO);

        return $this->executeStandardRequest(
            self::QUERY_URL,
            $requestData,
            'speech.volcengine.query_exception',
            'Volcengine speech recognition query completed successfully',
            ['task_id' => $queryDTO->getTaskId()]
        );
    }

    /**
     * Submit BigModel ASR task.
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
            $result = Json::decode($responseBody);

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
            $result = Json::decode($responseBody);

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

    public function submitFlashTask(FlashSpeechSubmitDTO $submitDTO): FlashSpeechResponse
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
            $result = Json::decode($responseBody);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse Volcengine Flash response JSON', [
                    'response_body' => $responseBody,
                    'json_error' => json_last_error_msg(),
                    'request_id' => $requestId,
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.flash.invalid_response_format');
            }
            // Add additional information to response data
            $result['request_id'] = $requestId;
            $responseHeaders = $this->extractResponseHeaders($response);
            $finalResult = array_merge($result, $responseHeaders);

            // Create FlashSpeechResponse object (will automatically remove utterances to save memory)
            $flashResponse = new FlashSpeechResponse($finalResult);
            $textContent = $flashResponse->extractTextContent();

            $this->logger->info('Volcengine Flash speech recognition text content retrieved successfully', [
                'request_id' => $requestId,
                'text_length' => strlen($textContent),
                'response_code' => $result['code'] ?? null,
            ]);

            return $flashResponse;
        } catch (GuzzleException $e) {
            $this->logger->error('Failed to get Flash audio text from Volcengine', [
                'error' => $e->getMessage(),
                'request_data' => $requestData,
                'request_id' => $requestId,
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('Exception occurred while getting Flash audio text from Volcengine', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => $requestId,
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.flash.get_text_exception', [
                'original_error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Execute standard ASR request (non-BigModel).
     */
    private function executeStandardRequest(
        string $url,
        array $requestData,
        string $exceptionMessage,
        string $successMessage,
        array $contextData = []
    ): array {
        try {
            $response = $this->httpClient->post($url, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer; ' . $this->config['token'],
                ],
                'json' => $requestData,
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = Json::decode($responseBody);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse Volcengine response JSON', array_merge([
                    'response_body' => $responseBody,
                    'json_error' => json_last_error_msg(),
                ], $contextData));
                ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.invalid_response_format');
            }

            $this->logger->info($successMessage, array_merge([
                'response' => $result,
            ], $contextData));

            $responseHeaders = $this->extractResponseHeaders($response);
            return array_merge($result, $responseHeaders);
        } catch (GuzzleException $e) {
            $this->logger->error('Failed to execute Volcengine request', array_merge([
                'error' => $e->getMessage(),
                'request_data' => $requestData,
                'url' => $url,
            ], $contextData));

            ExceptionBuilder::throw(AsrErrorCode::Error, $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('Exception occurred while executing Volcengine request', array_merge([
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'url' => $url,
            ], $contextData));

            ExceptionBuilder::throw(AsrErrorCode::Error, $exceptionMessage, [
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
