<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Asr\Driver;

use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Asr\Config\ConfigInterface;
use App\Infrastructure\Util\Asr\Config\VolcengineConfig;
use App\Infrastructure\Util\Asr\Util\AudioFileAnalyzer;
use App\Infrastructure\Util\Asr\Util\TextReplacer;
use App\Infrastructure\Util\Asr\ValueObject\AsrResult;
use App\Infrastructure\Util\Asr\ValueObject\AudioContent;
use App\Infrastructure\Util\Asr\ValueObject\AudioProperties;
use App\Infrastructure\Util\Asr\ValueObject\AudioResult;
use App\Infrastructure\Util\Asr\ValueObject\DefaultFormat;
use App\Infrastructure\Util\Asr\ValueObject\Language;
use Exception;
use GuzzleHttp\Psr7\Request;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use JetBrains\PhpStorm\ArrayShape;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Swow\Psr7\Client\Client;
use Swow\Psr7\Message\WebSocketFrameInterface;
use Swow\Psr7\Psr7;

use function Hyperf\Coroutine\defer;

/* *
 *  基于大模型流式语音识别API--流式输入模式 . 参考文档 https://www.volcengine.com/docs/6561/1354869
 *  流式输入模式会在输入音频达到15s或发送最后一包（负包）后返回识别到的结果，准确率更高，但速度稍慢.
 *  注意音频容器格式仅支持 pcm(pcm_s16le) / wav(pcm_s16le) / ogg 参考https://www.volcengine.com/docs/6561/1354869#header-%E6%95%B0%E6%8D%AE%E6%A0%BC%E5%BC%8F
 * */
class Volcengine extends AbstractDriver
{
    public const int FULL_SERVER_RESPONSE = 0b1001;

    public const int SERVER_ERROR_RESPONSE = 0b0001;

    public const int NO_SERIALIZATION = 0b0000;

    /** no compression */
    protected const int NO_COMPRESSION = 0b0001;

    /** 错误消息类型 */
    protected const int ERROR_MESSAGE_TYPE = 0b1111;

    /** 识别结果消息类型  */
    protected const int RECOGNITION_RESULT_MESSAGE_TYPE = 0b1001;

    /** 大模型流式语音识别 并发版 */
    protected const string X_API_RESOURCE_ID_CONCURRENT = 'volc.bigasr.sauc.concurrent';

    protected const string VKE_ASR_URI = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel';

    /** 大模型录音文件识别API */
    protected const string VKE_ASR_FILE_URI = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel';

    /** 音频分片大小，单位为字节 */
    private const int SEGMENT_SIZE = 10000;

    /** 协议版本号 将来可能会决定使用不同的协议版本，因此此字段是为了使客户端和服务器在版本上达成共识  */
    private const int PROTOCOL_VERSION = 0b0001;

    /** 客户端完整请求标志 */
    private const int CLIENT_FULL_REQUEST = 0b0001;

    /** 无序列号标志 */
    private const int NO_SEQUENCE = 0b0000;

    /** JSON序列化方法标志 */
    private const int JSON = 0b0001;

    /** GZIP压缩方法标志 */
    private const int GZIP = 0b0001;

    /** 仅音频数据请求标志 */
    private const int AUDIO_ONLY_CLIENT_REQUEST = 0b0010;

    /** 最后一个音频包标志 */
    private const int LAST_PACKET_FLAG = 0b0010;

    /** 服务器确认消息类型 */
    private const int SERVER_ACK = 0b1011;

    /** 大模型流式语音识别 小时版 */
    private const string X_API_RESOURCE_ID_HOUR = 'volc.bigasr.sauc.duration';

    /** ASR服务WebSocket URI */
    private const string VKE_ASR_URI_NO_STREAM = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream';

    /** ASR服务工作流程 */
    private const string WORKFLOW = 'audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate';

    /** 依赖注入容器 */
    protected ContainerInterface $container;

    /** 日志记录器 */
    protected LoggerInterface $logger;

    /** 音频属性分析工具 */
    protected AudioFileAnalyzer $audioFileAnalyzer;

    /** 本地替换词工具 */
    protected TextReplacer $textReplacer;

    /** 识别语言 */
    protected Language $language;

    /** WebSocket连接URL */
    private string $url;

