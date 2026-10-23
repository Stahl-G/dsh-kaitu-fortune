export type Propose = (title: string, readingId: string, due?: string) => Promise<void>;
export type ConnectTasks = (notify: (propose?: Propose) => void) => () => void;

/** 旧宿主的远程描述没有此方法时，不提供入口。 */
export function taskProposer(remote: {
  proposeTask?: (input: { title: string; source: string; due?: string }) => Promise<
    { ok: true; value: { id: string } } | { ok: false; error: { message: string } }
  >;
}): Propose | undefined {
  if (typeof remote.proposeTask !== "function") return;
  const send = remote.proposeTask.bind(remote);
  return async (title, readingId, due) => {
    const result = await send({
      title: title.trim(),
      source: readingId,
      ...(due ? { due } : {}),
    });
    if (!result.ok) throw new Error(result.error.message);
  };
}
