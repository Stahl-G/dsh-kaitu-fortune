// 从 Wikimedia 原图重新生成 data/tarot/*.jpg 和 data/tarot/sources.json。
// 每张图查文件页的作者和许可标注一起记下；缩放用 macOS 自带的 sips，缩到 420 像素高。
// 用法：node scripts/fetch-tarot.mjs（需要能连上 commons.wikimedia.org）
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../data/tarot/", import.meta.url));
const agent = { "User-Agent": "kaitu-fortune/0.1 (https://github.com/Stahl-G/dsh-kaitu-fortune)" };
const MAJOR =
  "Fool Magician High_Priestess Empress Emperor Hierophant Lovers Chariot Strength Hermit Wheel_of_Fortune Justice Hanged_Man Death Temperance Devil Tower Star Moon Sun Judgement World".split(
    " ",
  );
const SUITS = { wands: "Wands", cups: "Cups", swords: "Swords", pentacles: "Pents" };
const pad = (n) => String(n).padStart(2, "0");
const cards = [
  ...MAJOR.map((name, n) => [`major-${pad(n)}.jpg`, `RWS_Tarot_${pad(n)}_${name}.jpg`]),
  ...Object.entries(SUITS).flatMap(([suit, prefix]) =>
    Array.from({ length: 14 }, (_, i) => [`${suit}-${pad(i + 1)}.jpg`, `${prefix}${pad(i + 1)}.jpg`]),
  ),
];

const sources = [];
// 大牌有一部分只在英文维基百科本地，不在 Commons；两处都查
for (const [file, original] of cards) {
  let info;
  for (const host of ["commons.wikimedia.org", "en.wikipedia.org"]) {
    const api = `https://${host}/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&titles=File:${original}`;
    const page = Object.values((await (await fetch(api, { headers: agent })).json()).query.pages)[0];
    if (page.imageinfo) {
      info = { host, ...page.imageinfo[0] };
      break;
    }
  }
  const meta = (key) => info.extmetadata[key]?.value.replace(/<[^>]+>/g, "").trim();
  const out = resolve(dir, file);
  writeFileSync(out, Buffer.from(await (await fetch(info.url, { headers: agent })).arrayBuffer()));
  execFileSync("sips", ["--resampleHeight", "420", "-s", "formatOptions", "85", out], { stdio: "ignore" });
  sources.push({
    file,
    original,
    page: info.descriptionurl,
    download: info.url,
    artist: meta("Artist"),
    license: meta("LicenseShortName"),
    sha256: createHash("sha256").update(readFileSync(out)).digest("hex"),
  });
  console.log(file, info.host, meta("LicenseShortName"));
}
writeFileSync(resolve(dir, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`);