    /** 当前使用的工作流程 */
    private string $workflow;

    /** 应用ID */
    private string $appid;

    /** 认证令牌 */
    private string $token;

    /** X-Api-Resource-Id , 表示调用服务的资源信息 ID，是固定值  */
    private string $xApiResourceId;

    /** 自学习平台上设置的热词词表名称 */
    private string $boostingTableName;

    /** 自学习平台上设置的替换词词表名称 */
    private string $correctingTableName;

    /** WebSocket客户端 */
    private Client $client;

    /** 当前使用的音频分片大小 */
    private int $segmentSize;

    /** 音频属性 */
    private AudioProperties $audioProperties;

    /**
     * 构造函数，初始化 ASR 客户端.
     * @param VolcengineConfig $config
     */
    public function __construct(ConfigInterface $config)
    {
        parent::__construct($config);

        // 认证信息
        $this->appid = $config->getAppId();
        $this->token = $config->getToken();
        $this->language = $config->getLanguage() ?? Language::ZH_CN;  // 大模型不需要传入语言类型，仅作备用

        $this->boostingTableName = $config->getHotWordsConfig()[0]['NAME'] ?? '';
        $this->correctingTableName = $config->getReplacementWordsConfig()[0]['NAME'] ?? '';

        // 表示调用服务的资源信息 ID，是固定值
        $this->xApiResourceId = self::X_API_RESOURCE_ID_HOUR;

        // 一些基础参数，一般不作改动
        $this->url = self::VKE_ASR_URI_NO_STREAM;
        $this->workflow = self::WORKFLOW;
        $this->segmentSize = self::SEGMENT_SIZE;

        // 初始化Client以及Logger等组件
        $this->client = new Client();
        $this->container = ApplicationContext::getContainer();
        $this->logger = $this->container->get(LoggerFactory::class)->get(static::class);
        $this->audioFileAnalyzer = $this->container->get(AudioFileAnalyzer::class);
        $this->textReplacer = $this->container->get(TextReplacer::class);
    }

