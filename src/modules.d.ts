declare module "tz-lookup" {
  export default function tzlookup(lat: number, lng: number): string;
}
declare module "lunar-javascript" {
  interface Solar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
  }
  export const Lunar: { fromYmd(year: number, month: number, day: number): { getSolar(): Solar } };
}
