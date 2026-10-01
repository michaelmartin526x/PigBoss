// Atlas failure is global; individual missing/invalid skeletons are isolated.
export async function loadSkeletons(names, load, parse) {
  const data = new Map(), failures = [];
  await Promise.all(names.map(async name => {
    try { data.set(name, parse(await load(name))); }
    catch (error) { failures.push(`${name}: ${error?.message || error}`); }
  }));
  return { data, failures };
}
