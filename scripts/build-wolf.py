"""Build the great hall's wolf from the CC0 Quaternius Ultimate Animated Animal Pack, in Blender (5.x), headless.

Takes Wolf.blend (it keeps the pack's leg IK, which makes posing him lying down easy), gives him a hinged jaw (the
mouth is cut along its lip line and lined with a dark mouth), eyelids (each eye gets a bone that squashes it shut),
and the clips he needs by the hearth, keyed here on the IK rig: lying asleep, lying with his head up, a lying yawn,
getting up, a stretch with a yawn, lying down. The pack's Idle and Walk are kept for standing and turning round;
the rest of its clips are dropped. No textures (the pack is flat colours). He faces +Z, about 2.3 m nose to tail tip.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python scripts/build-wolf.py

Writes client/public/characters/wolf.glb. Optional env: DUNGEON_ASSETS_SRC (the packs), PREVIEW=<folder> (renders
each pose there instead of exporting).
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('DUNGEON_ASSETS_SRC') or os.path.join(os.path.dirname(ROOT), 'codedungeon-home', 'assets-src')
BLEND = os.path.join(SRC, 'Ultimate Animated Animals', 'Wolf.blend')
OUT = os.path.join(ROOT, 'client', 'public', 'characters')
PREVIEW = os.environ.get('PREVIEW')

FPS = 30
# The pack's units are about two and a half to the metre; the export scales him (in the root node) to a big grey wolf.
SCALE = 0.42
KEEP = ['Idle', 'Walk']
CLIPS = ['Lie_Sleep', 'Lie_HeadUp', 'Lie_Yawn', 'Stand_Up', 'Stretch_Yawn', 'Lie_Down']
# Colours from the pack's own glTF (linear), plus the inside of his mouth.
COLOURS = {
    'Main': (0.184, 0.19, 0.168),
    'Nose': (0.027, 0.027, 0.027),
    'Main_Light': (0.364, 0.376, 0.332),
    'Eyes_Black': (0.009, 0.009, 0.009),
    'Mouth': (0.09, 0.025, 0.022),
}
# The lip line, one side, from the corner of the mouth to the middle under the nose (vertex indices in Wolf.blend,
# checked against their positions below).
LIP = [(31, (0.249, -2.093, 2.046)), (112, (0.161, -2.185, 2.031)), (39, (0.121, -2.321, 2.002)), (116, (0.109, -2.44, 1.974)),
       (38, (0.062, -2.479, 1.964)), (937, (0.0, -2.479, 1.964))]


# ---------- loading ----------

def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    with bpy.data.libraries.load(BLEND, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n in ('AnimalArmature', 'Wolf')]
        dst.actions = [n for n in src.actions if n in KEEP]
    scene = bpy.context.scene
    for o in dst.objects:
        scene.collection.objects.link(o)
    scene.render.fps = FPS
    arm = bpy.data.objects['AnimalArmature']
    mesh = bpy.data.objects['Wolf']
    ad = arm.animation_data_create()
    ad.action = None
    # the pack keeps its clips on NLA tracks, which would pose him over ours
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return arm, mesh


def materials(mesh):
    """Plain node materials in the pack's colours (the 2.79 ones carry no node tree)."""
    for i, m in enumerate(mesh.data.materials):
        name = m.name
        m.name = name + '_279'
        new = bpy.data.materials.new(name)
        new.use_nodes = True
        bsdf = new.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (*COLOURS[name], 1)
        bsdf.inputs['Roughness'].default_value = 0.4 if name in ('Nose', 'Eyes_Black') else 0.9
        mesh.data.materials[i] = new
    mouth = bpy.data.materials.new('Mouth')
    mouth.use_nodes = True
    mouth.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*COLOURS['Mouth'], 1)
    mouth.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.6
    mesh.data.materials.append(mouth)
    return len(mesh.data.materials) - 1


# ---------- the jaw and the eyelids ----------

