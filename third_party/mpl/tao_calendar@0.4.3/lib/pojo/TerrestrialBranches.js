/*
 * @Description:
 * @Version: 1.0.0
 * @Author: lax
 * @Date: 2023-05-05 23:10:26
 * @LastEditors: lax
 * @LastEditTime: 2024-05-18 21:12:51
 */
const CONNECTION = require("./alias.js");
const {
  TERRESTRIAL_BRANCHES_ARR,
  TERRESTRIAL_BRANCHES,
  TB,
  TB_ARR
} = require("tao_name");
const {
  Phases
} = require("tao_taichi.js");
const inspect = Symbol.for("nodejs.util.inspect.custom");
class TerrestrialBranches extends Phases {
  constructor(index) {
    if (index instanceof TerrestrialBranches) return index;
    // 文字取序号，数字取周期后序列
    const i = ~~(index + 1) === 0 ? TERRESTRIAL_BRANCHES_ARR.indexOf(index) : ~~index % 12;
    if (i < 0) throw new Error("arg can`t be use");
    // 水土木木土火火土金金土水
    const _i = ~~((i + 1) / 3) % 4;
    super(i % 3 === 1 ? 4 : _i === 0 ? 0 : 3 - _i % 3, (i + 1) % 2);
    this.index = i;
  }
  getValue(is = false) {
    return is ? TERRESTRIAL_BRANCHES_ARR[this.index] : this.index;
  }

  // 合
  // 01/211/310/49/58/67/
  // 804/2610/1137/591/
  combination() {
    const six = new TerrestrialBranches((13 - this.index) % 12);
    const three = [new TerrestrialBranches((this.index - 4 + 12) % 12), new TerrestrialBranches((this.index + 4 + 12) % 12)];
    return [six, three];
  }
  he() {
    return this.combination();
  }

  // 冲
  // 06/17/28/39/410/511
  conflict() {
    return new TerrestrialBranches((this.index + 6) % 12);
  }
  chong() {
    return this.conflict();
  }

  // 刑
  // 03/30/
  // 110/107/71/
  // 25/58/82/
  // 44/66/99/1111/
  punishment() {
    let i = 0;
    // 自刑
    i = [4, 6, 9, 11].indexOf(this.index);
    if (i !== -1) return [new TerrestrialBranches(this.index)];
    const _arr1 = [1, 10, 7];
    i = _arr1.indexOf(this.index);
    // 三刑
    if (i !== -1) return [new TerrestrialBranches(_arr1[(i - 1 + 3) % 3]), new TerrestrialBranches(_arr1[(i + 1 + 3) % 3])];
    const _arr2 = [2, 5, 8];
    i = _arr2.indexOf(this.index);
    if (i !== -1) return [new TerrestrialBranches(_arr2[(i - 1 + 3) % 3]), new TerrestrialBranches(_arr2[(i + 1 + 3) % 3])];
    // 相刑
    i = [0, 3].indexOf(this.index);
    return [new TerrestrialBranches(this.index === 0 ? 3 : 0)];
  }
  xing() {
    return this.punishment();
  }

  // 害
  // 07/16/25/34/811/910
  harm() {
    return new TerrestrialBranches((7 - this.index + 12) % 12);
  }
  hai() {
    return this.harm();
  }
  get(tag, is) {
    switch (tag) {
      case "合":
        return this.he();
      case "冲":
        return this.chong();
      case "刑":
        return this.xing();
      case "害":
        return this.hai();
      default:
        return Phases.prototype.get.call(this, tag, is);
    }
  }

  /**
   * @description 地支克应
   * @param {TerrestrialBranches} phases
   * @returns
   */
  to(phases) {
    const tb = new TerrestrialBranches(phases);
    const result = [];
    if (this.he()[0].index === tb.index) result.push(0);
    if (this.chong().index === tb.index) result.push(1);
    if (this.xing()[0].index === tb.index || this.xing()[1] && this.xing()[1].index === tb.index) result.push(2);
    if (this.hai().index === tb.index) result.push(3);
    return result;
  }
  [inspect]() {
    return this.getValue();
  }
}
TerrestrialBranches.RELATION = Phases.RELATION;
TerrestrialBranches.CONNECTION = CONNECTION;
TerrestrialBranches.TERRESTRIAL_BRANCHES = TERRESTRIAL_BRANCHES;
TerrestrialBranches.TERRESTRIAL_BRANCHES_ARR = TERRESTRIAL_BRANCHES_ARR;
TerrestrialBranches.TB = TB;
TerrestrialBranches.TB_ARR = TB_ARR;
module.exports = TerrestrialBranches;