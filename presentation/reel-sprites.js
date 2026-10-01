// Every moving slot owns one small canvas. Repainting from decoded, strongly
// retained images is synchronous; changing an <img>.src is not.
export async function loadReelSprites(symbols, { loadImage = decodeImage } = {}) {
  const sharp = new Map(), blurred = new Map();
  await Promise.all([...symbols].map(async symbol => {
    const [normal, blur] = await Promise.all([
      loadImage(`assets/${symbol}.png`),
      loadImage(`assets/blur/${symbol}_blur.png`).catch(() => null),
    ]);
    sharp.set(symbol, normal);
    blurred.set(symbol, blur || normal);
  }));
  const drawn = new WeakMap();
  return {
    draw(canvas, symbol, blur = false, matchingPose = null) {
      const image = blur ? blurred.get(symbol) : matchingPose || sharp.get(symbol);
      if (!image) throw new Error(`Reel artwork unavailable: ${symbol}`);
      if (drawn.get(canvas) !== image) {
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        drawn.set(canvas, image);
      }
      canvas.dataset.symbol = symbol;
      canvas.dataset.presentation = blur ? 'blur' : 'sharp';
    },
  };
}

async function decodeImage(src) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}
