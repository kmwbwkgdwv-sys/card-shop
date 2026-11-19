import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
tot = 0
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    im = Image.open(os.path.join(src, f)).convert('RGBA')
    bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if bb:
        x0, y0, x1, y1 = bb; m = 10
        im = im.crop((max(0, x0 - m), max(0, y0 - m), min(im.width, x1 + m), min(im.height, y1 + m)))
    s = 420 / max(im.size)
    if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    name = f[1:-4] + '.webp'
    out = os.path.join(dst, name)
    im.save(out, 'WEBP', quality=86, method=4)
    tot += os.path.getsize(out)
print('files', len(os.listdir(dst)), 'total KB', tot // 1024)