def lip_z(y):
    """Height of the lip line at depth y (the line is the same both sides)."""
    pts = sorted((p[1], p[2]) for _, p in LIP)
    if y <= pts[0][0]:
        return pts[0][1]
    for (y0, z0), (y1, z1) in zip(pts, pts[1:]):
        if y0 <= y <= y1:
            return z0 + (z1 - z0) * (y - y0) / (y1 - y0)
    return pts[-1][1]


def cut_mouth(mesh, mouth_mat):
    """Split the mesh along the lip line and line the gap with mouth faces, which have no area until the jaw opens."""
    me = mesh.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    right = []
    for i, p in LIP:
        v = bm.verts[i]
        assert (v.co - Vector(p)).length < 2e-3, f'lip vertex {i} moved: {tuple(v.co)}'
        right.append(v)

    def mirror(v):
        if abs(v.co.x) < 1e-4:
            return v
        want = Vector((-v.co.x, v.co.y, v.co.z))
        return min(bm.verts, key=lambda o: (o.co - want).length)

    left = [mirror(v) for v in right]
    chain = right + list(reversed(left[:-1]))  # corner, ..., middle, ..., other corner
    edges = []
    for a, b in zip(chain, chain[1:]):
        e = bm.edges.get((a, b))
        assert e, 'lip line broken'
        edges.append(e)
    positions = [v.co.copy() for v in chain]
    bmesh.ops.split_edges(bm, edges=edges)
    bm.verts.ensure_lookup_table()

    def copies(p):
        return [v for v in bm.verts if (v.co - p).length < 1e-5]

    def lower_first(vs):
        def below(v):
            fs = list(v.link_faces)
            return sum(f.calc_center_median().z for f in fs) / max(1, len(fs))
        return sorted(vs, key=below)

    pairs = []
    for p in positions:
        vs = copies(p)
        vs = lower_first(vs)
        pairs.append((vs[-1], vs[0]))  # (upper, lower); the corners stay one vertex
    centre = Vector((0, -2.25, 2.0))
    for (ua, la), (ub, lb) in zip(pairs, pairs[1:]):
        quad = [ua, ub, lb, la]
        uniq = []
        for v in quad:
            if v not in uniq:
                uniq.append(v)
        f = bm.faces.new(uniq)
        f.material_index = mouth_mat
        f.normal_update()
        # facing out of the mouth (the lip line runs round the muzzle, so "out" is away from its middle line)
        if f.normal.dot(f.calc_center_median() - Vector((0, f.calc_center_median().y, centre.z))) < 0:
            f.normal_flip()
    bm.verts.index_update()
    lower = {lo.index for up, lo in pairs if lo is not up}
    bm.to_mesh(me)
    bm.free()
    return lower


def add_bones(arm, mesh):
    """Jaw (hinged under the ear, along the lower jaw) and one lid bone per eye, pointing up, all on the head."""
    eye_mats = [i for i, m in enumerate(mesh.data.materials) if m.name == 'Eyes_Black']
    eyes = {'L': set(), 'R': set()}
    for p in mesh.data.polygons:
        if p.material_index in eye_mats:
            side = 'L' if p.center.x > 0 else 'R'
            eyes[side].update(p.vertices)
    centres = {s: sum((mesh.data.vertices[i].co for i in vs), Vector()) / len(vs) for s, vs in eyes.items()}
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    head = eb['Head']
    jaw = eb.new('Jaw')
    jaw.head = (0, -2.08, 2.0)
    jaw.tail = (0, -2.45, 1.94)
    jaw.roll = 0
    jaw.parent = head
    for s, c in centres.items():
        b = eb.new(f'Eye.{s}')
        b.head = c
        b.tail = c + Vector((0, 0, 0.08))
        b.roll = 0
        b.parent = head
    bpy.ops.object.mode_set(mode='OBJECT')
    return eyes


