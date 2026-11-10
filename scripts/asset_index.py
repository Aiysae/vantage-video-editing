#!/usr/bin/env python3
"""本地素材库：保留旧的 index 用法，增加投放、预览、入库与检索。
asset_index.py [素材库目录] [--pending | --prepare 文件 | --register 分析.json | --search 关键词]
内容说明由实际看过素材的 Agent 写入，脚本只处理文件、技术信息和索引。
"""
import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

DEFAULT_ROOT = Path(os.environ.get('VANTAGE_MEDIA_ROOT', './素材库'))
VID = {'.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'}
IMG = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif', '.tif', '.tiff', '.bmp'}
AUD = {'.mp3', '.wav', '.m4a'}


def write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as f:
        f.write(text)
        tmp = f.name
    os.replace(tmp, path)


def dump(path, data):
    write_text(path, json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise ValueError(result.stderr.strip()[-1600:] or '命令执行失败：' + args[0])
    return result.stdout


def kind(path):
    ext = path.suffix.lower()
    return 'video' if ext in VID else 'image' if ext in IMG else 'audio' if ext in AUD else None


def probe(path):
    info = {'kind': kind(path), 'bytes': path.stat().st_size}
    if info['kind'] == 'image':
        from PIL import Image, ImageOps
        try:
            with Image.open(path) as im:
                info['size'] = list(ImageOps.exif_transpose(im).size)
        except Exception:
            if path.suffix.lower() not in {'.heic', '.heif'}:
                raise
            with tempfile.TemporaryDirectory() as tmp:
                converted = Path(tmp) / 'image.jpg'
                run(['sips', '-s', 'format', 'jpeg', str(path), '--out', str(converted)])
                with Image.open(converted) as im:
                    info['size'] = list(ImageOps.exif_transpose(im).size)
        info['has_audio'] = False
    else:
        data = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
        streams = data.get('streams', [])
        video = next((s for s in streams if s.get('codec_type') == 'video'), None)
        info['has_audio'] = any(s.get('codec_type') == 'audio' for s in streams)
        info['duration'] = round(float(data.get('format', {}).get('duration', 0)), 3)
        if info['kind'] == 'video':
            if not video or info['duration'] <= 0:
                raise ValueError('视频缺少有效画面或时长：' + str(path))
            width, height = video['width'], video['height']
            rotation = float(video.get('tags', {}).get('rotate', 0))
            for side in video.get('side_data_list', []):
                if 'rotation' in side:
                    rotation = float(side['rotation'])
            if round(rotation) % 180:
                width, height = height, width
            info['size'] = [width, height]
            rate = video.get('avg_frame_rate', '0/1').split('/')
            info['fps'] = round(float(rate[0]) / float(rate[1]), 3) if len(rate) == 2 and float(rate[1]) else None
    if info.get('size'):
        w, h = info['size']
        info['orientation'] = '竖屏' if h > w else '横屏' if w > h else '方形'
    return info


def settings(root):
    if not root.is_dir():
        raise ValueError('素材库目录未就绪，请检查硬盘：' + str(root))
    f = root / 'library.json'
    cfg = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
    cfg.setdefault('inbox', '00-投放')
    cfg.setdefault('archive', '01-已入库')
    return cfg


def media_files(root, extensions, excluded=()):
    return [p for p in sorted(root.rglob('*')) if p.is_file()
            and p.suffix.lower() in extensions
            and not any(part.startswith('.') or part in excluded for part in p.relative_to(root).parts)]


def pending(root, cfg):
    inbox = root / cfg['inbox']
    return media_files(inbox, VID | IMG) if inbox.exists() else []


def cards(cfg):
    if not cfg.get('notes_root'):
        return []
    import yaml
    result = []
    for card in sorted((Path(cfg['notes_root']) / '素材卡').glob('*.md')):
        text = card.read_text(encoding='utf-8')
        if not text.startswith('---\n') or '\n---\n' not in text[4:]:
            raise ValueError('素材卡缺少属性：' + str(card))
        header, body = text[4:].split('\n---\n', 1)
        item = yaml.safe_load(header)
        if not isinstance(item, dict) or not item.get('media_path'):
            raise ValueError('素材卡缺少 media_path：' + str(card))
        result.append((card, item, body))
    return result


def build_index(root, cfg):
    by_path, issues = {}, []
    for card, item, body in cards(cfg):
        path = Path(item['media_path']).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            issues.append({'card': str(card), 'reason': '素材路径不在库内或文件缺失'})
            continue
        by_path[path] = (card, item, body)
    items = []
    for f in media_files(root, VID | IMG | AUD, (cfg['inbox'],)):
        entry = {'path': str(f.relative_to(root)), 'absolute_path': str(f), 'kind': kind(f),
                 'bytes': f.stat().st_size, 'tags': list(f.relative_to(root).parent.parts) + [f.stem], 'analyzed': False}
        if f.resolve() in by_path:
            card, meta, body = by_path[f.resolve()]
            entry.update(meta)
            entry.update({'path': str(f.relative_to(root)), 'absolute_path': str(f),
                          'card_path': str(card), 'note': body.strip(), 'analyzed': True, 'bytes': f.stat().st_size})
        else:
            try:
                entry.update(probe(f))
            except Exception as exc:
                entry['metadata_error'] = str(exc)
            note = f.with_suffix('.txt')
            if note.exists():
                entry['note'] = note.read_text(encoding='utf-8').strip()
        items.append(entry)
    data = {'root': str(root), 'notes_root': cfg.get('notes_root'), 'count': len(items),
            'pending_count': len(pending(root, cfg)), 'issues': issues, 'items': items}
    dump(root / 'index.json', data)
    if cfg.get('notes_root'):
        lines = ['# 素材索引', '', '[[素材库入口|投放与使用说明]]', '',
                 '已归档素材：' + str(len(items)) + ' 条；待入库：' + str(data['pending_count']) + ' 条。', '',
                 '| 素材 | 类型 | 标签 | 内容 |', '| --- | --- | --- | --- |']
        for item in items:
            title = str(item.get('title', Path(item['path']).stem)).replace('|', '／').replace('\n', ' ')
            link = '[[' + Path(cfg['notes_root']).name + '/素材卡/' + Path(item['card_path']).stem + '|' + title + ']]' if item.get('card_path') else title + '（待分析）'
            tags = '、'.join(item.get('tags', []))
            desc = str(item.get('description', '待分析内容')).replace('|', '／').replace('\n', ' ')
            lines.append('| ' + ' | '.join([link, item['kind'], tags.replace('|', '／'), desc]) + ' |')
        if not items:
            lines += ['', '把图片或视频放进桌面「素材投放」，然后告诉 Agent「处理新素材」。']
        if issues:
            lines += ['', '路径需要检查：', ''] + ['- ' + x['card'] + '：' + x['reason'] for x in issues]
        write_text(Path(cfg['notes_root']) / '素材索引.md', '\n'.join(lines) + '\n')
    return data


def prepare(root, source, export_audio=False):
    from PIL import Image, ImageDraw, ImageFont, ImageOps
    if kind(source) not in {'video', 'image'} or not source.is_file():
        raise ValueError('请选择实际存在的视频或图片：' + str(source))
    stat = source.stat()
    digest = sha256(source)
    info = probe(source)
    work = root / '.入库工作' / digest[:16]
    work.mkdir(parents=True, exist_ok=True)
    labels, frames = [], []
    if info['kind'] == 'image':
        img_source = source
        if source.suffix.lower() in {'.heic', '.heif'}:
            img_source = work / 'converted.jpg'
            run(['sips', '-s', 'format', 'jpeg', str(source), '--out', str(img_source)])
        with Image.open(img_source) as im:
            im = ImageOps.exif_transpose(im).convert('RGB')
            im.thumbnail((1600, 1600))
            im.save(work / 'preview.jpg', quality=90)
    else:
        duration = info['duration']
        times = [round(max(0, duration - min(0.15, duration / 10)) * i / 5, 3) for i in range(6)]
        for i, sec in enumerate(times):
            frame = work / ('frame-' + str(i + 1) + '.jpg')
            run(['ffmpeg', '-v', 'error', '-y', '-ss', str(sec), '-i', str(source),
                 '-frames:v', '1', '-vf', 'scale=480:480:force_original_aspect_ratio=decrease', str(frame)])
            if not frame.exists():
                raise ValueError('该时间点未取得画面：' + str(sec))
            frames.append(frame)
            labels.append({'file': str(frame), 'seconds': sec})
        canvas = Image.new('RGB', (3 * 480, 2 * 520), '#202020')
        draw = ImageDraw.Draw(canvas)
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 20)
        for i, frame in enumerate(frames):
            with Image.open(frame) as im:
                x, y = i % 3 * 480, i // 3 * 520
                canvas.paste(im, (x + (480 - im.width) // 2, y + 32 + (480 - im.height) // 2))
                draw.text((x + 12, y + 7), str(labels[i]['seconds']) + ' s', font=font, fill='white')
        canvas.save(work / 'preview.jpg', quality=90)
    audio_path = None
    if export_audio and info.get('has_audio'):
        audio_path = work / 'audio.wav'
        run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-vn', '-ac', '1', '-ar', '16000', str(audio_path)])
    after = source.stat()
    if (stat.st_size, stat.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise ValueError('文件仍在变化，复制完成后再入库：' + str(source))
    proof = {'source_path': str(source), 'sha256': digest, 'metadata': info,
             'preview_path': str(work / 'preview.jpg'), 'frames': labels,
             'audio_path': str(audio_path) if audio_path else None}
    dump(work / 'inspection.json', proof)
    return dict(proof, inspection_path=str(work / 'inspection.json'))


def timestamp(sec):
    return str(int(sec) // 60).zfill(2) + ':' + ('%05.2f' % (sec % 60))


def register(root, cfg, analysis_path):
    import yaml
    if not cfg.get('notes_root'):
        raise ValueError('该目录未配置 Obsidian notes_root')
    analysis = json.loads(analysis_path.read_text(encoding='utf-8'))
    source = Path(analysis['source_path']).expanduser().resolve()
    if not source.is_relative_to((root / cfg['inbox']).resolve()) or not source.is_file():
        raise ValueError('只归档投放文件夹里的素材；既有项目文件请先复制进去')
    if analysis.get('content_reviewed') is not True:
        raise ValueError('请先实际查看素材，再填写 content_reviewed=true')
    for field in ('title', 'description'):
        if not isinstance(analysis.get(field), str) or not analysis[field].strip():
            raise ValueError('缺少内容字段：' + field)
    if not isinstance(analysis.get('tags'), list) or not analysis['tags'] or not all(isinstance(t, str) and t.strip() for t in analysis['tags']):
        raise ValueError('tags 需要填写实际内容标签列表')
    for field in ('uses', 'segments'):
        if not isinstance(analysis.get(field, []), list):
            raise ValueError(field + ' 应为列表')
    if not all(isinstance(x, str) for x in analysis.get('uses', [])):
        raise ValueError('uses 应为文字列表')
    digest = sha256(source)
    if digest != analysis.get('sha256'):
        raise ValueError('源文件已变化，请重新预览和分析')
    work = root / '.入库工作' / digest[:16]
    proof = json.loads((work / 'inspection.json').read_text(encoding='utf-8'))
    if proof['sha256'] != digest or not (work / 'preview.jpg').is_file():
        raise ValueError('缺少对应素材的预览记录')
    info = probe(source)
    for segment in analysis.get('segments', []):
        start, end = segment.get('start'), segment.get('end')
        if info['kind'] != 'video' or not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or not math.isfinite(start) or not math.isfinite(end) or not 0 <= start < end <= info['duration'] or not segment.get('description'):
            raise ValueError('片段需要有效的 start/end 秒数及描述，并位于实际视频时长内')
    for card, meta, _ in cards(cfg):
        if meta.get('sha256') == digest:
            if not Path(meta['media_path']).is_file() or sha256(Path(meta['media_path'])) != digest:
                raise ValueError('已有素材记录与文件不一致：' + str(card))
            build_index(root, cfg)
            return {'status': 'duplicate', 'card_path': str(card), 'media_path': meta['media_path'], 'source_retained': str(source)}
    asset_id = 'M-' + digest[:12]
    slug = re.sub(r'[\\/:*?"<>|\[\]#\n\r]+', '_', analysis['title']).strip(' ._')[:60] or '素材'
    target = root / cfg['archive'] / (asset_id + '_' + slug + source.suffix.lower())
    notes = Path(cfg['notes_root'])
    card = notes / '素材卡' / (asset_id + '_' + slug + '.md')
    preview = notes / '预览' / (asset_id + '.jpg')
    if target.exists() or card.exists() or preview.exists():
        raise ValueError('目标已存在，请检查现有入库记录：' + str(target))
    target.parent.mkdir(parents=True, exist_ok=True)
    source_stat = source.stat()
    with source.open('rb') as inp, target.open('xb') as out:
        shutil.copyfileobj(inp, out, 1024 * 1024)
    after = source.stat()
    if sha256(target) != digest or (source_stat.st_size, source_stat.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        target.unlink()
        raise ValueError('归档核验失败，投放文件已保留')
    shutil.copystat(source, target)
    preview.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(work / 'preview.jpg', preview)
    meta = dict(info, id=asset_id, title=analysis['title'].strip(), description=analysis['description'].strip(),
                tags=list(dict.fromkeys(['素材库'] + analysis['tags'])), uses=analysis.get('uses', []),
                segments=analysis.get('segments', []), media_path=str(target), preview_path=str(preview),
                original_name=source.name, sha256=digest, source='用户投放',
                capture_type=analysis.get('capture_type', '未知'), transcript=analysis.get('transcript', ''),
                notes=analysis.get('notes', ''),
                created=datetime.now(ZoneInfo(cfg.get('timezone', 'Asia/Shanghai'))).isoformat(timespec='seconds'))
    body = ['# ' + meta['title'], '', '![[%s/预览/%s]]' % (notes.name, preview.name), '', meta['description'], '',
            '**标签**：' + '、'.join(meta['tags']), '', '**适合用途**：' + '；'.join(meta['uses']), '',
            '[打开原素材](' + target.as_uri() + ')', '',
            '原文件名：' + source.name.replace(chr(96), '') + '。', '', '## 可用片段', '']
    for s in meta['segments']:
        body.append('- ' + timestamp(s['start']) + '–' + timestamp(s['end']) + '：' + s['description'])
    if not meta['segments']:
        body.append('图片按整张使用。' if meta['kind'] == 'image' else '具体剪切点在选用时核验。')
    if meta['transcript']:
        body += ['', '## 声音转写', '', meta['transcript']]
    if meta['notes']:
        body += ['', '## 使用备注', '', meta['notes']]
    write_text(card, '---\n' + yaml.safe_dump(meta, allow_unicode=True, sort_keys=False, width=1000) + '---\n\n' + '\n'.join(body) + '\n')
    # 先确保归档副本、卡片和索引存在，再移走投放副本；视频内容保持原字节。
    build_index(root, cfg)
    source.unlink()
    shutil.rmtree(work)
    data = build_index(root, cfg)
    return {'status': 'registered', 'id': asset_id, 'media_path': str(target), 'card_path': str(card), 'count': data['count']}


def search(data, query, limit):
    terms = [x for x in re.split(r'[\s,，、;；]+', query.casefold()) if x]
    found = []
    for item in data['items']:
        text = json.dumps(item, ensure_ascii=False).casefold()
        tags = ' '.join(item.get('tags', [])).casefold()
        score = sum(3 if t in tags else 1 for t in terms if t in text)
        if score:
            found.append(dict(item, score=score))
    return sorted(found, key=lambda i: (-i['score'], i['path']))[:limit]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', nargs='?', default=str(DEFAULT_ROOT))
    action = parser.add_mutually_exclusive_group()
    action.add_argument('--pending', action='store_true')
    action.add_argument('--prepare', type=Path)
    action.add_argument('--register', type=Path)
    action.add_argument('--search')
    parser.add_argument('--audio', action='store_true', help='预览视频时额外导出 16kHz 单声道音频')
    parser.add_argument('--limit', type=int, default=10)
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    cfg = settings(root)
    if args.pending:
        result = {'inbox': str(root / cfg['inbox']),
                  'items': [{'path': str(p), 'kind': kind(p), 'bytes': p.stat().st_size} for p in pending(root, cfg)]}
        result['count'] = len(result['items'])
    elif args.prepare:
        result = prepare(root, args.prepare.expanduser().resolve(), args.audio)
    elif args.register:
        result = register(root, cfg, args.register.expanduser().resolve())
    elif args.search is not None:
        result = {'query': args.search, 'items': search(build_index(root, cfg), args.search, args.limit)}
        result['count'] = len(result['items'])
    else:
        data = build_index(root, cfg)
        result = {k: v for k, v in data.items() if k != 'items'}
        result['index_path'] = str(root / 'index.json')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, subprocess.TimeoutExpired) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
