/*
 * @Description:
 * @Version: 1.0.0
 * @Author: lax
 * @Date: 2023-05-05 23:10:26
 * @LastEditors: lax
 * @LastEditTime: 2024-05-18 21:11:30
 */
const CONNECTION = require("./alias.js");
const {
  CELESTIAL_STEMS_ARR,
  CELESTIAL_STEMS,
  CS,
  CS_ARR
} = require("tao_name");
const {
  Phases
} = require("tao_taichi.js");
const inspect = Symbol.for("nodejs.util.inspect.custom");
/**
 * @class 天干
 */
class CelestialStems extends Phases {
  constructor(index) {
    if (index instanceof CelestialStems) return index;
    // 文字取序号，数字取周期后序列
    const i = ~~(index + 1) === 0 ? CELESTIAL_STEMS_ARR.indexOf(index) : ~~index % 10;
    if (i < 0) throw new Error("arg can`t be use");
    super((~~(i / 2) + 2 * ((~~(i / 2) + 1) % 2)) % 6, (i + 1) % 2);
    this.index = i;
  }
  getValue(is = false) {
    return is ? CELESTIAL_STEMS_ARR[this.index] : this.index;
  }

  // 合
  // 05/16/27/38/49
  combination() {
    const cs = new CelestialStems((this.index + 5) % 10);
    return cs;
  }
  he() {
    return this.combination();
  }

  // 冲
  // 06/17/38/49
  // 48/04/15
  conflict() {
    if (this.index !== 4 && this.index !== 5) return new CelestialStems((this.index + 6) % 12);
    return -1;
    // TODO 48、04、15
  }

  chong() {
    return this.conflict();
  }

  // 破
  break() {
    // TODO
  }
  get(tag, is) {
    switch (tag) {
      case "冲":
        return this.chong();
      case "合":
        return this.he();
      default:
        return Phases.prototype.get.call(this, tag, is);
    }
  }

  /**
   * @description 与天干克应
   * @param {CelestialStems} phases
   * @returns
   */
  to(phases) {
    const cs = new CelestialStems(phases);
    if (this.he().index === cs.index) return 0;
    if (this.chong().index === cs.index) return 1;
    return -1;
  }
  [inspect]() {
    return this.getValue();
  }
}
CelestialStems.RELATION = Phases.RELATION;
CelestialStems.CONNECTION = CONNECTION;
CelestialStems.CELESTIAL_STEMS_ARR = CELESTIAL_STEMS_ARR;
CelestialStems.CELESTIAL_STEMS = CELESTIAL_STEMS;
CelestialStems.CS_ARR = CS_ARR;
CelestialStems.CS = CS;
module.exports = CelestialStems;