def weigh(mesh, lower, eyes):
    """The lower jaw follows Jaw (half way at the back of the mouth); each eye follows its lid bone."""
    vg = mesh.vertex_groups
    head = vg['Head'].index
    jaw = vg.new(name='Jaw')
    lids = {s: vg.new(name=f'Eye.{s}') for s in eyes}

    def give(v, group, f):
        """Hand fraction f of the vertex's Head weight to `group` (its weights on the neck stay as they are)."""
        for g in v.groups:
            if g.group == head:
                moved = g.weight * f
                g.weight -= moved
                group.add([v.index], moved, 'ADD')

    for v in mesh.data.vertices:
        c = v.co
        if v.index in lower:
            give(v, jaw, 1.0)
        elif c.y < -2.05 and abs(c.x) < 0.27 and 1.6 < c.z < lip_z(c.y) - 1e-3:
            give(v, jaw, 1.0 if c.y < -2.15 else 0.5)
    for s, vs in eyes.items():
        for i in vs:
            give(mesh.data.vertices[i], lids[s], 1.0)
    # a few of the pack's weights are a hair over 1 (Blender reports the mesh as invalid)
    for v in mesh.data.vertices:
        for g in v.groups:
            g.weight = min(g.weight, 1.0)


# ---------- posing ----------

def bone(arm, name):
    return arm.pose.bones[name]


def reset(arm):
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)


def turn(arm, name, axis, deg):
    """Turn a bone about an armature axis ('x' left, 'y' back, 'z' up), as seen from its rest pose."""
    pb = bone(arm, name)
    a = (pb.bone.matrix_local.to_3x3().inverted() @ Vector({'x': (1, 0, 0), 'y': (0, 1, 0), 'z': (0, 0, 1)}[axis])).normalized()
    pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion(a, math.radians(deg))


def shift(arm, name, d):
    pb = bone(arm, name)
    pb.location = pb.location + pb.bone.matrix_local.to_3x3().inverted() @ Vector(d)


def both(fn, arm, name, *args):
    for s in ('L', 'R'):
        fn(arm, f'{name}.{s}', *args)


def mirror_x(d, s):
    return (d[0] if s == 'L' else -d[0], d[1], d[2])


def lie(arm, head_up=0.0, yawn=0.0, eyes_shut=1.0):
    """Lying on his belly, front legs out, hind legs folded beside him, tail round his flank; head on his paws
    (head_up 0) or held up and looking ahead (head_up 1)."""
    reset(arm)
    shift(arm, 'Body', (0, 0.05, -1.12))
    turn(arm, 'Torso', 'x', 4)
    for s in ('L', 'R'):
        # front legs out in front of his chest, forearms and paws flat on the floor
        shift(arm, f'IKFrontLeg.{s}', mirror_x((-0.03, -0.95, -0.15), s))
        turn(arm, f'IKFrontLeg.{s}', 'x', -45)
        turn(arm, f'FF.{s}', 'x', 45)
        # hind legs folded beside him: the knee out by his belly, the hock back by his rump, the foot flat
        shift(arm, f'IKBackLeg.{s}', mirror_x((0.16, -0.27, -0.13), s))
        shift(arm, f'PoleTargetBack.{s}', mirror_x((1.5, -3.0, -2.0), s))
        turn(arm, f'IKBackLeg.{s}', 'x', -43)
        turn(arm, f'FFB.{s}', 'x', 43)
        turn(arm, f'Ear1.{s}', 'x', -12 + 14 * head_up)
    # neck down and his chin on his paws, or his head up and looking ahead
    down = 1 - head_up
    turn(arm, 'Torso3', 'x', 8 * down)
    turn(arm, 'Neck1', 'x', 16 * down - 8 * head_up)
    turn(arm, 'Neck2', 'x', 8 * down - 6 * head_up)
    turn(arm, 'Neck3', 'x', 6 * down - 4 * head_up)
    turn(arm, 'Head', 'x', -40 * down + 6 * head_up - 30 * yawn)
    # the tail drops to the floor and curls forward round his right flank
    turn(arm, 'Tail1', 'x', -48)
    for i, (pitch, yaw) in enumerate([(14, -16), (10, -24), (6, -28), (2, -30), (0, -30), (0, -28), (0, -24)], start=2):
        turn(arm, f'Tail{i}', 'x', pitch)
        turn(arm, f'Tail{i}', 'z', yaw)
    lids(arm, eyes_shut)
    jaw(arm, yawn)


