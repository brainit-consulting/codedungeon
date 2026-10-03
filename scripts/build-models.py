"""Copy the dungeon's models from the downloaded packs into client/public, sized for an old laptop.

The packs (Quaternius, CC0) are downloaded once into H:\\codedungeon-home\\assets-src (see DOWNLOADS.md there). This
copies only the models listed below, shrinks every texture they use to 1024 px JPEG (the packs ship 2048 px PNG,
2-3.5 MB each), and points the .gltf files at the smaller images. The output is committed, so only adding or
changing models needs this script (and Python with Pillow):

    python scripts/build-models.py

Tiling surface textures for walls, floors and vaults go to client/public/textures, the same way.
"""

import json
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('DUNGEON_ASSETS_SRC') or os.path.join(os.path.dirname(ROOT), 'codedungeon-home', 'assets-src')
OUT = os.path.join(ROOT, 'client', 'public')
SIZE = 1024
QUALITY = 86

PACKS = {
    'props': os.path.join(SRC, 'Fantasy Props MegaKit[Standard]', 'Exports', 'glTF'),
    'village': os.path.join(SRC, 'Medieval Village MegaKit[Standard]', 'Medieval Village MegaKit[Standard]', 'glTF'),
}

# What the dungeon uses. Add a name here and re-run to bring another model in.
MODELS = {
    'props': [
        # light
        'Torch_Metal', 'Lantern_Wall', 'CandleStick', 'CandleStick_Triple', 'CandleStick_Stand', 'Candle_1', 'Candle_2', 'Chandelier',
        # the bar
        'Barrel', 'Barrel_Holder', 'Mug', 'Bottle_1', 'SmallBottle', 'SmallBottles_1', 'Shelf_Small_Bottles', 'Chalice', 'Table_Plate',
        'Table_Fork', 'Table_Knife', 'Pot_1', 'Pot_1_Lid', 'Cauldron', 'Bucket_Wooden_1', 'Vase_2', 'Vase_4',
        # furniture
        'Table_Large', 'Bench', 'Stool', 'Chair_1', 'Workbench', 'Workbench_Drawers', 'Bookcase_2', 'Cabinet', 'Nightstand_Shelf',
        'Shelf_Simple', 'Shelf_Arch', 'Peg_Rack', 'BookStand', 'WeaponStand',
        # clutter
        'Crate_Wooden', 'Crate_Metal', 'Chest_Wood', 'Book_Stack_1', 'Book_Stack_2', 'BookGroup_Medium_1', 'BookGroup_Small_1', 'Book_5',
        'Scroll_1', 'Scroll_2', 'Coin_Pile', 'Coin_Pile_2', 'Rope_1', 'Chain_Coil', 'Bag', 'Pouch_Large', 'Potion_1', 'Potion_2', 'Potion_4',
        'Key_Metal', 'Banner_1', 'Banner_2', 'Shield_Wooden', 'Sword_Bronze', 'Anvil', 'Whetstone', 'Cage_Small',
    ],
    'village': [
        'DoorFrame_Round_Brick', 'DoorFrame_Round_WoodDark', 'Door_1_Round', 'Door_2_Round', 'Wall_Arch', 'Prop_Support', 'Roof_Log',
        'Corner_Interior_Big', 'Prop_Crate', 'Prop_Chimney',
    ],
}

# Tiling textures for the stonework, from the village pack: name -> source images (base colour, normal, roughness).
SURFACES = {
    'flagstone': ('T_UnevenBrick_BaseColor', 'T_UnevenBrick_Normal', 'T_UnevenBrick_Roughness'),
    'brick': ('T_Brick_BaseColor', 'T_Brick_Normal', 'T_Brick_Roughness'),
    'plaster': ('T_Plaster_BaseColor', 'T_Plaster_Normal', None),
}


def shrink(src, dst):
    """src PNG -> dst JPEG at SIZE px (skipped when dst is already newer)."""
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return
    im = Image.open(src).convert('RGB')
    if max(im.size) > SIZE:
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=QUALITY, optimize=True)


def build_pack(pack):
    src_dir = PACKS[pack]
    out_dir = os.path.join(OUT, 'models', pack)
    os.makedirs(out_dir, exist_ok=True)
    for name in MODELS[pack]:
        path = os.path.join(src_dir, name + '.gltf')
        if not os.path.exists(path):
            sys.exit(f'missing model: {path}')
        with open(path, encoding='utf-8') as f:
            doc = json.load(f)
        for img in doc.get('images', []):
            uri = img['uri']
            if not uri.lower().endswith('.png'):
                continue
            jpg = uri[:-4] + '.jpg'
            shrink(os.path.join(src_dir, uri), os.path.join(out_dir, jpg))
            img['uri'] = jpg
            img['mimeType'] = 'image/jpeg'
        for buf in doc.get('buffers', []):
            shutil.copyfile(os.path.join(src_dir, buf['uri']), os.path.join(out_dir, buf['uri']))
        with open(os.path.join(out_dir, name + '.gltf'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, separators=(',', ':'))
    print(f'{pack}: {len(MODELS[pack])} models')


def build_surfaces():
    out_dir = os.path.join(OUT, 'textures')
    os.makedirs(out_dir, exist_ok=True)
    for name, maps in SURFACES.items():
        for kind, src in zip(('color', 'normal', 'rough'), maps):
            if src:
                shrink(os.path.join(PACKS['village'], src + '.png'), os.path.join(out_dir, f'{name}_{kind}.jpg'))
    print(f'surfaces: {len(SURFACES)}')


if __name__ == '__main__':
    for p in PACKS:
        build_pack(p)
    build_surfaces()
