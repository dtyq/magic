## 🔍 Anteprima funzioni

Attenzione: il pannello di amministrazione è in beta. Per ora configura i modelli tramite variabili d'ambiente: ../../../development/deploy/environment.md#_4-ai-模型配置

Se sei un super amministratore di organizzazione: clicca sull'avatar in alto a sinistra ⇒ entra nella console di amministrazione.

![Fi-lguvpG_yCUWav8wIsw6lfvoYp.png](https://cdn.letsmagic.cn/static/img/Fi-lguvpG_yCUWav8wIsw6lfvoYp.png)

## ☁️ Configurare Microsoft Azure
### 2.1 Inserisci l’endpoint API

![FkV9KpWFwEU56B88zPK7nwdUeYil.png](https://cdn.letsmagic.cn/static/img/FkV9KpWFwEU56B88zPK7nwdUeYil.png)

## 🪄 Configurare ByteDance Volcengine
### 3.1 Indirizzo API
https://ark.cn-beijing.volces.com/

![FioaPOfC3oc0bGaaWq78sgyd7_i1.png](https://cdn.letsmagic.cn/static/img/FioaPOfC3oc0bGaaWq78sgyd7_i1.png)

### 3.2 Nome modello

![Fn2GBfAUgc4AkK5SiGbmYj3x8kgj.png](https://cdn.letsmagic.cn/static/img/Fn2GBfAUgc4AkK5SiGbmYj3x8kgj.png)

## 🧩 Provider personalizzato (compatibile OpenAI API)
### 4.1 Aggiungi un provider personalizzato

![FvKLaK0LaSNSMYsVLDmpRBGbJ7Ad.png](https://cdn.letsmagic.cn/static/img/FvKLaK0LaSNSMYsVLDmpRBGbJ7Ad.png)

### 4.2 Configura l’endpoint API
- Kimi LLM: https://api.moonshot.cn
- Baidu Qianfan: https://qianfan.baidubce.com/v2

![FtB1mFoFCiL3kAaqBh0x8yAYnBw8.png](https://cdn.letsmagic.cn/static/img/FtB1mFoFCiL3kAaqBh0x8yAYnBw8.png)

### 4.3 Aggiungi i modelli corrispondenti

![Fnf25GBXzCb_gnS1DtLSDLJOk-LR.png](https://cdn.letsmagic.cn/static/img/Fnf25GBXzCb_gnS1DtLSDLJOk-LR.png)

## 🧠 Abilitare i modelli di embedding vettoriale
Esempio con Volcengine:
1) Introduzione agli embedding: https://www.volcengine.com/docs/82379/1302003
2) Clic su “Vai al debug”

![FsqFvaxlu7MiQB7Jg8zsgmlyBoeU.png](https://cdn.letsmagic.cn/static/img/FsqFvaxlu7MiQB7Jg8zsgmlyBoeU.png)

3) Avvia il debug; se non è abilitato, abilita il modello e autorizza l’API Key

![alt text](https://cdn.letsmagic.cn/static/img/FsqFvaxlu7MiQB7Jg8zsgmlyBoeU.png)

![FrLzQgYd-R0cPuh-grhOffzgNyLR.png](https://cdn.letsmagic.cn/static/img/FrLzQgYd-R0cPuh-grhOffzgNyLR.png)

4) Dopo il successo del debug, puoi temporaneamente aggiornare il modello di embedding tramite API Magic (in futuro sarà gestito dal pannello admin)

---

# 中文原文
## 一、功能预览

> **⚠️ 提示**：管理后台正在内测中，请暂时通过[环境变量配置](../../../development/deploy/environment.md#_4-ai-%E6%A8%A1%E5%9E%8B%E9%85%8D%E7%BD%AE)来设置大模型。

如果是组织超管角色，从左上角点头像 =》进入管理后台

![Fi-lguvpG_yCUWav8wIsw6lfvoYp.png](https://cdn.letsmagic.cn/static/img/Fi-lguvpG_yCUWav8wIsw6lfvoYp.png)

## 二、配置微软 Azure 服务商
#### 2.1 填入 API 地址

![FkV9KpWFwEU56B88zPK7nwdUeYil.png](https://cdn.letsmagic.cn/static/img/FkV9KpWFwEU56B88zPK7nwdUeYil.png)

## 三、配置字节服务商
#### 3.1 API 地址：
[https://ark.cn-beijing.volces.com/](https://ark.cn-beijing.volces.com/)

![FioaPOfC3oc0bGaaWq78sgyd7_i1.png](https://cdn.letsmagic.cn/static/img/FioaPOfC3oc0bGaaWq78sgyd7_i1.png)

#### 3.2 模型名称

![Fn2GBfAUgc4AkK5SiGbmYj3x8kgj.png](https://cdn.letsmagic.cn/static/img/Fn2GBfAUgc4AkK5SiGbmYj3x8kgj.png)


## 四、配置自定义服务商（支持 OpenAI API 格式）
#### 4.1 添加自定义服务商

![FvKLaK0LaSNSMYsVLDmpRBGbJ7Ad.png](https://cdn.letsmagic.cn/static/img/FvKLaK0LaSNSMYsVLDmpRBGbJ7Ad.png)


#### 4.2配置 API 地址
- Kimi 大模型 API 地址：[https://api.moonshot.cn](https://api.moonshot.cn)
- 百度千帆平台 API 地址：[https://qianfan.baidubce.com/v2](https://qianfan.baidubce.com/v2)

![FtB1mFoFCiL3kAaqBh0x8yAYnBw8.png](https://cdn.letsmagic.cn/static/img/FtB1mFoFCiL3kAaqBh0x8yAYnBw8.png)

#### 4.3 添加对应的模型

![Fnf25GBXzCb_gnS1DtLSDLJOk-LR.png](https://cdn.letsmagic.cn/static/img/Fnf25GBXzCb_gnS1DtLSDLJOk-LR.png)

## 五、开通向量化 embedding 模型
- 火山云为例：
- 5.1 进入向量化 embedding 模型介绍：[https://www.volcengine.com/docs/82379/1302003](https://www.volcengine.com/docs/82379/1302003)
- 5.2 点击：去调试

![FsqFvaxlu7MiQB7Jg8zsgmlyBoeU.png](https://cdn.letsmagic.cn/static/img/FsqFvaxlu7MiQB7Jg8zsgmlyBoeU.png)


- 5.3 发起调试，如果没用开通，会要求开通模型，并要求授权 API Key
![alt text](https://cdn.letsmagic.cn/static/img/FsqFvaxlu7MiQB7Jg8zsgmlyBoeU.png)

![FrLzQgYd-R0cPuh-grhOffzgNyLR.png](https://cdn.letsmagic.cn/static/img/FrLzQgYd-R0cPuh-grhOffzgNyLR.png)

- 5.4 调试成功之后，调用 Magic 接口修改 embedding 模型（临时用），后面会改到管理员配置面板