def lids(arm, shut):
    for s in ('L', 'R'):
        bone(arm, f'Eye.{s}').scale = (1, 1 - 0.88 * shut, 1)


def jaw(arm, open_):
    turn(arm, 'Jaw', 'x', 34 * open_)
    if open_:
        both(turn, arm, 'Ear1', 'x', -22 * open_)


def stand(arm):
    reset(arm)


def sit(arm):
    """Haunches on the floor, front legs straight: half way up (or down)."""
    reset(arm)
    shift(arm, 'Body', (0, 0.3, -0.62))
    turn(arm, 'Body', 'x', -18)
    for s in ('L', 'R'):
        # front paws stay under his chest
        shift(arm, f'IKFrontLeg.{s}', (0, 0.12, 0))
        shift(arm, f'IKBackLeg.{s}', mirror_x((0.1, -0.35, -0.12), s))
        shift(arm, f'PoleTargetBack.{s}', mirror_x((1.2, 1.5, 0.6), s))
    turn(arm, 'Tail1', 'x', -40)
    turn(arm, 'Neck1', 'x', -6)


def sphinx(arm):
    """Lying, chest up, head up: the middle of lying down."""
    lie(arm, head_up=1.0, eyes_shut=0.0)
    shift(arm, 'Body', (0, 0, 0.12))


def bow(arm, yawn=0.0):
    """The stretch: front legs out in front, chest low, rump up, tail up; yawning at the top of it."""
    reset(arm)
    turn(arm, 'Body', 'x', 22)
    shift(arm, 'Body', (0, 0.2, -0.3))
    for s in ('L', 'R'):
        shift(arm, f'IKFrontLeg.{s}', mirror_x((0.0, -1.05, -0.12), s))
        turn(arm, f'IKFrontLeg.{s}', 'x', -45)
        turn(arm, f'FF.{s}', 'x', 45)
    turn(arm, 'Tail1', 'x', 18)
    turn(arm, 'Neck1', 'x', -6 - 12 * yawn)
    turn(arm, 'Neck2', 'x', -4 - 8 * yawn)
    turn(arm, 'Head', 'x', -14 * yawn)
    lids(arm, 0.9 * yawn)
    jaw(arm, yawn)


# ---------- clips ----------

