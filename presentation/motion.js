export const wrap = (value, length) => ((value % length) + length) % length;

export function anticipationPlan(distance, velocity, cruiseMs, decelMs = 500) {
  const cruiseTravel = velocity * cruiseMs;
  const targetDistance = Math.ceil(distance + Math.max(7, cruiseTravel + 4, cruiseTravel + velocity * decelMs / 3));
  return { startDistance: distance, startVelocity: velocity, cruiseMs, decelMs, targetDistance };
}

export function anticipationDistance(plan, elapsed) {
  if (elapsed < plan.cruiseMs) return plan.startDistance + plan.startVelocity * elapsed;
  const u = Math.min(1, Math.max(0, (elapsed - plan.cruiseMs) / plan.decelMs));
  const from = plan.startDistance + plan.startVelocity * plan.cruiseMs;
  const travel = plan.targetDistance - from;
  // Hermite approach: continuous incoming velocity, zero final velocity, no reversal.
  const tangent = plan.startVelocity * plan.decelMs;
  return from + travel * (3 * u * u - 2 * u * u * u) + tangent * (u * u * u - 2 * u * u + u);
}

export function presentationStrip(real, start, targetDistance, targetSymbols) {
  const strip = real.slice(), center = wrap(start - targetDistance, strip.length);
  for (let r = 0; r < targetSymbols.length; r++) strip[wrap(center - 1 + r, strip.length)] = targetSymbols[r];
  return { strip, center };
}
