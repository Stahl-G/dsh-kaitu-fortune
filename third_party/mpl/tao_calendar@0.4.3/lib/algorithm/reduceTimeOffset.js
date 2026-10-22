/*
 * @Description:
 * @Version: 1.0.0
 * @Author: lax
 * @Date: 2024-07-27 11:00:10
 * @LastEditors: lax
 * @LastEditTime: 2024-07-27 11:14:22
 */
function reduceTimeOffset(t) {
  let offset = t.getTime() < 0 ? t.getTimezoneOffset() + 5 : t.getTimezoneOffset();
  return offset * 60000;
}
module.exports = reduceTimeOffset;