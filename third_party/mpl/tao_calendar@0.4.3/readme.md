<!--
 * @Description: 
 * @Version: 1.0.0
 * @Author: lax
 * @Date: 2023-06-03 13:54:11
 * @LastEditors: lax
 * @LastEditTime: 2024-07-23 22:51:53
-->
# 干支历 Calendar
基于js的干支历

## 说明
根据纯阳历进行编排的干支历转换，即月按二十四节气计算，不考虑朔望、建寅。
可自行调节干支历轮回起始。（详见用法）
二十四节气根据VSOP87D计算,其中考虑了章动修正（默认IAU2000）、光行差修正。
可自动从公历转为干支历。
## 用法

### 字符串
```
new Calendar("甲子甲子甲子甲子");
```

### 数组
```
new Calendar(["甲子","甲子","甲子","甲子"]);
new Calendar([0,0,0,0]);
```

### 日期
```
new Calendar(new Date());
```

### 调整起始日期
```
new Calendar(now,origin);
origin 为Date类型,默认为"-002696-10-14T14:00:00.000Z"(TODO,临时取值，待更新)
```


