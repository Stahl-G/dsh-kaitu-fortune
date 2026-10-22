/*
 * @Description: 天干地支对象
 * @Version: 1.0.0
 * @Author: lax
 * @Date: 2020-10-22 20:15:13
 * @LastEditors: lax
 * @LastEditTime: 2024-07-13 23:24:46
 */
const CelestialStems = require("./CelestialStems");
const TerrestrialBranches = require("./TerrestrialBranches");
const {
  SEXAGENARY_CYCLE_ARR,
  SEXAGENARY_CYCLE,
  SC,
  SC_ARR
} = require("tao_name");
const inspect = Symbol.for("nodejs.util.inspect.custom");
/**
 * 天干地支对象
 */
class SexagenaryCycle {
  constructor(...num) {
    /**
     * 天干序号 0~9
     * @type {CelestialStems}
     */
    this.x;
    /**
     * 地支序号 0~11
     * @type {TerrestrialBranches}
     */
    this.y;
    /**
     * 干支序号 0~59
     * @type {number}
     */
    this.index;
    if (num.length === 1) this.#generateByOne(num[0]);
    if (num.length >= 2) this.#generateByTwo(num[0], num[1]);
  }

  /**
   * 天干序列 Celestial Stems->0-9
   * @param {boolean} is
   * @returns 名称/序号
   */
  cs(is = false) {
    return is ? this.x.getValue(true) : this.x;
  }

  /**
   * 地支序列 Terrestrial Branches->0-11
   * @param {boolean} is
   * @returns 名称/序号
   */
  tb(is = false) {
    return is ? this.y.getValue(true) : this.y;
  }

  /**
   * 天干地支序列 0-59
   * @param {boolean} is
   * @returns 名称/序号
   */
  cstb(is = false) {
    return is ? this.cs(is) + this.tb(is) : this.index;
  }

  /**
   * 获得旬首
   * @returns {SexagenaryCycle} sexagenaryCycle
   */
  getLead() {
    const index = ~~(this.index / 10) * 10;
    return new SexagenaryCycle(index);
  }

  // 天干地支对应的序列

  /*
  	x:0		x:1		x:2		x:3 	x:4 	x:5 	x:6 	x:7 	x:8 	x:9
  	0 00/00		01/00	02/00	03/00	04/00	05/00	06/00	07/00	08/00	09/00	
  	1 10/10		11/10	00/-2	01/-2	02/-2	03/-2	04/-2	05/-2	06/-2	07/-2
  	2 08/08		09/08	10/08	11/08	00/-4	01/-4	02/-4	03/-4	04/-4	05/-4
  	3 06/06		07/06	08/06	09/06	10/06	11/06	00/-6	01/-6	02/-6	03/-6
  	4 04/04		05/04	06/04	07/04	08/04	09/04	10/04	11/04	00/-8	01/-8
  	5 02/02		03/02	04/02	05/02	06/02	07/02	08/02	09/02	10/02	11/02
  */
  /**
   * 获取对应的干支序号
   * @param {*} x 天干
   * @param {*} y 地支
   * @returns {Number} 干支序号
   */
  #getIndex(x = this.x, y = this.y) {
    // 0/0  0/10 0/8  0/6  0/4  0/2
    // 1/1  1/11 1/9  1/7  1/5  1/3
    // 2/2  2/0  2/10 2/8  2/6  2/4
    // 3/3  3/1  3/11 3/9  3/7  3/5
    // 4/4  4/2  4/0  4/10 4/8  4/6
    // 5/5  5/3  5/1  5/11 5/9  5/7
    // 6/6  6/4  6/2  6/0  6/10 6/8
    // 7/7  7/5  7/3  7/1  7/11 7/9
    // 8/8  8/6  8/4  8/2  8/0  8/10
    // 9/9  9/7  9/5  9/3  9/1  9/11
    if (x === -1 || y === -1 || x % 2 === 0 !== (y % 2 === 0)) throw new Error(`can\`t use this arg by x:${x} y:${y}`);

    // 干支相差之数（负按12转正）/2 = 6-干支十位数值
    const difference = y.getValue() - x.getValue();
    // todo bug
    const index = (difference + 12) % 12 / 2;
    const tensPlace = (6 - index) % 6;
    return tensPlace * 10 + x.getValue();
  }

  /**
   * 根据一个序列获取干支
   * @param {*} arg 参数
   */
  #getByIndex(_arg) {
    // 参数为数 取值范围0-59
    const arg = Math.abs(_arg % 60);
    // result-> 0-9 -> celestialStems.index
    const x = arg % 10;
    // result-> 0-11 -> terrestrialBranches.index
    const y = arg % 12;
    // result-> 0-59
    this.#generateByCSAndTB(x, y);
    this.index = arg;
  }
  #generateByOne(_arg) {
    let arg = _arg;
    if (arg instanceof SexagenaryCycle) return arg;
    if (typeof arg === "string") {
      if (~~(arg + 1)) {
        // 转数字处理
        arg = ~~arg;
      } else if (arg.length === 2) {
        // 转数组处理
        arg = Array.from(arg);
      } else {
        throw new Error(`array length must be equals two`);
      }
    }
    if (typeof arg === "number") {
      this.#getByIndex(arg);
      return;
    }
    if (arg instanceof Array) {
      this.#generateByTwo(arg[0], arg[1]);
      return;
    }
    if (typeof arg === "object") {
      // 将key,value的对象转为基本对象
      const {
        x,
        y
      } = Object.fromEntries(Object.entries(arg));
      this.#generateByTwo(x, y);
      return;
    }
    throw new Error("this arg can't to use");
  }
  #generateByTwo(x, y) {
    this.#generateByCSAndTB(x, y);
    this.index = this.#getIndex();
  }

  /** 根据天干地支对象生成 */
  #generateByCSAndTB(x, y) {
    this.x = new CelestialStems(x);
    this.y = new TerrestrialBranches(y);
  }
  [inspect]() {
    return this.cstb();
  }
}
SexagenaryCycle.SEXAGENARY_CYCLE_ARR = SEXAGENARY_CYCLE_ARR;
SexagenaryCycle.SEXAGENARY_CYCLE = SEXAGENARY_CYCLE;
SexagenaryCycle.SC = SC;
SexagenaryCycle.SC_ARR = SC_ARR;
module.exports = SexagenaryCycle;