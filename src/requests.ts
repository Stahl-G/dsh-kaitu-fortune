import { type BirthInput, deleteAll, readBirth, saveBirth } from "./birth.js";
import { searchCities } from "./cities.js";

type Args = Record<string, unknown>;

export async function handle(dir: string, operation: string, args: Args): Promise<unknown> {
  switch (operation) {
    case "state":
      return { birth: readBirth(dir) ?? null };
    case "cities":
      return searchCities(String(args.query ?? ""));
    case "saveBirth":
      return saveBirth(dir, args.birth as BirthInput);
    case "deleteAll":
      deleteAll(dir);
      return { deleted: true };
    default:
      throw new Error(`未知操作：${operation}`);
  }
}
