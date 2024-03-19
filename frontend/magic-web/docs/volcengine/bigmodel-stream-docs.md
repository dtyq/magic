<span id="1d388eb1"></span>

# 简介

本文档介绍如何通过WebSocket协议实时访问大模型流式语音识别服务 (ASR)，主要包含鉴权相关、协议详情、常见问题和使用Demo四部分。
双向流式模式使用的接口地址是 wss://[openspeech.bytedance.com/api/v3/sauc/bigmodel](http://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream)
流式输入模式使用的接口地址是 wss://[openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream](http://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream)

1. 两者都是每输入一个包返回一个包，双向流式模式会尽快返回识别到的字符，速度较快。
2. 流式输入模式会在输入音频大于15s或发送最后一包（负包）后返回识别到的结果，准确率更高。
3. 无论是哪种模式，单包音频大小建议在100~200ms左右，发包间隔建议100～200ms，不能过大或者过小，否则均会影响性能。（注：针对双向流式模式，单包为200ms大小时性能最优，建议双向流式模式选取200ms大小的分包）
4. 流式输入模式在平均音频时长5s时，可以做到300~400ms以内返回。

---

双向流式模式（优化版本）接口地址：wss://[openspeech.bytedance.com/api/v3/sauc/bigmodel_async](http://openspeech.bytedance.com/api/v3/sauc/bigmodel_async)

1. 该模式下，不再是每一包输入对应一包返回，只有当结果有变化时才会返回新的数据包（性能优化 rtf 和首字、尾字时延均有一定程度提升）
2. 双向流式版本，更推荐使用双向流式模式（优化版本），性能相对更优。

<span id="25d1d6d6"></span>

# 鉴权

在 websocket 建连的 HTTP 请求头（Header 中）添加以下信息

