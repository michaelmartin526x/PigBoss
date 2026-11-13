import { LADDER_AWARDS, LADDER_LIMIT } from '../engine/ladder.js';

export function createWinLadder(root) {
  const ladder = document.createElement('section');
  ladder.id = 'win-ladder';
  ladder.setAttribute('aria-label', 'Collector ladder. 4 extra spins at 4 and 8 pigs; 10 at 12.');
  const frame = document.createElement('img');
  frame.src = 'assets/ladder/WinLadder.webp'; frame.alt = '';
  frame.className = 'ladder-frame'; ladder.append(frame);
  const slots = Array.from({length:LADDER_LIMIT}, (_,i) => {
    const image = document.createElement('img'); image.className = `ladder-token${LADDER_AWARDS[i+1]?' ladder-bonus':''}`;
    image.style.left = `${(10 + i * 55.5) / 684 * 100}%`;
    image.hidden = true; ladder.append(image); return image;
  });
  const notice = document.createElement('div'); notice.id = 'ladder-notice';
  notice.setAttribute('role','status'); notice.setAttribute('aria-live','polite');
  root.append(ladder, notice);
  let shown = 0, spin = null;
  function addTo(target) {
    let awarded = 0;
    while(shown < target) {
      const at = ++shown, bonus = LADDER_AWARDS[at], image = slots[at-1];
      image.src = `assets/ladder/WinLadder_${at===12?'Bonus2':bonus?'Bonus1':'Pig'}.webp`;
      image.alt = bonus ? `${bonus} extra free spins awarded at pig ${at}` : `Pig ${at}`;
      image.hidden = false;
      if(bonus) {
        awarded += bonus;
        notice.textContent = `+${bonus} FREE SPINS!`;
        notice.classList.remove('awarded'); void notice.offsetWidth; notice.classList.add('awarded');
      }
    }
    ladder.dataset.count = String(shown);
    return awarded;
  }
  return {
    reset() { shown=0; spin=null; slots.forEach(slot=>slot.hidden=true);
      notice.textContent=''; notice.classList.remove('awarded'); ladder.dataset.count='0'; },
    startSpin(record) { spin=record.ladder; notice.classList.remove('awarded'); },
    land(symbols) { return spin ? addTo(Math.min(spin.count, shown + symbols.filter(s=>s==='W').length)) : 0; },
    finishSpin() { if(spin)addTo(spin.count); spin=null; }
  };
}
