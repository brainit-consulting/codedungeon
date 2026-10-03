"""Assemble the dungeon's rigged coders from the CC0 Quaternius packs, in Blender (5.x), headless.

Each variant is an outfit (Peasant or Ranger, male or female) with the head cut from the matching base character
(its body mesh, keeping only what the Head and neck bones carry), the eyes, the eyebrows and a hairstyle, all bound
to the outfit's skeleton. Textures are shrunk to 1024 px JPEG. The animations the coders use go in one separate
file; every variant shares the same 65-bone skeleton, so any clip plays on any of them.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python scripts/build-characters.py

Writes client/public/characters/*.glb. Optional env: DUNGEON_ASSETS_SRC (the packs), DECIMATE (e.g. 0.6 keeps 60%).
"""

import math
import os
import sys

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('DUNGEON_ASSETS_SRC') or os.path.join(os.path.dirname(ROOT), 'codedungeon-home', 'assets-src')
OUT = os.path.join(ROOT, 'client', 'public', 'characters')
DECIMATE = float(os.environ.get('DECIMATE', '1'))

BASE = os.path.join(SRC, 'Universal Base Characters[Standard]', 'Universal Base Characters[Standard]')
OUTFITS = os.path.join(SRC, 'Modular Character Outfits - Fantasy[Standard]', 'Modular Character Outfits - Fantasy[Standard]', 'Exports', 'glTF (Godot-Unreal)', 'Outfits')
HAIR = os.path.join(BASE, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)')
ANIMS = os.path.join(SRC, 'Universal Animation Library[Standard]', 'Universal Animation Library[Standard]', 'Unreal-Godot', 'UAL1_Standard.glb')

# outfit, base body, hair, extra (eyebrows / beard)
VARIANTS = [
    ('Male_Peasant', 'Superhero_Male', 'Hair_SimpleParted', 'Eyebrows_Regular'),
    ('Male_Ranger', 'Superhero_Male', 'Hair_Buzzed', 'Hair_Beard'),
    ('Female_Peasant', 'Superhero_Female', 'Hair_Buns', 'Eyebrows_Female'),
    ('Female_Ranger', 'Superhero_Female', 'Hair_Long', 'Eyebrows_Female'),
]
CLIPS = ['Sitting_Idle_Loop', 'Sitting_Talking_Loop', 'Idle_Loop', 'Walk_Loop', 'Interact']
HEAD_BONES = {'Head', 'neck_01'}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def armature_of(objs):
    return next(o for o in objs if o.type == 'ARMATURE')


def bind(mesh, arm):
    """Point a skinned mesh at another armature with the same bone names."""
    mesh.parent = arm
    mesh.matrix_parent_inverse.identity()
    for m in mesh.modifiers:
        if m.type == 'ARMATURE':
            m.object = arm
    if not any(m.type == 'ARMATURE' for m in mesh.modifiers):
        m = mesh.modifiers.new('Armature', 'ARMATURE')
        m.object = arm


def keep_head_only(mesh):
    """Delete every vertex not carried mostly by the head and neck bones."""
    groups = {g.index: g.name for g in mesh.vertex_groups}
    drop = []
    for v in mesh.data.vertices:
        head = sum(g.weight for g in v.groups if groups.get(g.group) in HEAD_BONES)
        total = sum(g.weight for g in v.groups) or 1
        if head / total < 0.5:
            drop.append(v.index)
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in drop], context='VERTS')
    bm.to_mesh(mesh.data)
    bm.free()


def shrink_images():
    for img in bpy.data.images:
        if img.size[0] > 1024:
            img.scale(1024, 1024)


def decimate(objs):
    if DECIMATE >= 1:
        return
    for o in objs:
        if o.type == 'MESH':
            m = o.modifiers.new('Decimate', 'DECIMATE')
            m.ratio = DECIMATE
            # keep it before the armature, so the weights survive
            while o.modifiers.find('Decimate') > 0:
                bpy.ops.object.modifier_move_up({'object': o}, modifier='Decimate') if False else o.modifiers.move(o.modifiers.find('Decimate'), 0)


def export(path, objs, animations):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_image_format='JPEG',
        export_jpeg_quality=86,
        export_animations=animations,
        export_apply=False,
        export_yup=True,
    )


def build_variant(outfit, base, hair, extra):
    reset()
    outfit_objs = import_gltf(os.path.join(OUTFITS, outfit + '.gltf'))
    arm = armature_of(outfit_objs)
    base_objs = import_gltf(os.path.join(BASE, 'Base Characters', 'Godot - UE', base + '_FullBody.gltf'))
    base_arm = armature_of(base_objs)
    keep = []
    for o in base_objs:
        if o.type != 'MESH':
            continue
        mats = [s.material.name for s in o.material_slots if s.material]
        if any('Eyes' in m for m in mats):
            bind(o, arm)
            keep.append(o)
        elif any('Superhero' in m for m in mats):
            keep_head_only(o)
            bind(o, arm)
            keep.append(o)
        else:
            bpy.data.objects.remove(o)  # the base's own eyebrows; the outfit gets the hair pack's
    for name in (hair, extra):
        for o in import_gltf(os.path.join(HAIR, name + '.gltf')):
            if o.type == 'MESH':
                bind(o, arm)
                keep.append(o)
            elif o.type == 'ARMATURE':
                pass
    # drop every armature but the outfit's
    for o in list(bpy.data.objects):
        if o.type == 'ARMATURE' and o != arm:
            bpy.data.objects.remove(o)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    decimate(meshes)
    shrink_images()
    export(os.path.join(OUT, outfit + '.glb'), [arm, *meshes], animations=False)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    print(f'built {outfit}: {len(meshes)} meshes, ~{tris} triangles before decimation')