| | | | \
|Key |说明 |Value 示例 |
|---|---|---|
| | | | \
| | | |
| | | | \
|X-Api-App-Key |使用火山引擎控制台获取的APP ID，可参考 [控制台使用FAQ-Q1](/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F) |123456789 |
| | | | \
|X-Api-Access-Key |使用火山引擎控制台获取的Access Token，可参考 [控制台使用FAQ-Q1](/docs/6561/196768#q1%EF%BC%9A%E5%93%AA%E9%87%8C%E5%8F%AF%E4%BB%A5%E8%8E%B7%E5%8F%96%E5%88%B0%E4%BB%A5%E4%B8%8B%E5%8F%82%E6%95%B0appid%EF%BC%8Ccluster%EF%BC%8Ctoken%EF%BC%8Cauthorization-type%EF%BC%8Csecret-key-%EF%BC%9F) |your-access-key |
| | | | \
|X-Api-Resource-Id |表示调用服务的资源信息 ID |豆包流式语音识别模型1.0 |\
| | | |\
| | |_ 小时版：volc.bigasr.sauc.duration |\
| | |_ 并发版：volc.bigasr.sauc.concurrent |\
| | | |\
| | |豆包流式语音识别模型2.0 |\
| | | |\
| | |_ 小时版：volc.seedasr.sauc.duration |\
| | |_ 并发版：volc.seedasr.sauc.concurrent |
|^^|^^|^^| \
| | | |
|^^|^^|^^| \
| | | |
| | | | \
|X-Api-Connect-Id |用于追踪当前连接的标志 ID，推荐设置UUID等 |67ee89ba-7050-4c04-a3d7-ac61a63499b3 |

websocket 握手成功后，会返回这些 Response header。强烈建议记录X-Tt-Logid（logid）作为排错线索。

| | | | \
|Key |说明 |Value 示例 |
|---|---|---|
| | | | \
|X-Api-Connect-Id |用于追踪当前调用信息的标志 ID，推荐用UUID等 |67ee89ba-7050-4c04-a3d7-ac61a63499b3 |
| | | | \
|X-Tt-Logid |服务端返回的 logid，建议用户获取和打印方便定位问题 |202407261553070FACFE6D19421815D605 |

```HTTP
// 建连 HTTP 请求头示例
GET /api/v3/sauc/bigmodel
Host: openspeech.bytedance.com
X-Api-App-Key: 123456789
X-Api-Access-Key: your-access-key
X-Api-Resource-Id: volc.bigasr.sauc.duration
X-Api-Connect-Id: 随机生成的UUID

## 返回 Header
X-Tt-Logid: 202407261553070FACFE6D19421815D605
```

<span id="ca5745cc"></span>

# 协议详情

<span id="3672cb1f"></span>

## 交互流程

![Image](https://p9-arcosite.byteimg.com/tos-cn-i-goo7wpa0wc/6d72ca511e454d418f01c735c233bd5d~tplv-goo7wpa0wc-image.image =757x)
<span id="db13e485"></span>

## WebSocket 二进制协议

WebSocket 使用二进制协议传输数据。协议的组成由至少 4 个字节的可变 header、payload size 和 payload 三部分组成，其中 header 描述消息类型、序列化方式以及压缩格式等信息，payload size 是 payload 的长度，payload 是具体负载内容，依据消息类型不同 payload 内容不同。
需注意：协议中整数类型的字段都使用**大端**表示。
<span id="df933e14"></span>

### header 数据格式

| | | | | | | | | | \
|**Byte \ Bit** |**7** |**6** |**5** |**4** |**3** |**2** |**1** |**0** |
|---|---|---|---|---|---|---|---|---|
| | |||| |||| \
|**0** |Protocol version | | | |Header size | | | |
| | |||| |||| \
|**1** |Message type | | | |Message type specific flags | | | |
| | |||| |||| \
|**2** |Message serialization method | | | |Message compression | | | |
| | |||||||| \
|**3** |Reserved | | | | | | | |
| | |||||||| \
|**4** |[Optional header extensions] | | | | | | | |
| | |||||||| \
|**5** |[Payload, depending on the Message Type] | | | | | | | |
| | |||||||| \
|**6** |... | | | | | | | |

<span id="996c63e9"></span>

### header 字段描述

| | | | \
|字段 (size in bits) |说明 |值 |
|---|---|---|
| | | | \
|Protocol version (4) |将来可能会决定使用不同的协议版本，因此此字段是为了使客户端和服务器在版本上达成共识。 |0b0001 - version 1 (目前只有该版本) |
| | | | \
|Header (4) |Header 大小。实际 header 大小（以字节为单位）是 header size value x 4 。 |0b0001 - header size = 4 (1 x 4) |
| | | | \
|Message type (4) |消息类型。 |0b0001 - 端上发送包含请求参数的 full client request |\
| | |0b0010 - 端上发送包含音频数据的 audio only request |\
| | |0b1001 - 服务端下发包含识别结果的 full server response |\
| | |0b1111 - 服务端处理错误时下发的消息类型（如无效的消息格式，不支持的序列化方法等） |
| | | | \
|Message type specific flags (4) |Message type 的补充信息。 |0b0000 - header后4个字节不为sequence number |\
| | |0b0001 - header后4个字节为sequence number且为正 |\
| | |0b0010 - header后4个字节不为sequence number，仅指示此为最后一包（负包） |\
| | |0b0011 - header后4个字节为sequence number且需要为负数（最后一包/负包） |
| | | | \
|Message serialization method (4) |full client request 的 payload 序列化方法； |\
| |服务器将使用与客户端相同的序列化方法。 |0b0000 - 无序列化 |\
| | |0b0001 - JSON 格式 |
| | | | \
|Message Compression (4) |定义 payload 的压缩方法； |\
| |服务端将使用客户端的压缩方法。 | 0b0000 - no compression |\
| | | 0b0001 - Gzip 压缩 |
| | | | \
|Reserved (8) |保留以供将来使用，还用作填充（使整个标头总计4个字节）。 | |

<span id="231d2daf"></span>

## 请求流程

<span id="921764de"></span>

### 建立连接

根据 WebSocket 协议本身的机制，client 会发送 HTTP GET 请求和 server 建立连接做协议升级。
需要在其中根据身份认证协议加入鉴权签名头。设置方法请参考鉴权。
<span id="f8167db8"></span>

### 发送 full client request

WebSocket 建立连接后，发送的第一个请求是 full client request。格式是：

| | | | | \
|**31 ... 24** |**23 ... 16** |**15 ... 8** |**7 ... 0** |
|---|---|---|---|
| |||| \
|Header | | | |
| |||| \
|Payload size (4B, unsigned int32) | | | |
| |||| \
|Payload | | | |

Header： 前文描述的 4 字节头。
Payload size： 是按 Header 中指定压缩方式压缩 payload 后的长度，使用**大端**表示。
Payload： 包含音频的元数据以及 server 所需的相关参数，一般是 JSON 格式。具体的参数字段见下表：

| | | | | | | \
|字段 |说明 |层级 |格式 |是否必填 |备注 |
|---|---|---|---|---|---|
| | | | | | | \
|user |用户相关配置 |1 |dict | |提供后可供服务端过滤日志 |
| | | | | | | \
|uid |用户标识 |2 |string | |建议采用 IMEI 或 MAC。 |
| | | | | | | \
|did |设备名称 |2 |string | | |
| | | | | | | \
|platform |操作系统及API版本号 |2 |string | |iOS/Android/Linux |
| | | | | | | \
|sdk_version |sdk版本 |2 |string | | |
| | | | | | | \
|app_version |app 版本 |2 |string | | |
| | | | | | | \
|audio |音频相关配置 |1 |dict |✓ | |
| | | | | | | \
|language |指定可识别的语言 |2 |string | |**注意：仅流式输入模式(bigmodel_nostream)支持此参数** |\
| | | | | |当该键为空时，该模型支持**中英文、上海话、闽南语，四川、陕西、粤语**识别。当将其设置为下方特定键时，它可以识别指定语言。 |\
| | | | | |英语：en-US |\
| | | | | |日语：ja-JP |\
| | | | | |印尼语：id-ID |\
| | | | | |西班牙语：es-MX |\
| | | | | |葡萄牙语：pt-BR |\
| | | | | |德语：de-DE |\
| | | | | |法语：fr-FR |\
| | | | | |韩语：ko-KR |\
| | | | | |菲律宾语：fil-PH |\
| | | | | |马来语：ms-MY |\
| | | | | |泰语：th-TH |\
| | | | | |阿拉伯语：ar-SA |\
| | | | | |例如，如果输入音频是德语，则此参数传入de-DE |
| | | | | | | \
|format |音频容器格式 |2 |string |✓ |pcm / wav / ogg / mp3 |\
| | | | | |注意：pcm和wav内部音频流必须是pcm_s16le |
| | | | | | | \
|codec |音频编码格式 |2 |string | |raw / opus，默认为 raw(表示pcm) |\
| | | | | |注意: 当format为ogg的时候，codec必须是opus， |\
| | | | | | 当format为mp3的时候，codec不生效，传默认值raw即可 |
| | | | | | | \
|rate |音频采样率 |2 |int | |默认为 16000，目前只支持16000 |
| | | | | | | \
|bits |音频采样点位数 |2 |int | |默认为 16，暂只支持16bits |
| | | | | | | \
|channel |音频声道数 |2 |int | |1(mono) / 2(stereo)，默认为1。 |
| | | | | | | \
|request |请求相关配置 |1 |dict |✓ | |
| | | | | | | \
|model_name |模型名称 |2 |string |✓ |目前只有bigmodel |
| | | | | | | \
|enable_nonstream |开启二遍识别 |2 |bool | |开启流式+非流式**二遍识别模式**：在一个接口里实现即双向流式实时返回逐字文本+流式输入模式（nostream）重新识别该分句音频片段提升准确率，既可以满足客户实时上屏需求（快），又可以在最终结果中保证识别准确率（准）。 |\
| | | | | |目前二遍识别仅在**双向流式优化版**上支持，不支持旧版链路。 |\
| | | | | |开启二遍识别后，会默认开启VAD分句（默认800ms判停，数值可通过end_window_size参数配置），VAD分句判停时，会使用非流式模型（nostream接口）重新识别该分句音频。且只有在非流式（nostream接口）输出的识别结果中会输出"definite": true 分句标识。 |
| | | | | | | \
|enable_itn |启用itn |2 |bool | |默认为true。 |\
| | | | | |文本规范化 (ITN) 是自动语音识别 (ASR) 后处理管道的一部分。 ITN 的任务是将 ASR 模型的原始语音输出转换为书面形式，以提高文本的可读性。 |\
| | | | | |例如，“一九七零年”->“1970年”和“一百二十三美元”->“$123”。 |
| | | | | | | \
|enable_punc |启用标点 |2 |bool | |默认为true。 |
| | | | | | | \
|enable_ddc |启用顺滑 |2 |bool | |默认为false。 |\
| | | | | |**++语义顺滑++**‌是一种技术，旨在提高自动语音识别（ASR）结果的文本可读性和流畅性。这项技术通过删除或修改ASR结果中的不流畅部分，如停顿词、语气词、语义重复词等，使得文本更加易于阅读和理解。 |
| | | | | | | \
|show_utterances |输出语音停顿、分句、分词信息 |2 |bool | | |
| | | | | | | \
|show_speech_rate（仅nostream接口和双向流式优化版支持） |分句信息携带语速 |2 |bool | |如果设为"True"，则会在分句additions信息中使用speech_rate标记，单位为 token/s。默认 "False"。 |\
| | | | | |**双向流式优化版**启用此功能会默认开启VAD分句（默认800ms判停，数值可通过end_window_size参数配置。识别结果中"definite": true的分句的additions信息中携带标记信息） |
| | | | | | | \
|show_volume（仅nostream接口和双向流式优化版支持） |分句信息携带音量 |2 |bool | |如果设为"True"，则会在分句additions信息中使用volume标记，单位为 分贝。默认 "False"。 |\
| | | | | |**双向流式优化版**启用此功能会默认开启VAD分句（默认800ms判停，数值可通过end_window_size参数配置。识别结果中"definite": true的分句的additions信息中携带标记信息） |
| | | | | | | \
|enable_lid（仅nostream接口和双向流式优化版支持） |启用语种检测 |2 |bool | |**目前能识别语种，且能出识别结果的语言：中英文、上海话、闽南语，四川、陕西、粤语** |\
| | | | | |如果设为"True"，则会在additions信息中使用lid_lang标记, 返回对应的语种标签。默认 "False" |\
| | | | | |支持的标签包括： |\
| | | | | | |\
| | | | | |_ singing_en：英文唱歌 |\
| | | | | |_ singing_mand：普通话唱歌 |\
| | | | | |_ singing_dia_cant：粤语唱歌 |\
| | | | | |_ speech_en：英文说话 |\
| | | | | |_ speech_mand：普通话说话 |\
| | | | | |_ speech_dia_nan：闽南语 |\
| | | | | |_ speech_dia_wuu：吴语（含上海话） |\
| | | | | |_ speech_dia_cant：粤语说话 |\
| | | | | |_ speech_dia_xina：西南官话（含四川话） |\
| | | | | |_ speech_dia_zgyu：中原官话（含陕西话） |\
| | | | | |_ other_langs：其它语种（其它语种人声） |\
| | | | | |_ others：检测不出（非语义人声和非人声） |\
| | | | | | 空时代表无法判断（例如传入音频过短等） |\
| | | | | | |\
| | | | | |**实际不支持识别的语种（无识别结果），但该参数可检测并输出对应lang_code。对应的标签如下：** |\
| | | | | | |\
| | | | | |_ singing_hi：印度语唱歌 |\
| | | | | |_ singing_ja：日语唱歌 |\
| | | | | |_ singing_ko：韩语唱歌 |\
| | | | | |_ singing_th：泰语唱歌 |\
| | | | | |_ speech_hi：印地语说话 |\
| | | | | |_ speech_ja：日语说话 |\
| | | | | |_ speech_ko：韩语说话 |\
| | | | | |_ speech_th：泰语说话 |\
| | | | | |_ speech_kk：哈萨克语说话 |\
| | | | | |_ speech_bo：藏语说话 |\
| | | | | |_ speech_ug：维语 |\
| | | | | |_ speech_mn：蒙古语 |\
| | | | | |_ speech_dia_ql：琼雷话 |\
| | | | | |_ speech_dia_hsn：湘语 |\
| | | | | |_ speech_dia_jin：晋语 |\
| | | | | |_ speech_dia_hak：客家话 |\
| | | | | |_ speech_dia_chao：潮汕话 |\
| | | | | |_ speech_dia_juai：江淮官话 |\
| | | | | |_ speech_dia_lany：兰银官话 |\
| | | | | |_ speech_dia_dbiu：东北官话 |\
| | | | | |_ speech_dia_jliu：胶辽官话 |\
| | | | | |_ speech_dia_jlua：冀鲁官话 |\
| | | | | |_ speech_dia_cdo：闽东话 |\
| | | | | |_ speech_dia_gan：赣语 |\
| | | | | |_ speech_dia_mnp：闽北语 |\
| | | | | |_ speech_dia_czh：徽语 |\
| | | | | | |\
| | | | | |**双向流式优化版**启用此功能会默认开启VAD分句（默认800ms判停，数值可通过end_window_size参数配置。识别结果中"definite": true的分句的additions信息中携带标记信息） |
| | | | | | | \
|enable_emotion_detection（仅nostream接口和双向流式优化版支持） |启用情绪检测 |2 |bool | |如果设为"True"，则会在分句additions信息中使用emotion标记, 返回对应的情绪标签。默认 "False" |\
| | | | | |支持的情绪标签包括： |\
| | | | | | |\
| | | | | |_ "angry"：表示情绪为生气 |\
| | | | | |_ "happy"：表示情绪为开心 |\
| | | | | |_ "neutral"：表示情绪为平静或中性 |\
| | | | | |_ "sad"：表示情绪为悲伤 |\
| | | | | |_ "surprise"：表示情绪为惊讶 |\
| | | | | | |\
| | | | | |**双向流式优化版**启用此功能会默认开启VAD分句（默认800ms判停，数值可通过end_window_size参数配置。识别结果中"definite": true的分句的additions信息中携带标记信息） |
| | | | | | | \
|enable_gender_detection（仅nostream接口和双向流式优化版支持） |启用性别检测 |2 |bool | |如果设为"True"，则会在分句additions信息中使用gender标记, 返回对应的性别标签（male/female）。默认 "False"。 |\
| | | | | |**双向流式优化版**启用此功能会默认开启VAD分句（默认800ms判停，数值可通过end_window_size参数配置。识别结果中"definite": true的分句的additions信息中携带标记信息） |
| | | | | | | \
|result_type |结果返回方式 |2 |string | |默认为"full",全量返回。 |\
| | | | | |设置为"single"则为增量结果返回，即不返回之前分句的结果。 |
| | | | | | | \
|enable_accelerate_text |是否启动首字返回加速 |2 |bool | |如果设为"True"，则会尽量加速首字返回，但会降低首字准确率。 |\
| | | | | |默认 "False" |
| | | | | | | \
|accelerate_score |首字返回加速率 |2 |int | |配合enable_accelerate_text参数使用，默认为0，表示不加速，取值范围[0-20]，值越大，首字出字越快 |
| | | | | | | \
|vad_segment_duration |语义切句的最大静音阈值 |2 |int | |单位ms，默认为3000。当静音时间超过该值时，会将文本分为两个句子。不决定判停，所以不会修改definite出现的位置。在end_window_size配置后，该参数失效。 |
| | | | | | | \
|end_window_size |强制判停时间 |2 |int | |单位ms，默认为800，最小200。静音时长超过该值，会直接判停，输出definite。配置该值，不使用语义分句，根据静音时长来分句。用于实时性要求较高场景，可以提前获得definite句子 |
| | | | | | | \
|force_to_speech_time |强制语音时间 |2 |int | |单位ms，最小1。音频时长超过该值之后，才会尝试判停并返回definite=true，需配合end_window_size参数使用。对小于该数值的音频不做判停处理。 |\
| | | | | |推荐设置1000，可能会影响识别准确率。 |
| | | | | | | \
|sensitive_words_filter |敏感词过滤 |2 |string | |敏感词过滤功能,支持开启或关闭,支持自定义敏感词。该参数可实现：不处理(默认,即展示原文)、过滤、替换为_。 |\
| | | | | |示例： |\
| | | | | |system_reserved_filter //是否使用系统敏感词，会替换成*(默认系统敏感词主要包含一些限制级词汇） |\
| | | | | |filter_with_empty // 想要替换成空的敏感词 |\
| | | | | |filter_with_signed // 想要替换成 * 的敏感词 |\
| | | | | |`Python |\
| | | | | |"sensitive_words_filter":{\"system_reserved_filter\":true,\"filter_with_empty\":[\"敏感词\"],\"filter_with_signed\":[\"敏感词\"]}", |\
| | | | | |` |\
| | | | | | |
| | | | | | | \
|enable_poi_fc（nostream接口&双向流式优化版-开启二遍支持） |开启 POI function call |2 |bool | |对于语音识别困难的词语，能调用专业的地图领域推荐词服务辅助识别 |\
| | | | | |示例： |\
| | | | | |`Python |\
| | | | | |"request": { |\
| | | | | |    "enable_poi_fc": true, |\
| | | | | |    "corpus": { |\
| | | | | |        "context": "{\"loc_info\":{\"city_name\":\"北京市\"}}" |\
| | | | | |    } |\
| | | | | |} |\
| | | | | |` |\
| | | | | | |\
| | | | | |其中loc_info字段可选，传入该字段结果相对更精准，city_name单位为地级市。 |
| | | | | | | \
|enable_music_fc（nostream接口&双向流式优化版-开启二遍支持） |开启音乐 function call |2 |bool | |对于语音识别困难的词语，能调用专业的音领域推荐词服务辅助识别 |\
| | | | | |示例： |\
| | | | | |`Python |\
| | | | | |"request": { |\
| | | | | |    "enable_music_fc": true |\
| | | | | |} |\
| | | | | |` |\
| | | | | | |
| | | | | | | \
|corpus |语料/干预词等 |2 |dict | | |
| | | | | | | \
|boosting_table_name |自学习平台上设置的热词词表名称 |3 |string | |热词表功能和设置方法可以参考[文档](https://www.volcengine.com/docs/6561/155739) |
| | | | | | | \
|boosting_table_id |自学习平台上设置的热词词表id |3 |string | |热词表功能和设置方法可以参考[文档](https://www.volcengine.com/docs/6561/155739) |
| | | | | | | \
|correct_table_name |自学习平台上设置的替换词词表名称 |3 |string | |替换词功能和设置方法可以参考[文档](https://www.volcengine.com/docs/6561/1206007) |
| | | | | | | \
|correct_table_id |自学习平台上设置的替换词词表id |3 |string | |替换词功能和设置方法可以参考[文档](https://www.volcengine.com/docs/6561/1206007) |
| | | | | | | \
|context |热词或者上下文 |3 |string | |1. 热词直传（优先级高于传热词表），双向流式支持100tokens，流式输入nostream支持5000个词 |\
| | | | | | |\
| | | | | |"context":"{\"hotwords\":[{\"word\":\"热词1号\"}, {\"word\":\"热词2号\"}]}" |\
| | | | | | |\
| | | | | | |\
| | | | | |2. 上下文，限制800 tokens及20轮（含）内，超出会按照时间顺序从新到旧截断，优先保留更新的对话 |\
| | | | | | |\
| | | | | | context_data字段按照从新到旧的顺序排列，传入需要序列化为jsonstring（转义引号） |\
| | | | | |**豆包流式语音识别模型2.0，支持将上下文理解的范围从纯文本扩展到视觉层面，** |\
| | | | | |**通过理解图像内容，帮助模型更精准地完成语音转录。通过image_url传入图片，** |\
| | | | | |**图片限制传入1张，大小：500k以内（格式：jpeg、jpg、png ）** |\
| | | | | |`SQL |\
| | | | | |上下文:可以加入对话历史、聊天所在bot信息、个性化信息、业务场景信息等,如: |\
| | | | | |a.对话历史:把最近几轮的对话历史传进来 |\
| | | | | |b.聊天所在bot信息:如"我在和林黛玉聊天","我在使用A助手和手机对话" |\
| | | | | |c.个性化信息:"我当前在北京市海淀区","我有四川口音","我喜欢音乐" |\
| | | | | |d.业务场景信息:"当前是中国平安的营销人员针对外部客户采访的录音,可能涉及..." |\
| | | | | |{ |\
| | | | | |    \"context_type\": \"dialog_ctx\", |\
| | | | | |    \"context_data\":[ |\
| | | | | |        {\"text\": \"text1\"}, |\
| | | | | |        {\"image_url\": \"image_url\"}, |\
| | | | | |        {\"text\": \"text2\"}, |\
| | | | | |        {\"text\": \"text3\"}, |\
| | | | | |        {\"text\": \"text4\"}, |\
| | | | | |        ... |\
| | | | | |    ] |\
| | | | | |} |\
| | | | | |` |\
| | | | | | |

参数示例：

```JSON
{
    "user": {
        "uid": "388808088185088"
    },
    "audio": {
        "format": "wav",
        "rate": 16000,
        "bits": 16,
        "channel": 1,
        "language": "zh-CN"
    },
    "request": {
        "model_name": "bigmodel",
        "enable_itn": false,
        "enable_ddc": false,
        "enable_punc": false,
        "corpus": {
            "boosting_table_id": "通过自学习平台配置热词的词表id",
            },
            "context": {
                \"context_type\": \"dialog_ctx\",
                \"context_data\":[
                    {\"text\": \"text1\"},
                    {\"text\": \"text2\"},
                    {\"text\": \"text3\"},
                    {\"text\": \"text4\"},
                    ...
                ]
            }
        }
    }
}
```

<span id="eaf63ef1"></span>

### 发送 audio only request

Client 发送 full client request 后，再发送包含音频数据的 audio-only client request。音频应采用 full client request 中指定的格式（音频格式、编解码器、采样率、声道）。格式如下：

| | | | | \
|**31 ... 24** |**23 ... 16** |**15 ... 8** |**7 ... 0** |
|---|---|---|---|
| |||| \
|Header | | | |
| |||| \
|Payload size (4B, unsigned int32) | | | |
| |||| \
|Payload | | | |

Payload 是使用指定压缩方法，压缩音频数据后的内容。可以多次发送 audio only request 请求，例如在流式语音识别中如果每次发送 100ms 的音频数据，那么 audio only request 中的 Payload 就是 100ms 的音频数据。
<span id="096d0921"></span>

### full server response

Client 发送的 full client request 和 audio only request，服务端都会返回 full server response。格式如下：

| | | | | \
|**31 ... 24** |**23 ... 16** |**15 ... 8** |**7 ... 0** |
|---|---|---|---|
| |||| \
|Header | | | |
| |||| \
|Sequence | | | |
| |||| \
|Payload size (4B, unsigned int32) | | | |
| |||| \
|Payload | | | |

Payload 内容是包含识别结果的 JSON 格式，字段说明如下：

| | | | | | | \
|字段 |说明 |层级 |格式 |是否必填 |备注 |
|---|---|---|---|---|---|
| | | | | | | \
|result |识别结果 |1 |list | |仅当识别成功时填写 |
| | | | | | | \
|text |整个音频的识别结果文本 |2 |string | |仅当识别成功时填写。 |
| | | | | | | \
|utterances |识别结果语音分句信息 |2 |list | |仅当识别成功且开启show_utterances时填写。 |
| | | | | | | \
|text |utterance级的文本内容 |3 |string | |仅当识别成功且开启show_utterances时填写。 |
| | | | | | | \
|start_time |起始时间（毫秒） |3 |int | |仅当识别成功且开启show_utterances时填写。 |
| | | | | | | \
|end_time |结束时间（毫秒） |3 |int | |仅当识别成功且开启show_utterances时填写。 |
| | | | | | | \
|definite |是否是一个确定分句 |3 |bool | |仅当识别成功且开启show_utterances时填写。 |

```JSON
{
  "audio_info": {"duration": 10000},
  "result": {
      "text": "这是字节跳动， 今日头条母公司。",
      "utterances": [
        {
          "definite": true,
          "end_time": 1705,
          "start_time": 0,
          "text": "这是字节跳动，",
          "words": [
            {
              "blank_duration": 0,
              "end_time": 860,
              "start_time": 740,
              "text": "这"
            },
            {
              "blank_duration": 0,
              "end_time": 1020,
              "start_time": 860,
              "text": "是"
            },
            {
              "blank_duration": 0,
              "end_time": 1200,
              "start_time": 1020,
              "text": "字"
            },
            {
              "blank_duration": 0,
              "end_time": 1400,
              "start_time": 1200,
              "text": "节"
            },
            {
              "blank_duration": 0,
              "end_time": 1560,
              "start_time": 1400,
              "text": "跳"
            },
            {
              "blank_duration": 0,
              "end_time": 1640,
              "start_time": 1560,
              "text": "动"
            }
          ]
        },
        {
          "definite": true,
          "end_time": 3696,
          "start_time": 2110,
          "text": "今日头条母公司。",
          "words": [
            {
              "blank_duration": 0,
              "end_time": 3070,
              "start_time": 2910,
              "text": "今"
            },
            {
              "blank_duration": 0,
              "end_time": 3230,
              "start_time": 3070,
              "text": "日"
            },
            {
              "blank_duration": 0,
              "end_time": 3390,
              "start_time": 3230,
              "text": "头"
            },
            {
              "blank_duration": 0,
              "end_time": 3550,
              "start_time": 3390,
              "text": "条"
            },
            {
              "blank_duration": 0,
              "end_time": 3670,
              "start_time": 3550,
              "text": "母"
            },
            {
              "blank_duration": 0,
              "end_time": 3696,
              "start_time": 3670,
              "text": "公"
            },
            {
              "blank_duration": 0,
              "end_time": 3696,
              "start_time": 3696,
              "text": "司"
            }
          ]
        }
      ]
   },
  "audio_info": {
    "duration": 3696
  }
}
```

<span id="8aa108f1"></span>

### Error message from server

当 server 发现无法解决的二进制/传输协议问题时，将发送 Error message from server 消息（例如，client 以 server 不支持的序列化格式发送消息）。格式如下：

| | | | | \
|**31 ... 24** |**23 ... 16** |**15 ... 8** |**7 ... 0** |
|---|---|---|---|
| |||| \
|Header | | | |
| |||| \
|Error message code (4B, unsigned int32) | | | |
| |||| \
|Error message size (4B, unsigned int32) | | | |
| |||| \
|Error message (UTF8 string) | | | |

Header： 前文描述的 4 字节头。
Error message code： 错误码，使用**大端**表示。
Error message size： 错误信息长度，使用**大端**表示。
Error message： 错误信息。
<span id="4665ea66"></span>

### 示例

<span id="87bf74a6"></span>

#### 示例：客户发送 3 个请求

下面的 message flow 会发送多次消息，每个消息都带有版本、header 大小、保留数据。由于每次消息中这些字段值相同，所以有些消息中这些字段省略了。
Message flow:
client 发送 "Full client request"

version: `b0001` (4 bits)
header size: `b0001` (4 bits)
message type: `b0001` (Full client request) (4bits)
message type specific flags: `b0000` (use_specific_pos_sequence) (4bits)
message serialization method: `b0001` (JSON) (4 bits)
message compression: `b0001` (Gzip) (4bits)
reserved data: `0x00` (1 byte)
payload size = Gzip 压缩后的长度
payload: json 格式的请求字段经过 Gzip 压缩后的数据

server 响应 "Full server response"

version: `b0001`
header size: `b0001`
message type: `b1001` (Full server response)
message type specific flags: `b0001` (none)
message serialization method: `b0001` (JSON 和请求相同)
message compression: `b0001` (Gzip 和请求相同)
reserved data: `0x00`
sequence: 0x00 0x00 0x00 0x01 (4 byte) sequence=1
payload size = Gzip 压缩后数据的长度
payload: Gzip 压缩后的响应数据

client 发送包含第一包音频数据的 "Audio only client request"

version: `b0001`
header size: `b0001`
message type: `b0010` (audio only client request)
message type specific flags: `b0000` (用户设置正数 sequence number)
message serialization method: `b0000` (none - raw bytes)
message compression: `b0001` (Gzip)
reserved data: `0x00`
payload size = Gzip 压缩后的音频长度
payload: 音频数据经过 Gzip 压缩后的数据

server 响应 "Full server response"

message type: `0b1001` - Full server response
message specific flags: `0b0001` (none)
message serialization: `0b0001` (JSON, 和请求相同)
message compression `0b0001` (Gzip, 和请求相同)
reserved data: `0x00`
sequence data: 0x00 0x00 0x00 0x02 (4 byte) sequence=2
payload size = Gzip 压缩后数据的长度
payload: Gzip 压缩后的响应数据

client 发送包含最后一包音频数据（通过 message type specific flags) 的 "Audio-only client request"，

message type: `b0010` (audio only client request)
message type specific flags: **`b0010`** (最后一包音频请求)
message serialization method: `b0000` (none - raw bytes)
message compression: `b0001` (Gzip)
reserved data: `0x00`
payload size = Gzip 压缩后的音频长度
payload: Gzip 压缩后的音频数据

server 响应 "Full server response" - 最终回应及处理结果

message type: `b1001` (Full server response)
message type specific flags: `b0011` (最后一包音频结果)
message serialization method: `b0001` (JSON)
message compression: `b0001` (Gzip)
reserved data: `0x00`
sequence data: `0x00 0x00 0x00 0x03` (4byte) sequence=3
payload size = Gzip 压缩后的 JSON 长度
payload: Gzip 压缩后的 JSON 数据

如处理过程中出现错误信息，可能有以下错误帧的返回

message type: `b1111` (error response)
message type specific flags: `b0000` (none)
message serialization method: `b0001` (JSON)
message compression: `b0000` (none)
reserved data: `0x00`
Error code data: `0x2A 0x0D 0x0A2 0xff` (4byte) 错误码
payload size = 错误信息对象的 JSON 长度
payload: 错误信息对象的 JSON 数据

<span id="989f9570"></span>

## 错误码

| | | | \
|错误码 |含义 |说明 |
|---|---|---|
| | | | \
|20000000 |成功 | |
| | | | \
|45000001 |请求参数无效 |请求参数缺失必需字段 / 字段值无效 / 重复请求。 |
| | | | \
|45000002 |空音频 | |
| | | | \
|45000081 |等包超时 | |
| | | | \
|45000151 |音频格式不正确 | |
| | | | \
|550xxxxx |服务内部处理错误 | |
| | | | \
|55000031 |服务器繁忙 |服务过载，无法处理当前请求。 |

<span id="4468a455"></span>

# Demo

Python：
<Attachment link="https://p9-arcosite.byteimg.com/tos-cn-i-goo7wpa0wc/9a5371db0dbb4fc389115e8808a5ac73~tplv-goo7wpa0wc-image.image" name="sauc_python.zip" ></Attachment>
Go：
<Attachment link="https://p9-arcosite.byteimg.com/tos-cn-i-goo7wpa0wc/11e65137790c4ecb8651e01221adc8e9~tplv-goo7wpa0wc-image.image" name="sauc_go.zip" ></Attachment>
Java：
<Attachment link="https://p9-arcosite.byteimg.com/tos-cn-i-goo7wpa0wc/9bf64204b30b4ba8be3099c5c5193bdc~tplv-goo7wpa0wc-image.image" name="sauc.zip" ></Attachment>
