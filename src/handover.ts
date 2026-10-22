/** 开图 handoverPack 的公开返回结构；只接收接口输出，不访问其工作区。 */
export interface HandoverPack {
  header: string;
  sections: { id: string; title: string; lines: string[]; defaultOn: boolean }[];
  footer: string;
  excluded: string;
}
export type LoadHandover = () => Promise<HandoverPack>;
export type ConnectHandover = (notify: (load?: LoadHandover) => void) => () => void;

export function composeRecent(pack: HandoverPack, include: string[]) {
  const selected = pack.sections.filter((section) => include.includes(section.id) && section.lines.length);
  return selected.length
    ? [
        pack.header,
        ...selected.map((section) => `## ${section.title}\n${section.lines.join("\n")}`),
        pack.footer,
      ].join("\n\n")
    : "";
}