    /**
     * 执行语音识别.
     *
     * @param string $audioFilePath 音频文件路径
     * @return array 识别结果
     */
    public function recognize(string $audioFilePath, Language $language = Language::ZH_CN, array $params = []): array
    {
        $finalText = '';
        $fileHandle = null;

        $defaultFormat = new DefaultFormat();
        $defaultFormat->setFormats(['wav']);
        $defaultFormat->setCodecs(['raw']);
        $defaultFormat->setSampleRates([16000]);
        $defaultFormat->setBitRates([16]);
        $defaultFormat->setChannels([1]);
        try {
            $this->checkAndSetAudioParams($audioFilePath, $defaultFormat);

            $reply = $this->connect($params);
            if ($reply === null) {
                ExceptionBuilder::throw(AsrErrorCode::WebSocketConnectionFailed, 'asr.connection_error.websocket_connection_failed');
            }

            $fileHandle = fopen($audioFilePath, 'rb');
            if ($fileHandle === false) {
                ExceptionBuilder::throw(AsrErrorCode::FileOpenFailed, 'asr.file_error.file_open_failed', ['file' => $audioFilePath]);
            }

            $chunkIndex = 0;
            $isLastChunk = false;

            while (true) {
                $chunk = fread($fileHandle, $this->segmentSize);
                if ($chunk === false) {
                    ExceptionBuilder::throw(AsrErrorCode::FileReadFailed, 'asr.file_error.file_read_failed', ['file' => $audioFilePath]);
                }
                if (strlen($chunk) === 0) {
                    break;
                }

                $isLastChunk = feof($fileHandle);
                $this->sendAudio($chunk, $isLastChunk);

                $reply = $this->receiveFrame();
                $response = $this->parseResponse($reply->getPayloadData()->getContents());

                $this->logger->debug('收到分片 ' . ($chunkIndex + 1) . ' 的响应', ['response' => $response]);

                // 只保存最后一个分片的结果
                if ($isLastChunk && isset($response['payload_msg']['result']['text'])) {
                    $finalText = $response['payload_msg']['result']['text'];
                }

                ++$chunkIndex;
            }
        } catch (Exception $e) {
            $this->logger->error('识别过程发生异常 ', [
                'function' => 'recognize',
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            ExceptionBuilder::throw(AsrErrorCode::RecognitionError, 'asr.recognition_error.recognize_error');
        } finally {
            if ($fileHandle && is_resource($fileHandle)) {
                fclose($fileHandle);
            }
            $this->close();
        }

        // 执行本地文本替换
        // $finalText = $this->textReplacer->replaceWordsByFuzz($finalText);

        $this->logger->info('识别完成', ['final_text' => $finalText]);

        $result = new AsrResult($finalText);
        return $result->toArray();
    }

    /**
     * 检查并设置音频参数.
     *
     * @param string $audioFilePath 音频文件路径
     * @return AudioProperties $this->audioProperties
     * @throws Exception 文件不存在或格式不支持时抛出异常
     *                   TODO 火山引擎--大语言模型流式识别目前仅支持以下格式  https://www.volcengine.com/docs/6561/1354869#header-%E6%95%B0%E6%8D%AE%E6%A0%BC%E5%BC%8F
     *                   TODO 目前严格限制音频格式，以保障识别正常，等待修复此问题后放宽限制。
     */
    public function checkAndSetAudioParams(string $audioFilePath, DefaultFormat $defaultFormat): AudioProperties
    {
        if (! file_exists($audioFilePath)) {
            ExceptionBuilder::throw(
                AsrErrorCode::FileNotFound,
                'asr.file_error.file_not_found',
                ['file' => $audioFilePath]
            );
        }

        $this->audioProperties = $this->audioFileAnalyzer->analyzeAudioFile($audioFilePath);

        // 定义支持的音频属性
        //        $supportedFormats = ['wav'];
        //        $supportedCodecs = ['raw'];
        //        $supportedSampleRates = [16000];
        //        $supportedBitsPerSample = [16];
        //        $supportedChannels = [1];
        $supportedFormats = $defaultFormat->getFormats();
        $supportedCodecs = $defaultFormat->getCodecs();
        $supportedSampleRates = $defaultFormat->getSampleRates();
        $supportedBitsPerSample = $defaultFormat->getBitRates();
        $supportedChannels = $defaultFormat->getChannels();

        // 获取音频属性
        $format = $this->audioProperties->getAudioFormat();
        $codec = $this->audioProperties->getAudioCodec();
        $sampleRate = $this->audioProperties->getSampleRate();
        $bitsPerSample = $this->audioProperties->getBitsPerSample();
        $channels = $this->audioProperties->getChannels();

        // 检查音频格式是否支持
        if (! in_array($format, $supportedFormats)
            || ! in_array($codec, $supportedCodecs)
            || ! in_array($sampleRate, $supportedSampleRates)
            || ! in_array($bitsPerSample, $supportedBitsPerSample)
            || ! in_array($channels, $supportedChannels)) {
            // 如果音频格式不符合要求，抛出异常
            ExceptionBuilder::throw(
                AsrErrorCode::InvalidAudioFormat,
                'asr.invalid_audio',
                [
                    'detected_format' => $format,
                    'detected_codec' => $codec,
                    'detected_sample_rate' => $sampleRate,
                    'detected_bits_per_sample' => $bitsPerSample,
                    'detected_channels' => $channels,
                    'supported_formats' => implode(', ', $supportedFormats),
                    'supported_codecs' => implode(', ', $supportedCodecs),
                    'supported_sample_rates' => implode(', ', $supportedSampleRates),
                    'supported_bits_per_sample' => implode(', ', $supportedBitsPerSample),
                    'supported_channels' => implode(', ', $supportedChannels),
                ]
            );
        }

        $this->logger->debug('音频格式检查通过', [
            'file' => $audioFilePath,
            'format' => $format,
            'codec' => $codec,
            'sample_rate' => $sampleRate,
            'bits_per_sample' => $bitsPerSample,
            'channels' => $channels,
        ]);

        return $this->audioProperties;
    }

    /**
     * 建立 WebSocket 连接.
     *
     * @return null|WebSocketFrameInterface 连接成功返回 WebSocket 帧，失败返回 null
     * @throws Exception 连接失败时抛出异常
     */
    public function connect(array $params = []): ?WebSocketFrameInterface
    {
        try {
            $parsedUrl = parse_url($this->url);
            $host = $parsedUrl['host'];
            $path = $parsedUrl['path'];

            $request = Psr7::createRequest(
                'GET',
                $this->url,
                [
                    'X-Api-Resource-Id' => $this->xApiResourceId,
                    'X-Api-Access-Key' => $this->token,
                    'X-Api-App-Key' => $this->appid,
                    'X-Api-Request-Id' => uniqid(),
                    'X-Api-Connect-Id' => uniqid(),
                    'Sec-WebSocket-Protocol' => 'v2.asr.ttsengine.bytedance.com',
                ]
            );
            $request->setRequestTarget($path); /* @phpstan-ignore-line */
            $this->client->connect($host, 443)->enableCrypto()->upgradeToWebSocket($request);
            // $this->client->connect($host, 443)->enableCrypto([STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT])->upgradeToWebSocket($request);
            defer(function () {
                $this->close();
            });
            $req = $this->constructRequest(uniqid(), $params);

            $headers = $this->generateFullDefaultHeader();
            $payloadBytes = json_encode($req);
            $payloadBytes = gzencode($payloadBytes);
            $payloadSize = pack('N', strlen($payloadBytes));
            $fullClientRequest = $headers . $payloadSize . $payloadBytes;

            $this->logger->debug('完整客户端请求已发送', ['request' => $req]);

            $frame = Psr7::createWebSocketBinaryMaskedFrame($fullClientRequest);
            $reply = $this->client->sendWebSocketFrame($frame)->recvWebSocketFrame();

            $this->logger->debug('收到ASR服务的初始响应', ['response' => $this->parseResponse($reply->getPayloadData()->getContents())]);
            $this->logger->debug('WebSocket已连接');

            return $reply;
        } catch (Exception $e) {
            $this->logger->error('WebSocket连接失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            ExceptionBuilder::throw(AsrErrorCode::WebSocketConnectionFailed, 'asr.connection_error.websocket_connection_failed');
        }
    }

    /**
     * 关闭 WebSocket 连接.
     */
    public function close(): void
    {
        $this->client->close();
        $this->logger->debug('WebSocket连接已关闭');
    }

    /**
     * 发送音频数据.
     *
     * @param string $audioData 音频数据
     * @param bool $isLast 是否为最后一个音频分片
     */
    public function sendAudio(string $audioData, bool $isLast = false): void
    {
        $this->logger->debug('发送音频数据', [
            'size' => strlen($audioData),
            'is_last' => $isLast,
        ]);

        $headers = $isLast ? $this->generateLastAudioEndHeader() : $this->generateAudioDefaultHeader();

        $compressedAudioData = gzencode($audioData);
        $payloadSize = pack('N', strlen($compressedAudioData));
        $audioPacket = $headers . $payloadSize . $compressedAudioData;

        $frame = Psr7::createWebSocketBinaryMaskedFrame($audioPacket);
        $this->client->sendWebSocketFrame($frame);
    }

    /**
     * 接收 WebSocket 帧.
     *
     * @return WebSocketFrameInterface 接收到的 WebSocket 帧
     */
    public function receiveFrame(): WebSocketFrameInterface
    {
        $this->logger->debug('等待接收ASR服务的帧');
        $reply = $this->client->recvWebSocketFrame();
        $this->logger->debug('收到帧', [
            'opcode' => $reply->getOpcode(),
            'payload_length' => $reply->getPayloadLength(),
        ]);
        return $reply;
    }

    /**
     * 解析服务器响应。
     *
     * @param string $res 原始响应数据
     * @return array 解析后的响应数据，包含以下键：
     *               - messageType: string 消息类型
     *               - payload_msg: array|null 解码后的消息内容
     *               - payload_size: int payload 的大小
     *               - is_last_package: bool 是否是最后一个包
     *               - payload_sequence: int|null payload 的序列号（如果存在）
     *               - seq: int|null SERVER_ACK 消息类型的序列号
     *               - code: int|null SERVER_ERROR_RESPONSE 消息类型的错误代码
     * @throws Exception 当解析过程中发生错误时抛出异常
     */
    #[ArrayShape([
        'messageType' => 'string',
        'payload_msg' => 'array|null',
        'payload_size' => 'int',
        'is_last_package' => 'bool',
        'payload_sequence' => 'int|null',
        'seq' => 'int|null',
        'code' => 'int|null',
    ])]
    public function parseResponse(string $res): array
    {
        $this->logger->debug('原始响应', [
            'response_hex' => bin2hex(substr($res, 0, 100)),
            'response_length' => strlen($res),
        ]);

        if (empty($res)) {
            $this->logger->debug('收到空响应');
            return [
                'messageType' => null,
                'payload_msg' => null,
                'payload_size' => 0,
                'is_last_package' => false,
            ];
        }

        $protocolVersion = ord($res[0]) >> 4;
        $headerSize = ord($res[0]) & 0x0F;
        $messageType = ord($res[1]) >> 4;
        $messageTypeSpecificFlags = ord($res[1]) & 0x0F;
        $serializationMethod = ord($res[2]) >> 4;
        $messageCompression = ord($res[2]) & 0x0F;
        $reserved = ord($res[3]);
        $headerExtensions = substr($res, 4, $headerSize * 4 - 4);
        $payload = substr($res, $headerSize * 4);

        $result = [
            'messageType' => $this->getMessageTypeString($messageType),
            'payload_msg' => null,
            'payload_size' => 0,
            'is_last_package' => ($messageTypeSpecificFlags & 0x02) !== 0,
        ];

        if ($messageTypeSpecificFlags & 0x01) {
            $seq = unpack('N', substr($payload, 0, 4))[1];
            if ($seq & 0x80000000) {
                $seq = -(($seq ^ 0xFFFFFFFF) + 1);
            }
            $result['payload_sequence'] = $seq;
            $payload = substr($payload, 4);
        }

        if ($messageType == self::FULL_SERVER_RESPONSE) {
            $payloadSize = unpack('N', substr($payload, 0, 4))[1];
            $payloadMsg = substr($payload, 4);
        } elseif ($messageType == self::SERVER_ACK) {
            $seq = unpack('N', substr($payload, 0, 4))[1];
            $result['seq'] = $seq;
            if (strlen($payload) >= 8) {
                $payloadSize = unpack('N', substr($payload, 4, 4))[1];
                $payloadMsg = substr($payload, 8);
            }
        } elseif ($messageType == self::SERVER_ERROR_RESPONSE) {
            $code = unpack('N', substr($payload, 0, 4))[1];
            $result['code'] = $code;
            $payloadSize = unpack('N', substr($payload, 4, 4))[1];
            $payloadMsg = substr($payload, 8);
        }

        if (isset($payloadMsg)) {
            if ($messageCompression == self::GZIP) {
                $payloadMsg = @gzdecode($payloadMsg);
                if ($payloadMsg === false) {
                    $this->logger->error('Payload解压失败', [
                        'compression_type' => 'GZIP',
                    ]);
                    $result['payload_msg'] = ['error' => '解压失败'];
                    $result['payload_size'] = $payloadSize ?? 0;
                    return $result;
                }
            }

            if ($serializationMethod == self::JSON) {
                $decodedPayloadMsg = json_decode($payloadMsg, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $this->logger->error('JSON解码错误', [
                        'error_message' => json_last_error_msg(),
                        'raw_payload' => $this->encodeControlChars($payloadMsg),
                        'raw_payload_length' => strlen($payloadMsg),
                    ]);
                    $result['payload_msg'] = ['error' => 'JSON解码失败'];
                    $result['payload_size'] = $payloadSize ?? 0;
                    return $result;
                }
                $payloadMsg = $decodedPayloadMsg;
            }

            $result['payload_msg'] = $payloadMsg;
            $result['payload_size'] = $payloadSize ?? 0;
        }

        $this->logger->debug('解析后的响应', [
            'messageType' => $result['messageType'],
            'payload_size' => $result['payload_size'],
            'is_last_package' => $result['is_last_package'],
        ]);

        return $result;
    }

