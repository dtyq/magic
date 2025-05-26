## 一、功能预览
如果是组织超管角色，从左上角点头像》进入管理后台

![model_admin.png](https://cdn.letsmagic.cn/static/img/model_admin.png?v=2)




## 二、配置微软azure服务商
#### 2.1 填入api地址

![FkV9KpWFwEU56B88zPK7nwdUeYil.png](https://cdn.letsmagic.cn/static/img/FkV9KpWFwEU56B88zPK7nwdUeYil.png)




## 三、配置字节服务商
#### 3.1 api地址：
[https://ark.cn-beijing.volces.com/](https://ark.cn-beijing.volces.com/)

![FioaPOfC3oc0bGaaWq78sgyd7_i1.png](https://cdn.letsmagic.cn/static/img/FioaPOfC3oc0bGaaWq78sgyd7_i1.png)



#### 3.2 模型名称

![Fn2GBfAUgc4AkK5SiGbmYj3x8kgj.png](https://cdn.letsmagic.cn/static/img/Fn2GBfAUgc4AkK5SiGbmYj3x8kgj.png)





## 四、配置自定义服务商（支持OpenAi api形式）
#### 4.1添加自定义服务商

![FvKLaK0LaSNSMYsVLDmpRBGbJ7Ad.png](https://cdn.letsmagic.cn/static/img/FvKLaK0LaSNSMYsVLDmpRBGbJ7Ad.png)



#### 4.2配置api地址
- Kimi大模型Api地址：[https://api.moonshot.cn](https://api.moonshot.cn)
- 百度千帆平台Api地址：[https://qianfan.baidubce.com/v2](https://qianfan.baidubce.com/v2)

![FtB1mFoFCiL3kAaqBh0x8yAYnBw8.png](https://cdn.letsmagic.cn/static/img/FtB1mFoFCiL3kAaqBh0x8yAYnBw8.png)



#### 4.3添加对应的模型

![Fnf25GBXzCb_gnS1DtLSDLJOk-LR.png](https://cdn.letsmagic.cn/static/img/Fnf25GBXzCb_gnS1DtLSDLJOk-LR.png)




## 五、开通向量化embedding模型
- 火山云为例：
- 5.1 进入向量化embedding模型介绍：[https://www.volcengine.com/docs/82379/1302003](https://www.volcengine.com/docs/82379/1302003)
- 5.2 点击：去调试


![FsqFvaxlu7MiQB7Jg8zsgmlyBoeU.png](https://cdn.letsmagic.cn/static/img/FsqFvaxlu7MiQB7Jg8zsgmlyBoeU.png)




- 5.3 发起调试，如果没用开通，会要求开通模型，并要求授权 API Key
![alt text](https://cdn.letsmagic.cn/static/img/FsqFvaxlu7MiQB7Jg8zsgmlyBoeU.png)

![FrLzQgYd-R0cPuh-grhOffzgNyLR.png](https://cdn.letsmagic.cn/static/img/FrLzQgYd-R0cPuh-grhOffzgNyLR.png)




- 5.4 调试成功之后，调用magic接口修改emberding模型(临时用)，后面会改到admin配置面板