def key_all(arm, frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert('location', frame=frame)
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        pb.keyframe_insert('scale', frame=frame)


def clip(arm, name, keys):
    """An action from (frame, pose) pairs; poses are functions that pose the rig."""
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    for frame, pose in keys:
        pose(arm)
        key_all(arm, frame)
    arm.animation_data.action = None
    act.use_fake_user = True
    return act


def build_clips(arm):
    S = FPS
    clip(arm, 'Lie_Sleep', [(0, lambda a: lie(a)), (S * 2, lambda a: lie(a))])
    clip(arm, 'Lie_HeadUp', [(0, lambda a: lie(a, head_up=1, eyes_shut=0)), (S * 2, lambda a: lie(a, head_up=1, eyes_shut=0))])
    # the lying yawn, 2.8 s: head up, mouth wide and eyes squeezed, then back down
    clip(arm, 'Lie_Yawn', [
        (0, lambda a: lie(a)),
        (15, lambda a: lie(a, head_up=0.8, eyes_shut=0.3)),
        (36, lambda a: lie(a, head_up=1, yawn=1, eyes_shut=0.9)),
        (56, lambda a: lie(a, head_up=1, yawn=0.9, eyes_shut=0.9)),
        (68, lambda a: lie(a, head_up=0.8, eyes_shut=0.6)),
        (84, lambda a: lie(a)),
    ])
    # getting up, 1.5 s: front first, then the rump
    clip(arm, 'Stand_Up', [(0, lambda a: lie(a, head_up=1, eyes_shut=0)), (20, sit), (45, stand)])
    # the stretch, 3.5 s: down into a bow, a long yawn, up again
    clip(arm, 'Stretch_Yawn', [
        (0, stand),
        (22, bow),
        (40, lambda a: bow(a, yawn=1)),
        (70, lambda a: bow(a, yawn=1)),
        (84, bow),
        (105, stand),
    ])
    # lying down, 2 s: rump first, then the front, then the head down
    clip(arm, 'Lie_Down', [(0, stand), (18, sit), (40, sphinx), (60, lambda a: lie(a))])


# ---------- preview and export ----------

def preview(arm, mesh, folder):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 480, 300
    world = bpy.data.worlds.new('W')
    scene.world = world
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (0.7, 0.2, 0.9)
    scene.collection.objects.link(sun)
    floor = bpy.data.meshes.new('Floor')
    floor.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)])
    scene.collection.objects.link(bpy.data.objects.new('Floor', floor))
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    poses = {'lie': lie, 'lie_up': lambda a: lie(a, head_up=1, eyes_shut=0), 'lie_yawn': lambda a: lie(a, head_up=1, yawn=1, eyes_shut=0.9),
             'sit': sit, 'sphinx': sphinx, 'bow': bow, 'bow_yawn': lambda a: bow(a, yawn=1), 'stand': stand}
    only = os.environ.get('POSES')
    shots = []
    for name, pose in poses.items():
        if only and name not in only.split(','):
            continue
        pose(arm)
        bpy.context.view_layer.update()
        for view, at, look in (('side', (7.5, -0.6, 1.4), (0, -0.6, 0.9)), ('front', (4.2, -6.5, 2.6), (0, -0.8, 0.7)),
                               ('head', (2.2, -3.8, 1.2), (0, -1.9, 0.6))):
            cam.location = at
            cam.rotation_euler = (Vector(look) - Vector(at)).to_track_quat('-Z', 'Y').to_euler()
            scene.render.filepath = os.path.join(folder, f'pose_{name}_{view}.png')
            bpy.ops.render.render(write_still=True)
            shots.append(scene.render.filepath)
    sheet(shots, os.path.join(folder, 'sheet.png'), scene.render.resolution_x, scene.render.resolution_y)


def sheet(paths, out, w, h, cols=3):
    """All the preview renders on one page, three views to a row."""
    import numpy as np

    rows = (len(paths) + cols - 1) // cols
    page = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    for i, p in enumerate(paths):
        img = bpy.data.images.load(p)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
        r, c = rows - 1 - i // cols, i % cols  # image rows start at the bottom
        page[r * h:(r + 1) * h, c * w:(c + 1) * w] = px
        bpy.data.images.remove(img)
    img = bpy.data.images.new('sheet', cols * w, rows * h, alpha=True)
    img.pixels = page.ravel()
    img.filepath_raw = out
    img.file_format = 'PNG'
    img.save()


def export(arm, mesh):
    arm.scale = (SCALE, SCALE, SCALE)
    reset(arm)
    for o in bpy.context.scene.objects:
        o.select_set(o in (arm, mesh))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, 'wolf.glb'),
        export_format='GLB',
        use_selection=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_force_sampling=True,
        export_apply=False,
        export_yup=True,
    )


if __name__ == '__main__':
    arm, mesh = load()
    mouth = materials(mesh)
    lower = cut_mouth(mesh, mouth)
    eyes = add_bones(arm, mesh)
    weigh(mesh, lower, eyes)
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    if PREVIEW:
        preview(arm, mesh, PREVIEW)
    else:
        build_clips(arm)
        # the pack's other clips come along with the rig; he never gallops or attacks
        for a in list(bpy.data.actions):
            if a.name not in KEEP + CLIPS:
                bpy.data.actions.remove(a)
        os.makedirs(OUT, exist_ok=True)
        export(arm, mesh)
        print('clips:', sorted(a.name for a in bpy.data.actions))
    sys.exit(0)