    public function recognizeVoice(string $audioFileUrl): array
    {
        // 提交音频
        $this->logger->info('开始提交音频', ['file' => $audioFileUrl]);
        $requestId = $this->submitAudio($audioFileUrl);
        if (! $requestId) {
            // todo
            ExceptionBuilder::throw(AsrErrorCode::Error, 'asr.recognize_audio.request_failed');
        }

        // 根据请求id查询结果
        $this->logger->info('开始查询结果', ['request_id' => $requestId]);
        $audioResult = $this->queryAudioResult($requestId);
        $audioResult = $audioResult['result'] ?? [];
        $this->logger->info('查询结果', ['result' => $audioResult]);

        // 整理结果
        $result = new AudioResult();
        $content = [];
        foreach ($audioResult['utterances'] ?? [] as $item) {
            $end = $item['end_time'] ?? 0;
            $start = $item['start_time'] ?? 0;
            // end向上取整
            $duration = (int) ceil($end / 1000);
            $durationTime = gmdate('H:i:s', $duration);
            $audioContent = new AudioContent();
            $audioContent->setDuration($durationTime);
            $audioContent->setText($item['text'] ?? '');
            $audioContent->setSpeaker($item['additions']['speaker'] ?? '');
            $audioContent->setStartTime((string) $start);
            $audioContent->setEndTime((string) $end);
            $content[] = $audioContent;
        }
        $result->setContent($content);
        $duration = $audioResult['additions']['duration'] ?? 0;
        $duration = (int) ceil($duration / 1000);
        $durationTime = gmdate('H:i:s', $duration);
        $result->setDuration($durationTime);
        return $result->toArray();
    }

