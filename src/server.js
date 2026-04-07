import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import LRU from 'lru-cache';

const PORT = process.env.PORT || 8000;
const API_KEY = process.env.API_KEY || 'changeme';
const DATA_DIR = process.env.DATA_DIR || '/data';
const BG_DIR = path.join(DATA_DIR, 'backgrounds');
const SLOT_DIR = path.join(DATA_DIR, 'slots');

const THRESH_DIFF = Number(process.env.THRESH_DIFF || 40);     // per-pixel abs diff sum threshold
const THRESH_PIXELS = Number(process.env.THRESH_PIXELS || 300); // pixels over THRESH_DIFF to call occupied

// Ensure data dirs
for (const d of [BG_DIR, SLOT_DIR]) fs.mkdirSync(d, { recursive: true });

const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// Simple API key auth middleware
app.use((req,res,next)=>{
  if (req.path === '/health') return next();
  const key = req.header('X-API-Key');
  if (!key || key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// Caches
const bgCache = new LRU({ max: 64 });       // cam_id -> {data,width,height}
const maskCache = new LRU({ max: 256 });    // cam_id#slotId -> Uint8Array mask

const loadBackground = async (camId) => {
  const cacheKey = camId;
  const cached = bgCache.get(cacheKey);
  if (cached) return cached;
  const p = path.join(BG_DIR, `${camId}.jpg`);
  if (!fs.existsSync(p)) throw new Error(`Background not found: ${p}`);

  const img = sharp(p);
  const { data, info } = await img.raw().ensureAlpha(false).toBuffer({ resolveWithObject: true });
  const bg = { data, width: info.width, height: info.height, channels: info.channels };
  bgCache.set(cacheKey, bg);
  return bg;
};

const loadSlots = (camId) => {
  const p = path.join(SLOT_DIR, `${camId}.json`);
  if (!fs.existsSync(p)) throw new Error(`Slots not found: ${p}`);
  const txt = fs.readFileSync(p, 'utf8');
  const arr = JSON.parse(txt);
  return arr;
};

const rasterizePolygon = (width, height, points) => {
  // returns Uint8Array mask (0/1) for polygon
  const mask = new Uint8Array(width * height);
  // Ray casting algorithm for point-in-polygon (opt: bounding box first)
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  for (const [x,y] of points){ if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y; }
  minX = Math.max(Math.floor(minX), 0);
  minY = Math.max(Math.floor(minY), 0);
  maxX = Math.min(Math.ceil(maxX), width-1);
  maxY = Math.min(Math.ceil(maxY), height-1);

  const inside = (x,y)=>{
    let c = false;
    for (let i=0,j=points.length-1; i<points.length; j=i++) {
      const xi=points[i][0], yi=points[i][1];
      const xj=points[j][0], yj=points[j][1];
      const intersect = ((yi>y)!=(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi+1e-9) + xi);
      if (intersect) c = !c;
    }
    return c;
  };
  for (let y=minY; y<=maxY; y++){
    for (let x=minX; x<=maxX; x++){
      if (inside(x+0.5, y+0.5)) mask[y*width + x] = 1;
    }
  }
  return mask;
};

const getMask = (camId, slotId, width, height, points) => {
  const key = `${camId}#${slotId}#${width}x${height}`;
  const cached = maskCache.get(key);
  if (cached) return cached;
  const m = rasterizePolygon(width, height, points);
  maskCache.set(key, m);
  return m;
};

app.get('/health', (req,res)=> res.json({ ok: true }));

app.post('/process', upload.single('snapshot'), async (req,res)=>{
  try{
    const t0 = Date.now();
    const camId = req.query.cam_id;
    if (!camId) return res.status(400).json({ error: 'Missing cam_id' });
    if (!req.file) return res.status(400).json({ error: 'Missing snapshot file' });

    // Load background (raw)
    const bg = await loadBackground(camId);
    // Decode snapshot and resize to bg size if needed
    let snapSharp = sharp(req.file.buffer);
    const meta = await snapSharp.metadata();
    if (meta.width !== bg.width || meta.height !== bg.height){
      snapSharp = snapSharp.resize(bg.width, bg.height, { fit: 'fill' });
    }
    const { data: snapData, info: snapInfo } = await snapSharp.raw().ensureAlpha(false).toBuffer({ resolveWithObject: true });
    const width = snapInfo.width, height = snapInfo.height, ch = snapInfo.channels;

    // Load slots
    const slots = loadSlots(camId);

    // Diff evaluation
    const result = {};
    let occupied = 0;
    for (const slot of slots){
      const id = slot.id;
      const pts = slot.points;
      const mask = getMask(camId, id, width, height, pts);

      let score = 0;
      // Iterate bounding box for speed
      for (let y=0; y<height; y++){
        let idx = y*width;
        for (let x=0; x<width; x++, idx++){
          if (!mask[idx]) continue;
          const p = idx*ch;
          const d = Math.abs(snapData[p] - bg.data[p]) + Math.abs(snapData[p+1]-bg.data[p+1]) + Math.abs(snapData[p+2]-bg.data[p+2]);
          if (d > THRESH_DIFF) score++;
        }
      }
      const occ = score > THRESH_PIXELS ? 1 : 0;
      result[id] = occ;
      occupied += occ;
    }

    res.json({
      cam_id: camId,
      width, height,
      occupied,
      free: Object.keys(result).length - occupied,
      slots: result,
      took_ms: Date.now() - t0
    });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, ()=> console.log(`Parking processor listening on :${PORT}`));
