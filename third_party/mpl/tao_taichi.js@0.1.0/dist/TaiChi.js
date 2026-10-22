/*
 * @Description:
 * @Version: 1.0.0
 * @Author: lax
 * @Date: 2023-05-05 16:19:28
 * @LastEditors: lax
 * @LastEditTime: 2024-05-18 21:02:00
 */
const {
  LOGOS_ARR,
  LOGOS
} = require("tao_name");
/**
 * 《道德经》：道可道，非常道，名可名，非常名
 * 《道德经》：道生一，一生二，二生三，三生万物
 *  道之名也，不可谓之全，强谓太极，太极生阴阳。所谓阴阳，不过盛衰之分，有无之辩
 * 《道德经》：反者道之动。弱者道之用。天下万物生于有，有生于无。
 *	固先无而后有，有生于无，有因无而有。无者，为始，为空，固取零而示之。
 *  有者，为起，固取一而示之。
 *  逻各斯（LOGOS），赫拉克利特提出的类逻辑规律概念，为西方最早的抽象用词，固取其以表阴阳。
 *  因此0为无为阴，1为有为阳，当是合乎其理
 *
 *  此类为一切易理之原始对象
 */
class TaiChi {
  constructor(arg) {
    this.logos = ~~(arg + 1) === 0 ? LOGOS_ARR.indexOf(arg) : ~~arg % 2;
  }
  getLogos(is = false) {
    return is ? LOGOS_ARR[this.logos] : this.logos;
  }
}
TaiChi.LOGOS = LOGOS;
module.exports = TaiChi;