    public function queryAudioResult(string $requestId): array
    {
        // todo 放到消息队列中处理，避免容器故障时无法处理
        $body = [
            'X-Api-Resource-Id' => 'volc.bigasr.auc',
        ];
        $body = json_encode($body, JSON_UNESCAPED_UNICODE);
        $client = new \GuzzleHttp\Client();
        $request = new Request('POST', 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query', [
            'Content-Type' => 'application/json',
            'language' => 'zh-CN',
            'X-Api-App-Key' => $this->appid,
            'X-Api-Access-Key' => $this->token,
            'X-Api-Resource-Id' => 'volc.bigasr.auc',
            'X-Api-Request-Id' => $requestId,
        ], $body);

        $startTime = time();
        while (true) {
            $this->logger->info(sprintf('queryAudioResult 开始查询结果，请求ID：%s', $requestId));
            $response = $client->sendAsync($request)->wait();
            $responseBody = $response->getBody()->getContents();
            $responseHeader = $response->getHeaders();
            $code = $responseHeader['X-Api-Status-Code'][0] ?? 0;
            $response = json_decode($responseBody, true);
            if ($code) {
                $code = (int) $code;
                if ($code === 20000000) {
                    $this->logger->info('queryAudioResult 请求成功', ['response' => $response]);
                    return $response;
                }
                if ($code > 45000000) {
                    $this->logger->error('请求失败', ['response' => $response]);
                    ExceptionBuilder::throw(AsrErrorCode::Error, 'asr.recognize_audio.request_failed');
                }
                $currentTime = time();
                if ($currentTime - $startTime > 180) {
                    ExceptionBuilder::throw(AsrErrorCode::RequestTimeout, 'asr.recognize_audio.request_timeout');
                }
                sleep(1);
            } else {
                ExceptionBuilder::throw(AsrErrorCode::Error, 'asr.recognize_audio.request_failed');
            }
        }
    }

    public function submitAudio(string $fileUrl): string
    {
        $requestId = uniqid();
        $body = [
            'user' => [
                'uid' => uniqid(),
            ],
            'audio' => [
                'format' => 'wav', // todo 暂时写死
                'url' => $fileUrl,
            ],
            'request' => [
                'enable_speaker_info' => true, // 启用说话人聚类分离
                'model_name' => 'bigmodel',
                'enable_itn' => true, // 文本规范化
                'show_utterances' => true, // 输出语音停顿、分句、分词信息
            ],
        ];
        $body = json_encode($body, JSON_UNESCAPED_UNICODE);
        $client = new \GuzzleHttp\Client();
        $request = new Request('POST', 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit', [
            'Content-Type' => 'application/json',
            'language' => 'zh-CN',
            'X-Api-App-Key' => $this->appid,
            'X-Api-Access-Key' => $this->token,
            'X-Api-Resource-Id' => 'volc.bigasr.auc',
            'X-Api-Request-Id' => $requestId,
            'X-Api-Sequence' => '-1',
        ], $body);
        $response = $client->sendAsync($request)->wait();
        $responseHeader = $response->getHeaders();
        $statusCode = $responseHeader['X-Api-Status-Code'][0] ?? 0;
        if ((int) $statusCode !== 20000000) {
            $this->logger->error('录音文件识别请求失败', ['headers' => $responseHeader]);
            ExceptionBuilder::throw(AsrErrorCode::Error, 'asr.recognize_audio.request_failed');
        }

        return $requestId;
    }

    /* *
     * 使得日志可以打印出raw
     * */
    private function encodeControlChars(string $input): string
    {
        return preg_replace_callback('/[\x00-\x1F\x7F]/', function ($matches) {
            return '\u' . str_pad(dechex(ord($matches[0])), 4, '0', STR_PAD_LEFT);
        }, $input);
    }

    /**
     * 消息类型转换为对应的含义和二进制表示.
     */
    private function getMessageTypeString(int $messageType): string
    {
        return match ($messageType) {
            0b0001 => '完整客户端请求 (0b0001)',
            0b0010 => '仅音频数据请求 (0b0010)',
            0b1001 => '完整服务器响应 (0b1001)',
            0b1011 => '服务器确认 (0b1011)',
            0b1111 => '服务器错误响应 (0b1111)',
            default => '未知消息类型 (0b' . dechex($messageType) . ')',
        };
    }

    /**
     * 构造请求数据.
     *
     * @param string $reqid 请求 ID
     * @return array 构造的请求数据
     */
    private function constructRequest(string $reqid, array $params = []): array
    {
        $res = [
            'app' => [
                'appid' => $this->appid,
                //                'cluster' => $this->cluster,
                'token' => $this->token,
            ],
            'user' => [
                'uid' => uniqid(),
            ],
            'request' => [
                'reqid' => $reqid,
                'model_name' => 'bigmodel',
                'enable_punc' => true,
                'enable_ddc' => true,
                'nbest' => 1,
                'workflow' => $this->workflow,
                'show_language' => false,
                'show_utterances' => true, // 输出语音停顿、分句、分词信息
                'result_type' => 'full',
                'sequence' => 1,
                'boosting_table_name' => $this->boostingTableName,
                'correct_table_name' => $this->correctingTableName,
            ],
            'audio' => [
                'format' => $this->audioProperties->getAudioFormat(),
                'rate' => $this->audioProperties->getSampleRate(),
                'bits' => $this->audioProperties->getBitsPerSample(),
                'channel' => $this->audioProperties->getChannels(),
                'codec' => $this->audioProperties->getAudioCodec(),
            ],
        ];
        if (! empty($params['context'])) {
            $res['request']['context'] = $params['context'];
        }
        return $res;
    }

    /**
     * 生成协议头部.
     *
     * @param int $version 协议版本
     * @param int $messageType 消息类型
     * @param int $messageTypeSpecificFlags 消息类型特定标志
     * @param int $serialMethod 序列化方法
     * @param int $compressionType 压缩类型
     * @param int $reservedData 保留数据
     * @param string $extensionHeader 扩展头部
     * @return string 生成的头部字符串
     */
    private function generateHeader(
        int $version = self::PROTOCOL_VERSION,
        int $messageType = self::CLIENT_FULL_REQUEST,
        int $messageTypeSpecificFlags = self::NO_SEQUENCE,
        int $serialMethod = self::JSON,
        int $compressionType = self::GZIP,
        int $reservedData = 0x00,
        string $extensionHeader = '',
    ): string {
        $header = '';
        $headerSize = intdiv(strlen($extensionHeader), 4) + 1;
        $header .= chr(($version << 4) | $headerSize);
        $header .= chr(($messageType << 4) | $messageTypeSpecificFlags);
        $header .= chr(($serialMethod << 4) | $compressionType);
        $header .= chr($reservedData);
        $header .= $extensionHeader;
        return $header;
    }

    private function generateFullDefaultHeader()
    {
        return $this->generateHeader();
    }

    private function generateAudioDefaultHeader()
    {
        return $this->generateHeader(
            messageType: self::AUDIO_ONLY_CLIENT_REQUEST,
        );
    }

    private function generateLastAudioEndHeader()
    {
        return $this->generateHeader(
            messageType: self::AUDIO_ONLY_CLIENT_REQUEST,
            messageTypeSpecificFlags: self::LAST_PACKET_FLAG,
        );
    }
}
