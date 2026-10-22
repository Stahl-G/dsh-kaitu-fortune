/*
 * @Description:
 * @Version: 1.0.0
 * @Author: lax
 * @Date: 2023-04-09 22:16:00
 * @LastEditors: lax
 * @LastEditTime: 2024-07-27 11:04:41
 */
const reduceTimeOffset = require("./reduceTimeOffset");
module.exports = function calcMonth(date, during, accuracy) {
  // 修正至时区日期的对比
  let dateTime = date.getTime() - reduceTimeOffset(date);
  dateTime = accuracy ? dateTime : ~~(dateTime / 86400000);
  const index = during.reduce((acc, next, i) => {
    if (typeof acc === "number") return acc;
    // 修正至时区日期的对比
    let accTime = acc.getTime() - reduceTimeOffset(acc);
    let nextTime = next.getTime() - reduceTimeOffset(next);
    accTime = accuracy ? accTime : ~~(accTime / 86400000);
    nextTime = accuracy ? nextTime : ~~(nextTime / 86400000);
    if (i === 1 && dateTime < accTime) return 0;
    if (i === 23 && dateTime >= nextTime) return 24;
    let isBetween = dateTime >= accTime && dateTime < nextTime;
    return isBetween ? i : next;
  });
  return ~~(index / 2 + 0.5) % 12;
};