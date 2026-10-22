/*
 * @Description:
 * @Version: 1.0.0
 * @Author: lax
 * @Date: 2023-05-06 13:01:41
 * @LastEditors: lax
 * @LastEditTime: 2024-05-18 21:05:41
 */
const TaiChi = require("./TaiChi.js");
const {
  PHASES_ARR,
  PHASES,
  RELATION
} = require("tao_name");
const SEQUENCE = ["金", "水", "木", "火", "土"];
/**
 * 《尚书.洪范》：五行：一曰水，二曰火，三曰木，四曰金，五曰土。
 * 水曰润下，火曰炎上，木曰曲直，金曰从革，土爰稼穑。
 * 润下作咸，炎上作苦，曲直作酸，从革作辛，稼穑作甘。
 * 固五行之序按水火木金土
 */
class Phases extends TaiChi {
  constructor(phases, logos) {
    if (typeof phases === "object" && phases instanceof Phases) return phases;
    super(logos);

    /**
     * 五行序列
     * @description 0~4->水火木金土
     */
    this.phases = ~~(phases + 1) === 0 ? PHASES_ARR.indexOf(phases) : ~~phases % 5;
    if (this.phases < 0) throw new Error(`该参数不可用/this arg can\`t be use =>${phases}`);

    /**
     * 生克序列
     * @description 0~4->金水木火土
     */
    this.round = SEQUENCE.indexOf(PHASES_ARR[this.phases]);
  }

  /**
   * 获取五行
   * @param {boolean} is 是否文字
   * @returns
   */
  getPhases(is = false) {
    return is ? PHASES_ARR[this.phases] : this.phases;
  }

  /**
   * @description 与另一五行的生克关系
   * @param {Phases} another
   * @returns
   */
  with(another) {
    const ano = new Phases(another);
    const phases = ano.phases;
    // 同我者
    if (this.phases === phases) return 0;
    // 我生者
    if (this.promotion() === phases) return 1;
    // 生我者
    if (this.promoted() === phases) return 2;
    // 克我者
    if (this.restrained() === phases) return 3;
    // 我克者
    if (this.restraint() === phases) return 4;
    throw new Error(`arg can\`t be use =>${another}`);
  }

  // 我生者/相生
  promotion(is = false) {
    const index = (this.round + 1) % 5;
    return is ? SEQUENCE[index] : PHASES_ARR.indexOf(SEQUENCE[index]);
  }

  // 相生
  sheng(is) {
    return this.promotion(is);
  }

  // 生我者/相泄
  promoted(is = false) {
    const index = (this.round - 1 + 5) % 5;
    return is ? SEQUENCE[index] : PHASES_ARR.indexOf(SEQUENCE[index]);
  }

  // 相泄
  xie(is) {
    return this.promoted(is);
  }

  // 我克者/相克
  restraint(is = false) {
    const index = (this.round + 2) % 5;
    return is ? SEQUENCE[index] : PHASES_ARR.indexOf(SEQUENCE[index]);
  }

  // 相克
  ke(is) {
    return this.restraint(is);
  }

  // 克我者/相耗
  restrained(is = false) {
    const index = (this.round - 2 + 5) % 5;
    return is ? SEQUENCE[index] : PHASES_ARR.indexOf(SEQUENCE[index]);
  }

  // 相耗
  hao(is) {
    return this.restrained(is);
  }

  // 同我者旺
  vigorous(is) {
    return this.getPhases(is);
  }

  // 旺
  wang(is) {
    return this.vigorous(is);
  }

  // 我生者相
  second(is) {
    return this.promotion(is);
  }

  // 相
  xiang(is) {
    return this.second(is);
  }

  // 生我者休
  rest(is) {
    return this.promoted(is);
  }

  // 休
  xiu(is) {
    return this.rest(is);
  }

  // 克我者囚
  imprison(is) {
    return this.restrained(is);
  }

  // 囚
  qiu(is) {
    return this.imprison(is);
  }

  // 我克者死
  death(is) {
    return this.restraint(is);
  }

  // 死
  si(is) {
    return this.death(is);
  }
  get(tag, is = false) {
    switch (tag) {
      case "旺":
        return this.wang(is);
      case "相":
        return this.xiang(is);
      case "休":
        return this.xiu(is);
      case "囚":
        return this.qiu(is);
      case "死":
        return this.si(is);
      case "生":
        return this.sheng(is);
      case "泄":
        return this.xie(is);
      case "耗":
        return this.hao(is);
      case "克":
        return this.ke(is);
      default:
        throw new Error("this tag must be in [旺相休囚死生泄耗克]");
    }
  }
}
Phases.RELATION = RELATION;
Phases.PHASES = PHASES;
module.exports = Phases;