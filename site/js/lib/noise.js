// Value noise + fractal sum, seeded per page load.
const PERM = new Uint8Array(512);
(() => { const p = []; for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (Math.random()*(i+1))|0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i&255]; })();

const fade = t => t*t*t*(t*(t*6-15)+10);
export const lerp = (a, b, t) => a+(b-a)*t;
const hsh = (x, y, z) => PERM[(PERM[(PERM[x&255]+y)&255]+z)&255]/255;

function noise3(x, y, z) {
  const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi,u=fade(xf),v=fade(yf),w=fade(zf);
  return lerp(lerp(lerp(hsh(xi,yi,zi),hsh(xi+1,yi,zi),u),lerp(hsh(xi,yi+1,zi),hsh(xi+1,yi+1,zi),u),v),
              lerp(lerp(hsh(xi,yi,zi+1),hsh(xi+1,yi,zi+1),u),lerp(hsh(xi,yi+1,zi+1),hsh(xi+1,yi+1,zi+1),u),v),w);
}

export const fbm = (x, y, z) => 0.55*noise3(x,y,z)+0.30*noise3(x*2.1+7,y*2.1+3,z*1.3)+0.15*noise3(x*4.3+19,y*4.3+11,z*1.7);
