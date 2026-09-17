#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_presentation.py
Generates both:
  1. High-fidelity native PPTX (protokol-presentation.pptx)
  2. Standalone interactive HTML presentation (index.html)
Designed for PROTOKOL HUD Manager executive review.
"""

import os
import sys
import json
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")

IMAGE_PATHS = {
    "mark": os.path.join(ASSETS_DIR, "protokol-mark.png"),
    "cyber": os.path.join(ASSETS_DIR, "fennec-cyber-agent-transparent.png"),
    "broadcast": os.path.join(ASSETS_DIR, "fennec-broadcast-agent-transparent.png"),
    "championship": os.path.join(ASSETS_DIR, "fennec-championship-agent-transparent.png"),
    "championship_orig": os.path.join(ASSETS_DIR, "championship-names-fixed.png"),
    "manager_desktop": os.path.join(ASSETS_DIR, "manager-desktop.png"),
    "manager_preview": os.path.join(ASSETS_DIR, "manager-camera-preview.png"),
}

# -----------------------------------------------------------------------------
# Color Palette (Dark Luxury Broadcast Theme)
# -----------------------------------------------------------------------------
COLOR_BG = RGBColor(11, 14, 20)             # #0B0E14
COLOR_SURFACE = RGBColor(19, 24, 34)        # #131822
COLOR_SURFACE_LIGHT = RGBColor(27, 34, 48)  # #1B2230
COLOR_BORDER = RGBColor(38, 48, 66)         # #263042
COLOR_BORDER_ACCENT = RGBColor(56, 70, 96)  # #384660

COLOR_GOLD = RGBColor(229, 184, 105)        # #E5B869
COLOR_CYAN = RGBColor(0, 229, 255)          # #00E5FF
COLOR_BLUE = RGBColor(59, 130, 246)         # #3B82F6
COLOR_GREEN = RGBColor(16, 185, 129)        # #10B981
COLOR_AMBER = RGBColor(245, 158, 11)        # #F59E0B

COLOR_TEXT_PRIMARY = RGBColor(248, 250, 252) # #F8FAFC
COLOR_TEXT_SECONDARY = RGBColor(203, 213, 225) # #CBD5E1
COLOR_TEXT_MUTED = RGBColor(148, 163, 184)     # #94A3B8
COLOR_TEXT_SUBTLE = RGBColor(100, 116, 139)    # #64748B

def set_slide_background(slide, color=COLOR_BG):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_header(slide, kicker_text, title_text, subtitle_text="", kicker_color=COLOR_GOLD):
    # Kicker
    tb = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(0.28))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.text = kicker_text.upper()
    p.font.size = Pt(9.5)
    p.font.bold = True
    p.font.color.rgb = kicker_color

    # Title
    tb_title = slide.shapes.add_textbox(Inches(0.8), Inches(0.68), Inches(11.733), Inches(0.55))
    tf_title = tb_title.text_frame
    tf_title.word_wrap = True
    tf_title.margin_left = tf_title.margin_top = tf_title.margin_right = tf_title.margin_bottom = 0
    p_title = tf_title.paragraphs[0]
    p_title.text = title_text
    p_title.font.size = Pt(21)
    p_title.font.bold = True
    p_title.font.color.rgb = COLOR_TEXT_PRIMARY

    # Subtitle
    if subtitle_text:
        tb_sub = slide.shapes.add_textbox(Inches(0.8), Inches(1.24), Inches(11.733), Inches(0.38))
        tf_sub = tb_sub.text_frame
        tf_sub.word_wrap = True
        tf_sub.margin_left = tf_sub.margin_top = tf_sub.margin_right = tf_sub.margin_bottom = 0
        p_sub = tf_sub.paragraphs[0]
        p_sub.text = subtitle_text
        p_sub.font.size = Pt(11)
        p_sub.font.color.rgb = COLOR_TEXT_MUTED

def add_footer(slide, current_slide, total_slides=13):
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(7.0), Inches(11.733), Inches(0.012))
    line.fill.solid()
    line.fill.fore_color.rgb = COLOR_BORDER
    line.line.color.rgb = COLOR_BORDER

    tb = slide.shapes.add_textbox(Inches(0.8), Inches(7.06), Inches(9.0), Inches(0.28))
    tf = tb.text_frame
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.text = "PROTOKOL HUD Manager  •  Комплекс CS2 турнирных трансляций  •  Версия v0.1.0"
    p.font.size = Pt(8.5)
    p.font.color.rgb = COLOR_TEXT_SUBTLE

    tb_page = slide.shapes.add_textbox(Inches(10.5), Inches(7.06), Inches(2.033), Inches(0.28))
    tf_page = tb_page.text_frame
    tf_page.margin_left = tf_page.margin_top = tf_page.margin_right = tf_page.margin_bottom = 0
    p_page = tf_page.paragraphs[0]
    p_page.alignment = PP_ALIGN.RIGHT
    p_page.text = f"{current_slide:02d} / {total_slides:02d}"
    p_page.font.size = Pt(8.5)
    p_page.font.bold = True
    p_page.font.color.rgb = COLOR_GOLD

def add_card(slide, left, top, width, height, bg_color=COLOR_SURFACE, border_color=COLOR_BORDER):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    shape.line.color.rgb = border_color
    shape.line.width = Pt(1)
    return shape

def add_image_with_frame(slide, img_path, left, top, width, height, caption=None, border_color=COLOR_BORDER):
    frame = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left - Inches(0.03), top - Inches(0.03), width + Inches(0.06), height + Inches(0.06))
    frame.fill.solid()
    frame.fill.fore_color.rgb = COLOR_SURFACE
    frame.line.color.rgb = border_color
    frame.line.width = Pt(1)

    if os.path.exists(img_path):
        slide.shapes.add_picture(img_path, left, top, width=width, height=height)
    else:
        box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
        box.fill.solid()
        box.fill.fore_color.rgb = COLOR_SURFACE_LIGHT
        box.line.color.rgb = border_color
        tf = box.text_frame
        tf.text = f"[Изображение: {os.path.basename(img_path)}]"
        tf.paragraphs[0].font.size = Pt(10)
        tf.paragraphs[0].font.color.rgb = COLOR_TEXT_MUTED

    if caption:
        tb = slide.shapes.add_textbox(left, top + height + Inches(0.05), width, Inches(0.24))
        tf = tb.text_frame
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = caption
        p.font.size = Pt(8.2)
        p.font.color.rgb = COLOR_TEXT_SUBTLE

def build_presentation(out_path="protokol-presentation.pptx"):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # =========================================================================
    # SLIDE 1: COVER / TITLE
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1, COLOR_BG)

    # Accent decorative bar
    bar = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.1), Inches(0.06), Inches(5.1))
    bar.fill.solid()
    bar.fill.fore_color.rgb = COLOR_GOLD
    bar.line.fill.background()

    # Logo mark
    if os.path.exists(IMAGE_PATHS["mark"]):
        s1.shapes.add_picture(IMAGE_PATHS["mark"], Inches(1.1), Inches(1.1), width=Inches(1.1), height=Inches(1.1))

    # Kicker
    tb = s1.shapes.add_textbox(Inches(1.1), Inches(2.4), Inches(8.0), Inches(0.35))
    tf = tb.text_frame
    p = tf.paragraphs[0]
    p.text = "КИБЕРСПОРТИВНЫЙ ПРОДАКШН СЛЕДУЮЩЕГО ПОКОЛЕНИЯ"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = COLOR_GOLD

    # Title
    tb = s1.shapes.add_textbox(Inches(1.1), Inches(2.8), Inches(8.5), Inches(1.2))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "PROTOKOL HUD Manager"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = COLOR_TEXT_PRIMARY

    # Subtitle
    tb = s1.shapes.add_textbox(Inches(1.1), Inches(4.0), Inches(8.2), Inches(0.9))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "Автономный нативный комбайн управления трансляциями CS2:\nядро Tauri v2 + Rust, 3 независимых стиля HUD, SQLite WAL и интеграция веб-камер игроков"
    p.font.size = Pt(14)
    p.font.color.rgb = COLOR_TEXT_SECONDARY

    # Badges row
    badges = [
        ("ЯДРО СИСТЕМЫ", "Rust Axum + Tauri v2", COLOR_CYAN),
        ("БАЗА ДАННЫХ", "SQLite WAL (локально)", COLOR_GREEN),
        ("ТЕЛЕМЕТРИЯ CS2", "Realtime WebSocket", COLOR_BLUE),
        ("ФОРМ-ФАКТОР", "Tauri Desktop App", COLOR_GOLD)
    ]
    bx = 1.1
    for cat, val, col in badges:
        card = add_card(s1, Inches(bx), Inches(5.15), Inches(2.55), Inches(1.05), COLOR_SURFACE, COLOR_BORDER)
        tb_b = s1.shapes.add_textbox(Inches(bx + 0.15), Inches(5.25), Inches(2.25), Inches(0.85))
        tf_b = tb_b.text_frame
        p1 = tf_b.paragraphs[0]
        p1.text = cat
        p1.font.size = Pt(8)
        p1.font.bold = True
        p1.font.color.rgb = col
        p2 = tf_b.add_paragraph()
        p2.text = val
        p2.font.size = Pt(12)
        p2.font.bold = True
        p2.font.color.rgb = COLOR_TEXT_PRIMARY
        bx += 2.75

    add_footer(s1, 1, 13)
    s1.notes_slide.notes_text_frame.text = (
        "Слайд 1: Представление продукта PROTOKOL HUD Manager для руководства турнира и технического директора. "
        "Ключевая цель — независимость от тяжелых legacy решений, полная стабильность и премиальный ТВ-визуал."
    )

    # =========================================================================
    # SLIDE 2: INDUSTRY PROBLEM & VALUE PROPOSITION
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2, COLOR_BG)
    add_header(s2, "Позиционирование и ценность",
               "Преодоление ограничений устаревших HUD-решений",
               "Переход от ненадежных Node.js/Electron монолитов к скомпилированному Rust-стеку")

    # Table of comparison
    tbl_shape = s2.shapes.add_table(6, 4, Inches(0.8), Inches(1.7), Inches(7.5), Inches(5.0))
    table = tbl_shape.table
    table.columns[0].width = Inches(2.4)
    table.columns[1].width = Inches(1.6)
    table.columns[2].width = Inches(1.6)
    table.columns[3].width = Inches(1.9)

    headers = ["Параметр", "Lexogrine (LHM)", "EideticHM", "PROTOKOL Manager"]
    for j, h in enumerate(headers):
        cell = table.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = COLOR_SURFACE_LIGHT if j < 3 else COLOR_SURFACE
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.size = Pt(9.5)
        p.font.bold = True
        p.font.color.rgb = COLOR_GOLD if j == 3 else COLOR_TEXT_PRIMARY
        p.alignment = PP_ALIGN.CENTER if j > 0 else PP_ALIGN.LEFT

    rows_data = [
        ("Архитектура ядра", "Electron + Node.js", "Node.js Server", "Tauri v2 + Rust Core"),
        ("Конфигурация GSI", "Ручная правка cfg", "Ручное копирование", "Автогенерация из GUI"),
        ("Сетевой стек", "Express / WS", "Socket.io / HTTP", "Axum 0.7 + Tokio WS"),
        ("База данных", "NeDB (JSON файлы)", "Локальные файлы", "SQLite (WAL, транзакции)"),
        ("Поддержка вебкамер", "Сложная ручная верстка", "Хаки в CSS/OBS", "Dual-Mode 16:9 (?cam=live)"),
    ]

    for i, row in enumerate(rows_data):
        for j, val in enumerate(row):
            cell = table.cell(i + 1, j)
            cell.fill.solid()
            cell.fill.fore_color.rgb = COLOR_SURFACE if (i % 2 == 0) else COLOR_BG
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.size = Pt(9)
            if j == 3:
                p.font.bold = True
                p.font.color.rgb = COLOR_CYAN if i == 0 else (COLOR_GREEN if i in (1, 3) else COLOR_TEXT_PRIMARY)
            else:
                p.font.color.rgb = COLOR_TEXT_MUTED if j > 0 else COLOR_TEXT_SECONDARY
            p.alignment = PP_ALIGN.CENTER if j > 0 else PP_ALIGN.LEFT

    # Right side: 3 key value pillars
    pillars = [
        ("Скомпилированное нативное ядро",
         "Бэкенд на Rust с Axum и асинхронным рантаймом Tokio вместо интерпретируемых серверных скриптов.",
         COLOR_GREEN),
        ("Единый настольный комплекс",
         "Tauri v2 объединяет интерфейс оператора, прием GSI, хранилище SQLite и отдачу оверлеев в единое приложение.",
         COLOR_BLUE),
        ("Честная модульная экосистема",
         "Централизованный интерфейс оператора для управления составами, картами, спонсорами и стилями без перезапуска игры.",
         COLOR_GOLD)
    ]

    py = 1.7
    for title_p, text_p, col in pillars:
        add_card(s2, Inches(8.55), Inches(py), Inches(4.0), Inches(1.5), COLOR_SURFACE, COLOR_BORDER)
        # Accent bar
        sb = s2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(8.55), Inches(py), Inches(0.06), Inches(1.5))
        sb.fill.solid()
        sb.fill.fore_color.rgb = col
        sb.line.fill.background()

        tb = s2.shapes.add_textbox(Inches(8.8), Inches(py + 0.12), Inches(3.6), Inches(1.25))
        tf = tb.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = title_p
        p1.font.size = Pt(11)
        p1.font.bold = True
        p1.font.color.rgb = COLOR_TEXT_PRIMARY

        p2 = tf.add_paragraph()
        p2.text = text_p
        p2.font.size = Pt(9.5)
        p2.font.color.rgb = COLOR_TEXT_MUTED
        py += 1.75

    add_footer(s2, 2, 13)
    s2.notes_slide.notes_text_frame.text = (
        "Слайд 2: Инженерное и функциональное обоснование. В отличие от legacy-решений, PROTOKOL объединяет прием GSI, "
        "SQLite-хранилище и управление вещанием в едином нативном приложении с автоматической настройкой конфигов CS2."
    )

    # =========================================================================
    # SLIDE 3: HUD STYLE 1 - CYBER
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3, COLOR_BG)
    add_header(s3, "Стиль HUD 01  •  Киберспорт и стриминг",
               "Fennec Cyber: Футуристичный Sci-Fi и неон",
               "overlays/fennec-cyber  •  Энергичный визуальный стиль с полигональной геометрией",
               COLOR_CYAN)

    # Left: Screenshot
    add_image_with_frame(s3, IMAGE_PATHS["cyber"], Inches(0.8), Inches(1.75), Inches(7.5), Inches(4.22),
                         "Оверлей 1080p: прозрачный радар, статический 2D-фолбэк агента CT/T (не вебкамера).",
                         COLOR_CYAN)

    # Right: Specifications card
    add_card(s3, Inches(8.55), Inches(1.75), Inches(4.0), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_c = s3.shapes.add_textbox(Inches(8.8), Inches(1.95), Inches(3.5), Inches(4.5))
    tf_c = tb_c.text_frame
    tf_c.word_wrap = True

    items_cyber = [
        ("Геометрия", "Скошенные полигональные углы (clip-path: 45°), кибер-сетка и эффект динамического свечения элементов."),
        ("Цветовая схема", "Неоновый циан (#00f0ff) для спецназа (CT) и неоновый пурпур/розовый (#ff007f) для террористов (T)."),
        ("Окно веб-камеры", "Встроенная скошенная 16:9 окантовка с бейджем «LIVE CAM». При отсутствии камеры отображается статический агент."),
        ("Векторный радар", "Чистые неоновые контуры карты CS2 без громоздкого черного фонового квадрата (альфа-прозрачность)."),
        ("Назначение", "Молодежные лиги, шоу-матчи, стримерские турниры, вечерние киберспортивные трансляции.")
    ]

    for idx, (label, desc) in enumerate(items_cyber):
        p_l = tf_c.paragraphs[0] if idx == 0 else tf_c.add_paragraph()
        p_l.text = f"• {label}"
        p_l.font.size = Pt(10.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_CYAN

        p_d = tf_c.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(9.5)
        p_d.font.color.rgb = COLOR_TEXT_MUTED
        if idx < len(items_cyber) - 1:
            p_space = tf_c.add_paragraph()
            p_space.text = ""
            p_space.font.size = Pt(3)

    add_footer(s3, 3, 13)
    s3.notes_slide.notes_text_frame.text = (
        "Слайд 3: Стиль Fennec Cyber. Особенность: энергичная киберспортивная геометрия. "
        "Скриншот демонстрирует прозрачный радар и статический 2D-фолбэк агента спецназа (SAS/CT) при отсутствии активной веб-камеры "
        "(не является видеопотоком камеры, без имитации игрового фона). При подключении камеры окно бесшовно занимает живой видеопоток."
    )

    # =========================================================================
    # SLIDE 4: HUD STYLE 2 - BROADCAST
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4, COLOR_BG)
    add_header(s4, "Стиль HUD 02  •  Телевизионный стандарт",
               "Fennec Broadcast: Чистая студийная эстетика",
               "overlays/fennec-broadcast  •  Минимализм, матовое стекло и телевизионная эргономика",
               COLOR_BLUE)

    # Left: Screenshot
    add_image_with_frame(s4, IMAGE_PATHS["broadcast"], Inches(0.8), Inches(1.75), Inches(7.5), Inches(4.22),
                         "Студийный оверлей: прозрачная миникарта, статический агент CT/T в фокусе (не вебкамера).",
                         COLOR_BLUE)

    # Right: Specifications card
    add_card(s4, Inches(8.55), Inches(1.75), Inches(4.0), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_b = s4.shapes.add_textbox(Inches(8.8), Inches(1.95), Inches(3.5), Inches(4.5))
    tf_b = tb_b.text_frame
    tf_b.word_wrap = True

    items_broadcast = [
        ("Эргономика ТВ", "Аккуратные скругленные углы (10px), сбалансированное центрирование фокус-панели и окна веб-камеры."),
        ("Эффект матового стекла", "Использование backdrop-filter: blur(16px) для мягкой интеграции поверх любой карты и игровых спецэффектов."),
        ("Цветовая палитра", "Глубокий кобальтовый синий (#1a56db) и благородный янтарный оранжевый (#f59e0b)."),
        ("Типографика", "Крупные, четко считываемые цифры здоровья, патронов и статус саппорт-утилит команд."),
        ("Назначение", "Студийные трансляции, профессиональные лиги, форматы уровня PGL / BLAST.")
    ]

    for idx, (label, desc) in enumerate(items_broadcast):
        p_l = tf_b.paragraphs[0] if idx == 0 else tf_b.add_paragraph()
        p_l.text = f"• {label}"
        p_l.font.size = Pt(10.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_BLUE

        p_d = tf_b.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(9.5)
        p_d.font.color.rgb = COLOR_TEXT_MUTED
        if idx < len(items_broadcast) - 1:
            p_space = tf_b.add_paragraph()
            p_space.text = ""
            p_space.font.size = Pt(3)

    add_footer(s4, 4, 13)
    s4.notes_slide.notes_text_frame.text = (
        "Слайд 4: Fennec Broadcast — эталонный пак по чистоте верстки. "
        "На скриншоте показан прозрачный радар и статический 2D-фолбэк агента террористов при отсутствии видеопотока "
        "(не вебкамера, без наложения фейкового геймплея). Аккуратное центрирование камеры над карточкой фокуса."
    )

    # =========================================================================
    # SLIDE 5: HUD STYLE 3 - CHAMPIONSHIP
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5, COLOR_BG)
    add_header(s5, "Стиль HUD 03  •  Премиум и Гранд-Финал",
               "Fennec Championship: Оникс и королевское золото",
               "overlays/fennec-championship  •  Пакет для решающих стадий и гранд-финалов чемпионатов",
               COLOR_GOLD)

    # Left: Screenshot
    add_image_with_frame(s5, IMAGE_PATHS["championship"], Inches(0.8), Inches(1.75), Inches(7.5), Inches(4.22),
                         "Золотой HUD: прозрачный радар, однострочные ростеры, статический агент CT/T (не вебкамера).",
                         COLOR_GOLD)

    # Right: Specifications card
    add_card(s5, Inches(8.55), Inches(1.75), Inches(4.0), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_g = s5.shapes.add_textbox(Inches(8.8), Inches(1.95), Inches(3.5), Inches(4.5))
    tf_g = tb_g.text_frame
    tf_g.word_wrap = True

    items_champ = [
        ("Премиальный визуал", "Глубокий оникс (#0d0f14), металлический графит и градиентное королевское золото (#ffd700)."),
        ("Статус решающего матча", "Золотой шеврон первенства, акцентные полосы активности раунда и победные фреймы."),
        ("Рамка веб-камеры", "Двойная металлическая окантовка 2px с золотым шильдиком никнейма и KDA активного игрока."),
        ("Коррекция типографики", "Верифицирована посадка составных никнеймов без переносов слов на всех разрешениях."),
        ("Назначение", "Финальные стадии, арена-трансляции, турнирные серии и шоу-матчи.")
    ]

    for idx, (label, desc) in enumerate(items_champ):
        p_l = tf_g.paragraphs[0] if idx == 0 else tf_g.add_paragraph()
        p_l.text = f"• {label}"
        p_l.font.size = Pt(10.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_GOLD

        p_d = tf_g.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(9.5)
        p_d.font.color.rgb = COLOR_TEXT_MUTED
        if idx < len(items_champ) - 1:
            p_space = tf_g.add_paragraph()
            p_space.text = ""
            p_space.font.size = Pt(3)

    add_footer(s5, 5, 13)
    s5.notes_slide.notes_text_frame.text = (
        "Слайд 5: Стиль Championship. Скриншот фиксирует прозрачный радар и статический 2D-фолбэк агента спецназа (SAS) "
        "вместо видеопотока веб-камеры (без фейкового фона геймплея). Подтверждена стабильная однострочная верстка ростеров при длинных никнеймах игроков."
    )

    # =========================================================================
    # SLIDE 6: WEBCAM INTEGRATION & DUAL-MODE
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6, COLOR_BG)
    add_header(s6, "Интеграция видео  •  Player Camera Engine",
               "Двухрежимная система отображения веб-камер",
               "Автоматическая привязка видеопотоков к SteamID64 и бесшовное переключение при смене спектатора")

    # Left: Screenshot of preview modal
    add_image_with_frame(s6, IMAGE_PATHS["manager_preview"], Inches(0.8), Inches(1.75), Inches(7.5), Inches(4.22),
                         "Интерфейс встроенного тестирования камеры игрока в Tauri Manager (HTML5 / direct video).",
                         COLOR_AMBER)

    # Right: Architecture description
    add_card(s6, Inches(8.55), Inches(1.75), Inches(4.0), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_w = s6.shapes.add_textbox(Inches(8.8), Inches(1.95), Inches(3.5), Inches(4.5))
    tf_w = tb_w.text_frame
    tf_w.word_wrap = True

    items_webcam = [
        ("Режим 1: Offline / Без стримера",
         "Если у игрока нет физической камеры, в 16:9 окне отображается высококачественный 3D-рендер бодишота активного агента CS2 с градиентным угасанием."),
        ("Режим 2: Live Cam (?cam=live)",
         "При включении камеры бодишот скрывается, а окно становится прозрачным (100%), обрамляясь фирменной рамкой выбранного стиля оверлея."),
        ("Поддержка источников",
         "Прямые потоки Direct Video (HLS, WebM, MP4) либо встраиваемые iframe-ссылки VDO.Ninja с автоматическим глушением звука (muted)."),
        ("Тестирование из GUI",
         "Оператор может проверить статус потока каждого игрока в один клик прямо из таблицы управления камерами.")
    ]

    for idx, (label, desc) in enumerate(items_webcam):
        p_l = tf_w.paragraphs[0] if idx == 0 else tf_w.add_paragraph()
        p_l.text = f"• {label}"
        p_l.font.size = Pt(10.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_AMBER

        p_d = tf_w.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(9.5)
        p_d.font.color.rgb = COLOR_TEXT_MUTED
        if idx < len(items_webcam) - 1:
            p_space = tf_w.add_paragraph()
            p_space.text = ""
            p_space.font.size = Pt(3)

    add_footer(s6, 6, 13)
    s6.notes_slide.notes_text_frame.text = (
        "Слайд 6: Архитектура вебкамер. Главное преимущество — оверлей никогда не выглядит сломанным или пустым. "
        "Если физической камеры нет, зритель видит статический аватар агента CS2 (надежный фолбэк). Если камера подключена — она идеально встает в вырез."
    )

    # =========================================================================
    # SLIDE 7: OPERATOR WORKFLOW & DESKTOP GUI
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_background(s7, COLOR_BG)
    add_header(s7, "Рабочее место оператора  •  Control Plane",
               "Централизованный нативный пульт управления трансляцией",
               "Современный интерфейс на Vue 3 + Tailwind CSS с полным контролем сущностей матча")

    # Left: Screenshot of manager desktop
    add_image_with_frame(s7, IMAGE_PATHS["manager_desktop"], Inches(0.8), Inches(1.75), Inches(7.5), Inches(4.22),
                         "Экран управления HUD-паками: переключение активного стиля, быстрый экспорт URL для OBS.",
                         COLOR_BLUE)

    # Right: Workflow steps
    add_card(s7, Inches(8.55), Inches(1.75), Inches(4.0), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_op = s7.shapes.add_textbox(Inches(8.8), Inches(1.95), Inches(3.5), Inches(4.5))
    tf_op = tb_op.text_frame
    tf_op.word_wrap = True

    steps = [
        ("1. Автоконфигурация CS2 GSI",
         "Менеджер самостоятельно находит директорию игры в реестре Windows и генерирует конфигурационный файл gamestate_integration_protokol.cfg."),
        ("2. Выбор активного стиля",
         "Переключение между Cyber, Broadcast и Championship в один клик. Возможность тонкой настройки отображения радара и утилит."),
        ("3. Экспорт в OBS Studio / vMix",
         "Кнопка быстрого копирования Browser Source URL (1080p60) исключает ошибки ручного набора адресов режиссером эфира."),
        ("4. Управление ростерами и спонсорами",
         "Редактирование названий команд, логотипов, спонсорских плашек и связок SteamID игроков в локальной базе SQLite.")
    ]

    for idx, (label, desc) in enumerate(steps):
        p_l = tf_op.paragraphs[0] if idx == 0 else tf_op.add_paragraph()
        p_l.text = label
        p_l.font.size = Pt(10.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_BLUE

        p_d = tf_op.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(9.5)
        p_d.font.color.rgb = COLOR_TEXT_MUTED
        if idx < len(steps) - 1:
            p_space = tf_op.add_paragraph()
            p_space.text = ""
            p_space.font.size = Pt(3)

    add_footer(s7, 7, 13)
    s7.notes_slide.notes_text_frame.text = (
        "Слайд 7: Рабочий процесс оператора трансляции. "
        "Продукт избавляет оператора от работы с консолями, конфигами вручную или перезапусками игры."
    )

    # =========================================================================
    # SLIDE 8: TECHNICAL ARCHITECTURE & DATA FLOW
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    set_slide_background(s8, COLOR_BG)
    add_header(s8, "Инженерия и архитектура",
               "Архитектура сквозного конвейера данных (Data Flow)",
               "Обработка пакетов Valve CS2 GSI и векторный радар на 18 соревновательных карт")

    # Architecture Cards (3 horizontally or grid)
    # Box 1: Ingestion
    c1 = add_card(s8, Inches(0.8), Inches(1.75), Inches(3.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_a1 = s8.shapes.add_textbox(Inches(1.0), Inches(1.95), Inches(3.3), Inches(4.5))
    tf_a1 = tb_a1.text_frame
    tf_a1.word_wrap = True
    p = tf_a1.paragraphs[0]
    p.text = "1. ПРИЕМ ДАННЫХ (GSI)"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_CYAN

    bullets_1 = [
        "Порт :1349 (HTTP Axum 0.7)",
        "Прием JSON-пейлоадов от движка CS2 по спецификации GSI.",
        "Совместимый порт-мост :31982 с проверкой токена авторизации.",
        "Парсинг SteamID наблюдаемого игрока с автоматическим фолбэком.",
        "Трекинг фрагов раунда (round_kills) для индикации на карточке."
    ]
    for b in bullets_1:
        p_b = tf_a1.add_paragraph()
        p_b.text = f"• {b}"
        p_b.font.size = Pt(9.5)
        p_b.font.color.rgb = COLOR_TEXT_SECONDARY

    # Box 2: Core Processing & Storage
    c2 = add_card(s8, Inches(4.8), Inches(1.75), Inches(3.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_a2 = s8.shapes.add_textbox(Inches(5.0), Inches(1.95), Inches(3.3), Inches(4.5))
    tf_a2 = tb_a2.text_frame
    tf_a2.word_wrap = True
    p = tf_a2.paragraphs[0]
    p.text = "2. ЯДРО И БАЗА ДАННЫХ"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_GOLD

    bullets_2 = [
        "In-Memory State (Tokio)",
        "Атомарное обновление структуры MatchSnap в асинхронном рантайме.",
        "База SQLite в режиме WAL (Write-Ahead Logging) для персистентности сессий.",
        "Асинхронные задачи Tokio для записи истории без блокировки сетевого цикла.",
        "Компактный нативный бинарник без тяжелого виртуального окружения."
    ]
    for b in bullets_2:
        p_b = tf_a2.add_paragraph()
        p_b.text = f"• {b}"
        p_b.font.size = Pt(9.5)
        p_b.font.color.rgb = COLOR_TEXT_SECONDARY

    # Box 3: Broadcast & Vector Radar
    c3 = add_card(s8, Inches(8.8), Inches(1.75), Inches(3.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_a3 = s8.shapes.add_textbox(Inches(9.0), Inches(1.95), Inches(3.3), Inches(4.5))
    tf_a3 = tb_a3.text_frame
    tf_a3.word_wrap = True
    p = tf_a3.paragraphs[0]
    p.text = "3. РЕНДЕР И РАДАР (OBS)"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_GREEN

    bullets_3 = [
        "WebSocket Broadcast (Realtime)",
        "Событийная доставка обновлений состояния матча в оверлеи OBS Studio.",
        "Векторный радар CS2 (18 карт, 78 конфигураций уровней).",
        "Прозрачный альфа-канал без черного фона с контурным свечением.",
        "Точный перевод мировых координат Valve Source Engine без инверсии масштаба."
    ]
    for b in bullets_3:
        p_b = tf_a3.add_paragraph()
        p_b.text = f"• {b}"
        p_b.font.size = Pt(9.5)
        p_b.font.color.rgb = COLOR_TEXT_SECONDARY

    add_footer(s8, 8, 13)
    s8.notes_slide.notes_text_frame.text = (
        "Слайд 8: Архитектурная надежность. Разделение ответственности: сетевой GSI-приемник на Rust Axum, "
        "раздача событий по WebSocket в оверлеи и асинхронное сохранение сессий в SQLite WAL."
    )

    # =========================================================================
    # SLIDE 9: RELEASE READINESS & HONEST QA STATUS
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    set_slide_background(s9, COLOR_BG)
    add_header(s9, "Контроль качества  •  Verification Evidence",
               "Честный статус готовности релизных компонентов",
               "Результаты комплексного тестирования в изолированной Linux-песочнице и границы текущей валидации")

    # Left: Verified achievements
    add_card(s9, Inches(0.8), Inches(1.75), Inches(5.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_v1 = s9.shapes.add_textbox(Inches(1.0), Inches(1.95), Inches(5.3), Inches(4.5))
    tf_v1 = tb_v1.text_frame
    tf_v1.word_wrap = True
    p = tf_v1.paragraphs[0]
    p.text = "ПОДТВЕРЖДЕНО ТЕСТАМИ (VERIFIED)"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_GREEN

    v_items = [
        ("E2E тесты веб-камер 3 HUD", "Успешно декодируются видеокадры, muted playback, сохранение DOM при пакетах GSI, переключение фокуса между игроками."),
        ("Геометрия оверлеев", "Проверено на разрешениях 1280×720, 1920×1080 и 2560×1440. Отсутствуют наложения блоков и выходы за границы экрана."),
        ("Типографика ростеров", "Математически подтверждена однострочная посадка длинных никнеймов игроков через Range.getClientRects."),
        ("Бэкенд-инженерия", "33 E2E теста бэкенда пройдены успешно; 36 модульных тестов библиотеки и 5 интеграционных тестов camera_storage выполнены без ошибок."),
        ("Пакет Linux DEB", "Tauri/WebKit CRUD и превью полностью валидированы в среде Ubuntu Noble.")
    ]

    for label, desc in v_items:
        p_l = tf_v1.add_paragraph()
        p_l.text = f"✓ {label}: "
        p_l.font.size = Pt(9.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_GREEN

        p_d = tf_v1.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(9)
        p_d.font.color.rgb = COLOR_TEXT_SECONDARY

    # Right: Limitations & Honest Boundaries
    add_card(s9, Inches(6.8), Inches(1.75), Inches(5.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_v2 = s9.shapes.add_textbox(Inches(7.0), Inches(1.95), Inches(5.3), Inches(4.5))
    tf_v2 = tb_v2.text_frame
    tf_v2.word_wrap = True
    p = tf_v2.paragraphs[0]
    p.text = "ГРАНИЦЫ ВАЛИДАЦИИ И ОГРАНИЧЕНИЯ (HONEST DISCLOSURE)"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_AMBER

    l_items = [
        ("Windows Runtime верификация",
         "Сборка protokol-hud-manager.exe (18.8 МБ) и NSIS установщика (114 МБ) успешно скомпилирована. Заголовки PE и контрольные суммы SHA-256 проверены. "
         "Финальное подтверждение нативного Windows GUI остается открытым (signoff pending) до ручной приемки в среде с системным WebView2."),
        ("Синтетические видеофид-фикстуры",
         "Текущие скриншоты оверлеев используют сгенерированные тестовые таблицы (SMPTE таймкод), а не живые потоки VDO.Ninja реального турнира. "
         "Сквозная турнирная сессия CS2 в боевых условиях пока не подтверждена."),
        ("Отсутствие невалидированных бенчмарков",
         "В релизных материалах исключены неподтвержденные бенчмарки RAM и задержек, а также громкие маркетинговые статусы. Текущая версия приложения — 0.1.0.")
    ]

    for label, desc in l_items:
        p_l = tf_v2.add_paragraph()
        p_l.text = f"• {label}: "
        p_l.font.size = Pt(9.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_AMBER

        p_d = tf_v2.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(9)
        p_d.font.color.rgb = COLOR_TEXT_SECONDARY

    add_footer(s9, 9, 13)
    s9.notes_slide.notes_text_frame.text = (
        "Слайд 9: Прозрачный статус контроля качества. "
        "Инженерная честность: четко фиксируем, что доказано автотестами (36 тестов библиотеки, 5 тестов хранилища, 33 backend E2E), "
        "а что требует приемки на физической Windows-машине и в боевой CS2 турнирной сессии."
    )

    # =========================================================================
    # SLIDE 10: STRATEGIC SUMMARY & ROADMAP
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    set_slide_background(s10, COLOR_BG)
    add_header(s10, "Итоги и дорожная карта  •  Strategic Vision",
               "Готовность к внедрению и вектор технологического развития",
               "Надежная основа для эфиров CS2 с понятным планом функционального масштабирования")

    # Left: Strategic Outcomes
    add_card(s10, Inches(0.8), Inches(1.75), Inches(5.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_s1 = s10.shapes.add_textbox(Inches(1.0), Inches(1.95), Inches(5.3), Inches(4.5))
    tf_s1 = tb_s1.text_frame
    tf_s1.word_wrap = True
    p = tf_s1.paragraphs[0]
    p.text = "КЛЮЧЕВЫЕ ВЫГОДЫ ДЛЯ ТУРНИРА"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_GOLD

    s_items = [
        ("Снижение риска сбоев эфира", "Отказ от внешнего рантайма Node.js и тяжелых промежуточных сервисов в пользу скомпилированного нативного бэкенда."),
        ("Премиальная картинка трансляции", "Три готовых самобытных стиля оверлеев (Cyber, Broadcast, Championship) закрывают потребности любых форматов — от региональных квалификаций до гранд-финалов."),
        ("Быстрый старт вещания", "Автогенерация GSI конфига и единая кнопка экспорта OBS Browser Source минимизируют человеческий фактор при настройке."),
        ("Легкая замена графических материалов", "Модульная структура позволяет оперативно брендировать HUD под спонсоров и партнеров турнира.")
    ]

    for label, desc in s_items:
        p_l = tf_s1.add_paragraph()
        p_l.text = f"★ {label}: "
        p_l.font.size = Pt(9.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_GOLD

        p_d = tf_s1.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(9)
        p_d.font.color.rgb = COLOR_TEXT_SECONDARY

    # Right: Roadmap
    add_card(s10, Inches(6.8), Inches(1.75), Inches(5.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_s2 = s10.shapes.add_textbox(Inches(7.0), Inches(1.95), Inches(5.3), Inches(4.5))
    tf_s2 = tb_s2.text_frame
    tf_s2.word_wrap = True
    p = tf_s2.paragraphs[0]
    p.text = "ПЛАН РАЗВИТИЯ СИСТЕМЫ (ROADMAP v0.2+)"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_CYAN

    road_items = [
        ("WebRTC WebCam Hub", "Встроенный сервер WebRTC в ядре Axum для прямого подключения мобильных телефонов игроков как вебкамер по QR-коду без сторонних платформ."),
        ("Интерактивный Theme Customizer", "Возможность кастомизировать градиенты и фирменные цвета команд прямо из графического интерфейса менеджера без правки CSS."),
        ("Интеграция HLTV / Liquipedia API", "Автоматическая подгрузка актуальных аватаров игроков, истории встреч и турнирной сетки по коду матча."),
        ("Событийный аудио-движок оверлея", "Синхронное воспроизведение саунд-эффектов (таймер C4, анонс Ace, победный гонг) напрямую в аудиодорожку браузерного источника OBS.")
    ]

    for label, desc in road_items:
        p_l = tf_s2.add_paragraph()
        p_l.text = f"➔ {label}: "
        p_l.font.size = Pt(9.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_CYAN

        p_d = tf_s2.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(9)
        p_d.font.color.rgb = COLOR_TEXT_SECONDARY

    add_footer(s10, 10, 13)
    s10.notes_slide.notes_text_frame.text = (
        "Слайд 10: Финальное резюме. Зафиксированы подтвержденные возможности версии 0.1.0, "
        "границы текущей верификации и практический план дальнейшего развития продукта."
    )

    # =========================================================================
    # SLIDE 11: INSTALLATION, RUN & CS2 GSI INTEGRATION
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    set_slide_background(s11, COLOR_BG)
    add_header(s11, "Развёртывание и телеметрия  •  Practical Onboarding",
               "Установка, запуск и интеграция CS2 GSI",
               "Развёртывание бинарника v0.1.0, авто-конфигурация CS2 cfg и ключевое разделение потоков наблюдателя",
               COLOR_CYAN)

    # Box 1: Ingestion & Launch
    c11_1 = add_card(s11, Inches(0.8), Inches(1.75), Inches(3.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_11_1 = s11.shapes.add_textbox(Inches(1.0), Inches(1.95), Inches(3.3), Inches(4.5))
    tf_11_1 = tb_11_1.text_frame
    tf_11_1.word_wrap = True
    p = tf_11_1.paragraphs[0]
    p.text = "1. ЗАПУСК И ПУТИ ДАННЫХ"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_CYAN

    items_11_1 = [
        ("Бинарник", "Запуск protokol-hud-manager.exe (18.8 МБ). SmartScreen: «Подробнее» → «Выполнить в любом случае»."),
        ("База данных SQLite WAL", "Автосоздание рабочей БД %APPDATA%\\PROTOKOL HUD\\protokol.db со всеми таблицами при старте."),
        ("Сетевой порт ядра :1349", "HTTP/WebSocket сервер слушает http://127.0.0.1:1349 с автоперебором fallback-портов до :1359."),
        ("Каталог оверлеев", "Паки раздаются строго из %APPDATA%\\PROTOKOL HUD\\overlays\\ по URL /overlay/<pack>/."),
    ]
    for label, desc in items_11_1:
        p_l = tf_11_1.add_paragraph()
        p_l.text = f"• {label}: "
        p_l.font.size = Pt(9.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_CYAN
        p_d = tf_11_1.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(8.5)
        p_d.font.color.rgb = COLOR_TEXT_SECONDARY

    # Box 2: CS2 GSI Config
    c11_2 = add_card(s11, Inches(4.8), Inches(1.75), Inches(3.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_11_2 = s11.shapes.add_textbox(Inches(5.0), Inches(1.95), Inches(3.3), Inches(4.5))
    tf_11_2 = tb_11_2.text_frame
    tf_11_2.word_wrap = True
    p = tf_11_2.paragraphs[0]
    p.text = "2. КОНФИГУРАЦИЯ CS2 GSI"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_GOLD

    items_11_2 = [
        ("Автопоиск каталога CS2", "Кнопка «Установить GSI cfg в CS2» в Настройках автоматически находит путь к игре на дисках C:..Z:."),
        ("Точный путь к cfg", "Создается в <Steam>\\...\\game\\csgo\\cfg\\gamestate_integration_protokol.cfg с URI /api/gsi."),
        ("Авторизация auth.token", "UUID v4 токен генерируется в таблице настроек и отсекает посторонний трафик (401 Unauthorized)."),
        ("Холодный старт CS2", "CS2 считывает GSI-конфиги только при старте: если игра была открыта, требуется полный перезапуск."),
    ]
    for label, desc in items_11_2:
        p_l = tf_11_2.add_paragraph()
        p_l.text = f"• {label}: "
        p_l.font.size = Pt(9.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_GOLD
        p_d = tf_11_2.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(8.5)
        p_d.font.color.rgb = COLOR_TEXT_SECONDARY

    # Box 3: Observer vs POV
    c11_3 = add_card(s11, Inches(8.8), Inches(1.75), Inches(3.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_11_3 = s11.shapes.add_textbox(Inches(9.0), Inches(1.95), Inches(3.3), Inches(4.5))
    tf_11_3 = tb_11_3.text_frame
    tf_11_3.word_wrap = True
    p = tf_11_3.paragraphs[0]
    p.text = "3. НАБЛЮДАТЕЛЬ VS POV / DEDICATED"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_BLUE

    items_11_3 = [
        ("Клиент наблюдателя (GOTV)", "ОБЯЗАТЕЛЬНО: только спектатор получает от CS2 полный дамп allplayers_* по 10 игрокам."),
        ("Ограничение POV-клиента", "Клиент обычного игрока из античит-соображений не шлет чужие данные: оверлей и радар останутся пустыми."),
        ("Выделенный сервер", "Прямой GSI с Dedicated Server возможен, но для локального вещания стандартом является клиент обсервера."),
        ("Сетевой обсервер", "При отдельном ПК обсервера в cfg указывается IP эфирного ПК и открывается порт 1349 TCP в Firewall."),
    ]
    for label, desc in items_11_3:
        p_l = tf_11_3.add_paragraph()
        p_l.text = f"• {label}: "
        p_l.font.size = Pt(9.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_BLUE
        p_d = tf_11_3.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(8.5)
        p_d.font.color.rgb = COLOR_TEXT_SECONDARY

    add_footer(s11, 11, 13)
    s11.notes_slide.notes_text_frame.text = (
        "Слайд 11: Практическое развёртывание и настройка CS2 GSI. "
        "Акцент на критическом требовании Valve: полные данные по всем 10 игрокам и радару передаются исключительно на клиент наблюдателя (GOTV / Spectator), "
        "а не на обычный клиент игрока (POV). Настройка конфига выполняется в один клик из интерфейса Настроек менеджера."
    )

    # =========================================================================
    # SLIDE 12: OBS STUDIO & HUD PACK MANAGEMENT
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    set_slide_background(s12, COLOR_BG)
    add_header(s12, "Эфирный сетап  •  Production & Pack Management",
               "Настройка OBS Studio и управление HUD-паками",
               "Параметры Browser Source, прозрачный альфа-канал, защита WebSocket и безопасный импорт оверлеев из ZIP",
               COLOR_BLUE)

    # Left: OBS Browser Source
    add_card(s12, Inches(0.8), Inches(1.75), Inches(5.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_12_1 = s12.shapes.add_textbox(Inches(1.0), Inches(1.95), Inches(5.3), Inches(4.5))
    tf_12_1 = tb_12_1.text_frame
    tf_12_1.word_wrap = True
    p = tf_12_1.paragraphs[0]
    p.text = "ИНТЕГРАЦИЯ В OBS STUDIO (BROWSER SOURCE)"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_BLUE

    items_12_obs = [
        ("Параметры Browser Source", "URL: http://127.0.0.1:1349/overlay/<pack>/index.html. Разрешение строго 1920×1080 @ 60 FPS, поле Custom CSS оставить пустым."),
        ("Критический флаг: Источник видим", "СНИМИТЕ флаг: «Завершать захват, когда источник невидим». Иначе при смене сцен рвется сокет /ws и HUD заново инициализируется с задержкой."),
        ("Критический флаг: Без перезагрузки", "СНИМИТЕ флаг: «Перезагружать браузер, когда сцена становится активной». Включите аппаратное ускорение браузера в OBS."),
        ("Прозрачный фон и сброс кэша", "Оверлеи имеют background: transparent поверх захвата игры. При обновлении CSS/JS: Правый клик в OBS → «Обновить кэш текущей страницы»."),
        ("OBS WebSocket v5 (порт :4455)", "Переключение сцен (Match, Casters, Replay) и запуск трансляции/записи напрямую из вкладки «Трансляция» PROTOKOL менеджера."),
    ]
    for label, desc in items_12_obs:
        p_l = tf_12_1.add_paragraph()
        p_l.text = f"• {label}: "
        p_l.font.size = Pt(9.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_BLUE
        p_d = tf_12_1.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(8.5)
        p_d.font.color.rgb = COLOR_TEXT_SECONDARY

    # Right: Pack Management & Import
    add_card(s12, Inches(6.8), Inches(1.75), Inches(5.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_12_2 = s12.shapes.add_textbox(Inches(7.0), Inches(1.95), Inches(5.3), Inches(4.5))
    tf_12_2 = tb_12_2.text_frame
    tf_12_2.word_wrap = True
    p = tf_12_2.paragraphs[0]
    p.text = "УПРАВЛЕНИЕ И ИМПОРТ HUD-ПАКОВ"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_CYAN

    items_12_packs = [
        ("Каталог раздачи в AppData", "Сервер раздает паки из %APPDATA%\\PROTOKOL HUD\\overlays\\<pack>\\. Старые паки OpenHUD мигрируют автоматически при старте."),
        ("Импорт паков из ZIP через GUI", "Вкладка «HUD-паки» → поле «Импорт пака из ZIP» → указать путь и нажать «Установить». Встроена защита от Zip-Slip / Path Traversal."),
        ("Структура автономного пака", "Минимум: index.html, hud.js, hud.css, assets/ и radars.json. Подключение общего транспорта: <script src=\"../_core/core.js\">."),
        ("Мгновенная смена активного HUD", "Выбор стиля в приложении не требует перезапуска OBS: событие hud_activated мгновенно передается открытым оверлеям по WebSocket."),
        ("3 готовых турнирных стиля", "fennec-cyber (неон/скайлайн), fennec-broadcast (ТВ-таблицы/стекло) и fennec-championship (золото/оникс) полностью готовы к эфиру."),
    ]
    for label, desc in items_12_packs:
        p_l = tf_12_2.add_paragraph()
        p_l.text = f"• {label}: "
        p_l.font.size = Pt(9.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_CYAN
        p_d = tf_12_2.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(8.5)
        p_d.font.color.rgb = COLOR_TEXT_SECONDARY

    add_footer(s12, 12, 13)
    s12.notes_slide.notes_text_frame.text = (
        "Слайд 12: Настройка эфирного софта и оверлеев. "
        "Разбор критических настроек OBS Browser Source — предотвращение разрыва WebSocket-канала при переключении сцен. "
        "Демонстрация безопасного импорта паков через ZIP-архивы и раздачи оверлеев из AppData."
    )

    # =========================================================================
    # SLIDE 13: CAMERAS, OPERATOR CHECKLIST & TROUBLESHOOTING
    # =========================================================================
    s13 = prs.slides.add_slide(blank_layout)
    set_slide_background(s13, COLOR_BG)
    add_header(s13, "Надёжность эфира  •  Operations & Diagnostics",
               "Веб-камеры игроков, регламент эфира и диагностика",
               "Привязка SteamID64 к VDO.Ninja, фолбэк на 2D-аватары агентов, чек-лист оператора и устранение сбоев",
               COLOR_GOLD)

    # Left: Webcams & Dynamic Focus
    add_card(s13, Inches(0.8), Inches(1.75), Inches(5.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_13_1 = s13.shapes.add_textbox(Inches(1.0), Inches(1.95), Inches(5.3), Inches(4.5))
    tf_13_1 = tb_13_1.text_frame
    tf_13_1.word_wrap = True
    p = tf_13_1.paragraphs[0]
    p.text = "СИСТЕМА ДИНАМИЧЕСКОГО ФОКУСА ВЕБ-КАМЕР"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_GOLD

    items_13_cams = [
        ("Привязка по 17-значному SteamID64", "Страница «Веб-камеры»: каждый SteamID связывается с видеопотоком. При спектаторстве в CS2 видео монтируется в карточку автоматически."),
        ("Кэширование DOM без мерцания", "Пока спектатор наблюдает за одним игроком, тики GSI не пересоздают DOM-элемент <video>/<iframe> (cameraSlots) и не сбрасывают видеопоток."),
        ("Поддержка VDO.Ninja и Direct Video", "Формат iframe: https://vdo.ninja/?view=...&cleanoutput&transparent. Параметр &muted выставляется ядром принудительно для защиты от эха."),
        ("Штатный Dual-Mode фолбэк на агента", "При отсутствии камеры отображается статический 2D-бодишот агента CS2 (CT/T). Параметр ?cam=live делает вырез прозрачным под камеру OBS."),
        ("Встроенный предпросмотр перед матчем", "Оператор трансляции может проверить видео каждого игрока в модальном плеере менеджера до выхода в эфир."),
    ]
    for label, desc in items_13_cams:
        p_l = tf_13_1.add_paragraph()
        p_l.text = f"• {label}: "
        p_l.font.size = Pt(9.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_GOLD
        p_d = tf_13_1.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(8.5)
        p_d.font.color.rgb = COLOR_TEXT_SECONDARY

    # Right: Operator Checklist & Troubleshooting
    add_card(s13, Inches(6.8), Inches(1.75), Inches(5.7), Inches(4.9), COLOR_SURFACE, COLOR_BORDER)
    tb_13_2 = s13.shapes.add_textbox(Inches(7.0), Inches(1.95), Inches(5.3), Inches(4.5))
    tf_13_2 = tb_13_2.text_frame
    tf_13_2.word_wrap = True
    p = tf_13_2.paragraphs[0]
    p.text = "ЧЕК-ЛИСТ ОПЕРАТОРА И УСТРАНЕНИЕ НЕПОЛАДОК"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = COLOR_AMBER

    items_13_trouble = [
        ("Порядок запуска (Launch Ordering)", "1. Запуск PROTOKOL Manager (:1349) → 2. Запуск OBS Studio → 3. Холодный запуск CS2 (обсервер) → 4. Вход на сервер / GOTV."),
        ("Видно только 1 игрока, радар пустой", "CS2 запущена на обычном клиентском POV-аккаунте. Перейдите в режим наблюдателя (spectator) или GOTV."),
        ("Индикатор Live неактивен, нет данных", "CS2 не перезапускалась после создания cfg; cfg в старой csgo\\cfg\\; не совпадает auth.token; порт 1349 занят (netstat -ano)."),
        ("Чёрный экран оверлея в OBS Studio", "Проверьте URL: /overlay/<name>/index.html (overlay в ед. числе), проверьте файлы в %APPDATA%, обновите кэш Browser Source."),
        ("Веб-камера игрока не отображается", "Проверьте SteamID (ровно 17 цифр), проверьте отсутствие логина/пароля в URL, выберите тип «iframe / VDO.Ninja» для ссылок VDO."),
    ]
    for label, desc in items_13_trouble:
        p_l = tf_13_2.add_paragraph()
        p_l.text = f"• {label}: "
        p_l.font.size = Pt(9.5)
        p_l.font.bold = True
        p_l.font.color.rgb = COLOR_AMBER
        p_d = tf_13_2.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(8.5)
        p_d.font.color.rgb = COLOR_TEXT_SECONDARY

    add_footer(s13, 13, 13)
    s13.notes_slide.notes_text_frame.text = (
        "Слайд 13: Работа с веб-камерами и регламент оператора. "
        "Гарантия стабильности: система кэширования DOM предотвращает мерцание видеопотоков, а при отсутствии веб-камеры включается статический аватар агента. "
        "Чек-лист и типовые сценарии устранения неполадок обеспечивают готовность технической бригады к любым инцидентам."
    )

    prs.save(out_path)
    print(f"Presentation saved successfully: {out_path}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE_DIR, "protokol-presentation.pptx")
    build_presentation(out_file)