# Where a seated coder's hands go to write, in the character's own space (Blender axes: the character faces -Y, up is
# +Z, its right hand is at -X; the origin is where the game places it). These match Desk.tsx: the coder's origin sits
# SEAT_FORWARD in front of the chair's centre and SEAT_LIFT up, the ledger lies on the bench in front of them.
LEDGER = {'y': -0.3, 'z': 0.752}  # the ledger's near half, from the coder's origin (measured, see Desk.tsx)
LEAN = {'spine_01': 8.0, 'spine_02': 14.0, 'spine_03': 13.0, 'neck_01': 4.0, 'Head': 12.0}  # degrees forward
WRITE_FRAMES = 60  # a two-second loop at 30 fps


def set_action(arm, act):
    arm.animation_data_create()
    arm.animation_data.action = act
    try:
        arm.animation_data.action_slot = act.slots[0]
    except (AttributeError, IndexError):
        pass


def leaned_copy(arm, src):
    """A copy of `src` with the spine, neck and head tipped forward a little at every key."""
    import mathutils

    act = src.copy()
    act.name = 'Sitting_Writing_Base'
    for bone, deg in LEAN.items():
        path = f'pose.bones["{bone}"].rotation_quaternion'
        curves = [c for c in all_fcurves(act) if c.data_path == path]
        if len(curves) != 4:
            continue
        curves.sort(key=lambda c: c.array_index)
        tilt = mathutils.Quaternion((1, 0, 0), math.radians(deg))
        frames = sorted({k.co[0] for c in curves for k in c.keyframe_points})
        values = {f: mathutils.Quaternion([c.evaluate(f) for c in curves]) for f in frames}
        for c in curves:
            for k in c.keyframe_points:
                q = values[k.co[0]] @ tilt
                k.co[1] = q[c.array_index]
                k.handle_left[1] = k.co[1]
                k.handle_right[1] = k.co[1]
    return act


def all_fcurves(act):
    """F-curves of an action, in Blender 4 (act.fcurves) or 5 (layered actions)."""
    if hasattr(act, 'fcurves') and act.fcurves is not None:
        try:
            return list(act.fcurves)
        except TypeError:
            pass
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out += list(bag.fcurves)
    return out


def build_writing(arm):
    """Sitting_Writing_Loop: seated, leaning in, left hand holding the ledger's page, right hand writing."""
    base = leaned_copy(arm, bpy.data.actions['Sitting_Idle_Loop'])
    set_action(arm, base)
    scene = bpy.context.scene
    targets = {}
    for side, x in (('l', 0.17), ('r', -0.1)):
        t = bpy.data.objects.new(f'target_{side}', None)
        scene.collection.objects.link(t)
        t.location = (x, LEDGER['y'] + (0.02 if side == 'l' else 0), LEDGER['z'] + 0.03)
        pole = bpy.data.objects.new(f'pole_{side}', None)
        scene.collection.objects.link(pole)
        pole.location = (x * 4, 0.3, 0.7)  # elbows out to the side and down
        c = arm.pose.bones[f'lowerarm_{side}'].constraints.new('IK')
        c.target = t
        c.pole_target = pole
        c.pole_angle = math.radians(-90)
        c.chain_count = 2
        targets[side] = t
    # the right hand writes: three small strokes per loop, drifting along the line and back
    for f in range(WRITE_FRAMES + 1):
        u = f / WRITE_FRAMES
        r = targets['r']
        r.location = (
            -0.1 - 0.05 * math.sin(math.pi * 2 * u) + 0.012 * math.sin(math.pi * 6 * u),
            LEDGER['y'] + 0.01 * math.cos(math.pi * 6 * u),
            LEDGER['z'] + 0.03 + 0.006 * max(0.0, math.sin(math.pi * 6 * u)),
        )
        r.keyframe_insert('location', frame=f)
    scene.frame_start, scene.frame_end = 0, WRITE_FRAMES
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.nla.bake(frame_start=0, frame_end=WRITE_FRAMES, only_selected=False, visual_keying=True, clear_constraints=True, use_current_action=False, bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    baked = arm.animation_data.action
    baked.name = 'Sitting_Writing_Loop'
    bpy.data.actions.remove(base)
    for t in list(bpy.data.objects):
        if t.type == 'EMPTY':
            bpy.data.objects.remove(t)
    for a in list(bpy.data.actions):
        if a.name.startswith('target_'):
            bpy.data.actions.remove(a)  # the writing target's own motion, not a clip
    return baked


def build_animations():
    reset()
    objs = import_gltf(ANIMS)
    arm = armature_of(objs)
    for o in list(bpy.data.objects):
        if o.type == 'MESH':
            bpy.data.objects.remove(o)
    for a in list(bpy.data.actions):
        if not any(a.name.startswith(c) for c in CLIPS):
            bpy.data.actions.remove(a)
    build_writing(arm)
    print('clips:', [a.name for a in bpy.data.actions])
    export(os.path.join(OUT, 'animations.glb'), [arm], animations=True)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if os.environ.get('ONLY') != 'animations':
        for v in VARIANTS:
            build_variant(*v)
    build_animations()
    sys.exit(0)
