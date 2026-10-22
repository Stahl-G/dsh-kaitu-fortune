/*
 * @Description:
 * @Version: 1.0.0
 * @Author: lax
 * @Date: 2023-04-06 21:28:04
 * @LastEditors: lax
 * @LastEditTime: 2024-09-15 00:14:47
 */
const {
  SolarTerms,
  Ecliptic
} = require("solar_terms.js");
const {
  CELESTIAL_STEMS_ARR,
  SEXAGENARY_CYCLE_ARR
} = require("tao_name");
const calcMonth = require("./calcMonth");
const Julian = require("julian.js");
const reduceTimeOffset = require("./reduceTimeOffset");
/**
 * @description 转干支历
 * @param {date} date 公历时间
 * @param {date} o origin 干支历起点
 * @param {Object} p 配置
 */

function algorithm(_date, _o = new Date("-002696-10-14T00:00:00.000+08:00"), p = {}) {
  const date = new Date(_date);
  const o = new Date(_o);
  const accuracy = p.accuracy === undefined ? false : p.accuracy;

  // 干支纪年
  const year = date.getFullYear();
  let origin = o.getFullYear();
  let _year = year;
  let _origin = origin;
  if (_year < 0) _year = _year % 60 + 60;
  if (_origin < 0) _origin = _origin % 60 + 60;
  const options = Object.assign({}, p.solarTermsOptions, {
    year
  });
  const during = new SolarTerms(options).getSolarTermsAll();
  const start = during[2];
  // 修正至时区日期的对比
  let checkDate = date.getTime() - reduceTimeOffset(date);
  let checkStart = start.getTime() - reduceTimeOffset(start);
  checkDate = accuracy ? checkDate : ~~(checkDate / 86400000);
  checkStart = accuracy ? checkStart : ~~(checkStart / 86400000);
  if (checkDate < checkStart) _year -= 1;
  let diff = Math.abs(_year - _origin);
  const yIndex = diff % 60;

  /** 干支纪月
   * 甲己之年丙作首，乙庚之岁戊为头；
  /* 丙辛必定寻庚起，丁壬壬位顺行流；
  /* 更有戊癸何方觅，甲寅之上好追求。
  /* 05->2,16->4
  /* 27->6,38->8
  /* 49->0
   */

  // yIndex->yCS->mCS
  const mIndex = SEXAGENARY_CYCLE_ARR.indexOf(CELESTIAL_STEMS_ARR[(yIndex % 10 * 2 % 10 + 2) % 10] + "寅") + (calcMonth(date, during, accuracy) - 2);

  // 干支纪日
  let dDate = new Date(date.getTime() - reduceTimeOffset(date));
  let oDate = new Date(o.getTime() - reduceTimeOffset(o));
  dDate = Julian.$TD$JD(dDate);
  oDate = Julian.$TD$JD(oDate);
  const dF = dDate - ~~dDate;
  const oF = oDate - ~~oDate;
  dDate = dF < 0.5 ? ~~dDate - 0.5 : ~~dDate + 0.5;
  oDate = oF < 0.5 ? ~~oDate - 0.5 : ~~oDate + 0.5;
  let dIndex = (dDate - oDate) % 60;
  if (dIndex < 0) dIndex += 60;

  // 甲己还甲子，乙庚丙作初
  // 丙辛生戊子，丁壬庚子头
  // 戊癸起壬子，周而复始求
  // 05->0,16->2
  // 27->4,38->6
  // 49->8

  const hIndex = SEXAGENARY_CYCLE_ARR.indexOf(CELESTIAL_STEMS_ARR[dIndex % 10 * 2 % 10] + "子") + ~~((date.getHours() + 1) / 2) % 12;
  const jd = new Julian(date).getJD();
  let l = new Ecliptic(jd).getSunEclipticLongitude();
  return [[yIndex, mIndex, dIndex, hIndex], during, l];
}
module.exports = algorithm;