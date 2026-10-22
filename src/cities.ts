import { readFileSync } from "node:fs";
import tzlookup from "tz-lookup";

/** 开图的城市库（GeoNames cities15000）。时区表里没有，按经纬度推。 */
export interface City {
  geonameid: number;
  name: string;
  zh: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
}
type Row = [number, string, string, string[], string, string, number, number, number];
interface Entry {
  row: Row;
  aliases: string[];
}

let table: Entry[] | undefined;
const entries = () => {
  if (!table) {
    const { rows } = JSON.parse(readFileSync(new URL("../data/cities.json", import.meta.url), "utf8")) as {
      rows: Row[];
    };
    rows.sort((a, b) => b[8] - a[8]);
    table = rows.map((row) => ({
      row,
      aliases: [...row[3], row[1], row[2]].map((alias) => alias.toLowerCase()),
    }));
  }
  return table;
};

const city = ([geonameid, name, , zh, country, , lat, lng]: Row): City => ({
  geonameid,
  name,
  zh: zh.find((alias) => /^[一-鿿]+$/.test(alias)) ?? name,
  country,
  lat,
  lng,
  timezone: tzlookup(lat, lng),
});

/** 先给完全同名的，再给开头相同的，同档按人口排；“北京市”也能搜到北京。 */
export function searchCities(query: string, limit = 8): City[] {
  const term = query.trim().toLowerCase().replace(/市$/, "");
  if (!term) return [];
  const exact: Row[] = [];
  const prefix: Row[] = [];
  for (const { row, aliases } of entries()) {
    if (aliases.some((alias) => alias === term || alias === `${term}市`)) exact.push(row);
    else if (prefix.length < limit && aliases.some((alias) => alias.startsWith(term))) prefix.push(row);
  }
  return [...exact, ...prefix].slice(0, limit).map(city);
}

export function cityById(geonameid: number): City {
  const entry = entries().find(({ row }) => row[0] === geonameid);
  if (!entry) throw new Error("城市库里没有这个城市");
  return city(entry.row);
}
