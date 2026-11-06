let counter = 0;

/** A short unique id. Time-ordered so ids created later sort later. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_679_616; // 36^4
  const time = Date.now().toString(36);
  const seq = counter.toString(36).padStart(4, '0');
  const rand = Math.floor(Math.random() * 1_679_616)
    .toString(36)
    .padStart(4, '0');
  return `${prefix}_${time}${seq}${rand}`;
}
