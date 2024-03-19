## 一、背景说明
我们搭建好一个flow或者AI助理之后，希望能跟自己系统快速集成，flow提供了通过api-key授权方式快速提供api方式访问。
## 二、设置api key
2.1 进入flow编辑页面，点击 API Key，自动生成api key

![flow_api_image](https://cdn.letsmagic.cn/static/img/flow_api_image.png)


2.2 点击复制按钮，就能得到curl命令如下：

![flow_api_image_2](https://cdn.letsmagic.cn/static/img/flow_api_image_2.png)

```shell

curl --location 
--request POST "https://i-magic-service.letsmagic.cn/api/chat" 
--header 'api-key: api-sk-68188*************' 
--header 'Content-Type: application/json'
--data-raw '{
"message": "你是谁",
"conversation_id": ""
}'
```

## 三、更多 flow api
[https://www.teamshare.cn/knowledge/preview/710857519214628864/775772643732844544](https://www.teamshare.cn/knowledge/preview/710857519214628864/775772643732844544)

