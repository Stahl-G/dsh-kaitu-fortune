<!--
 * @Description: 
 * @Version: 1.0.0
 * @Author: lax
 * @Date: 2022-08-11 00:02:06
 * @LastEditors: lax
 * @LastEditTime: 2023-07-09 13:27:02
 * @FilePath: \nutation\readme.md
-->
# TaiChi.js
阴阳五行抽象对象的基础包，一般无需单独使用。更多资讯请查看[Taogram](https://github.com/Taogram/taogram)

## 一.说明/info

### 五行取义
《洛书》:
天一生水、地六成之;
地二生火、天七成之;
天三生木、地八成之;
地四生金、天九成之;
天五生土、地十成之;
故有水一、火二、木三、金四、土五。
而数组序号始于零，为便利而用，0~4->水火木金土。

Phase指代五行，取五行生生不息相互转化的某一静态阶段而论。

### 阴阳取义
《道德经》:
道生一，一生二，二生三，三生万物。
天下万物生于有，有生于无。
阴阳之化即为有无之变，又有生于无，故阴阳->01。
零为无而有生，生之为一。

Logos指定阴阳，Logos即逻格斯，源于古希腊哲学家赫拉克利特之论，指代事物的一般规律，这个规律来自于语言背后的真理。
阴阳为道，道可道，非常道。故用Logos指代道。

### 方法取义
五行之作用，即生泄耗克，其中泄为被生，耗为被克。（自《五行大义》）
故取promotion为生、promoted为泄、restrained为耗、restraint为克。
为便利而用，分有sheng、xie、hao、ke拼音为别名。

同我者旺，我生者相、生我者休、克我者囚、我克者死。
故有vigorous、second、rest、imprison、death。
为便利而用，分有wang、xiang、xiu、qiu、si拼音为别名。

## 二.使用/use

### create
```
const { Phases } = require("tao_taichi.js");
<!-- 0~4=>水火木金土 -->
const ele = new Phases(0~4);
```
### 生=>我生者
```
ele.promotion();
ele.sheng();
ele.get("生");
```
### 被生/泄=>生我者
```
ele.promoted();
ele.xie();
ele.get("泄");
```
### 被克/耗=>克我者
```
ele.restrained();
ele.hao();
ele.get("耗");
```
### 克=>我克者
```
ele.restraint();
ele.ke();
ele.get("克");
```
### 旺
```
ele.vigorous();
ele.wang();
ele.get("旺");
```
### 相
```
ele.second();
ele.xiang();
ele.get("相");
```
### 休
```
ele.rest();
ele.xiu();
ele.get("休");
```
### 囚
```
ele.imprison();
ele.qiu();
ele.get("囚");
```
### 死
```
ele.death();
ele.si();
ele.get("死");
```
### 输出字或序号
```
ele => 金
ele.death(true) => "木"
ele.death() => 2
```
### 判断与另外一个五行关系
```
ele.with("金")
result: 0~4=>旺相休囚死/X生泄耗克
```
### 获取五行
```
ele.getPhases(true/false)
```
### 获取阴阳
```
ele.getLogos(true/false)
```

## 三.判断用法

## 例子

```
ele.death() === Phases.RELATION.DEATH
```

### 别称说明
#### 旺相休囚死(英文)
VIGOROUS: 0,
SECOND: 1,
REST: 2,
IMPRISON: 3,
DEATH: 4,
#### 旺相休囚死(拼音)
WANG: 0,
XIANG: 1,
XIU: 2,
QIU: 3,
SI: 4,
#### 生被生被克克(拼音)
SHENG: 1,
XIE: 2,
HAO: 3,
KE: 4,
####  生被生被克克(简写)
S: 1,
X: 2,
H: 3,
K: 4,
####  生被生被克克(英文)
PROMOTION: 1,
PROMOTED: 2,
RESTRAINED: 3,
RESTRAINT: 4,

