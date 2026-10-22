/*
 * @Description: 干支历
 * @Version: 1.0.0
 * @Author: lax
 * @Date: 2020-10-22 15:38:09
 * @LastEditors: lax
 * @LastEditTime: 2024-09-15 00:18:40
 */
const SexagenaryCycle = require("./SexagenaryCycle");
const Algorithm = require("../algorithm/SolarCalendar");

/**
 * 干支历时
 */
class Calendar {
  /**
   * constructor
   * @param {*} _obj 日期 可以是公历时间也可以是干支历
   * @param {*} origin 干支历的起始时间点
   * @param {*} type 类型 阳历/阴历/阴阳历
   * @param {*} algo 算法
   * @param {*} options 配置
   */
  constructor(_obj = new Date(), origin, type = 0, algo, options) {
    let obj = _obj;
    if (algo) this.algorithm = algo;

    // TODO 月份计算
    this.type = type;

    /**
     * 年干支
     * @type {SexagenaryCycle}
     */
    this.year;

    /**
     * 月干支
     * @type {SexagenaryCycle}
     */
    this.month;

    /**
     * 日干支
     * @type {SexagenaryCycle}
     */
    this.date;

    /**
     * 时干支
     * @type {SexagenaryCycle}
     */
    this.hour;

    /**
     * 时间
     * @type {Date}
     */
    this.time;

    /**
     * 地心黃经
     * @type {Number}
     */
    this.l;

    /**
     * 二十四节气
     * @type {Array[Date]}
     */
    this.during;
    if (typeof obj === "string") {
      obj = Array.from(obj.trim());
    }
    if (obj instanceof Date) {
      const [time, during, l] = this.algorithm(obj, origin, options);
      obj = time;
      this.time = time;
      this.during = during;
      this.l = l;
    }
    if (obj instanceof Array) {
      if (obj.length >= 8) {
        const [y, y_, m, m_, d, d_, h, h_] = obj;
        this.year = new SexagenaryCycle(y, y_);
        this.month = new SexagenaryCycle(m, m_);
        this.date = new SexagenaryCycle(d, d_);
        this.hour = new SexagenaryCycle(h, h_);
      } else if (obj.length === 4) {
        const [y, m, d, h] = obj;
        this.year = new SexagenaryCycle(y);
        this.month = new SexagenaryCycle(m);
        this.date = new SexagenaryCycle(d);
        this.hour = new SexagenaryCycle(h);
      } else {
        throw new Error(" array length error ");
      }
    }
  }

  /**
   * @description 获取干支历四柱
   * @param {boolean} is 是否显示汉字
   * @param {number} level 获取四柱级别 0-3 年->月->日->时
   * @param {boolean} focus 是否只显示指定的级别
   */
  sc(is = false, level = 3, focus = false) {
    return [this.year, this.month, this.date, this.hour].filter((cstb, i) => {
      if (focus) {
        if (i === level) return true;
      } else if (i <= level) return true;
      return false;
    }).map(cstb => {
      return cstb.cstb(is);
    });
  }
  static setAlgorithm(algo) {
    Calendar.prototype.algorithm = algo;
  }
}

// 设置初始算法
Calendar.prototype.algorithm = Algorithm;
module.exports = Calendar;