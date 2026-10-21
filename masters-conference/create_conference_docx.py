import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import numpy as np
from docx import Document
from docx.shared import Cm, Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


def set_columns(section, num_cols, space="720"):
    sect_pr = section._sectPr
    cols = sect_pr.xpath('./w:cols')
    if cols:
        cols = cols[0]
    else:
        cols = OxmlElement('w:cols')
        sect_pr.append(cols)
    cols.set(qn('w:num'), str(num_cols))
    cols.set(qn('w:space'), space)


def set_font(run, name='Times New Roman', size=Pt(10), bold=False, italic=False,
             superscript=False, subscript=False):
    run.font.name = name
    run._element.rPr.rFonts.set(qn('w:eastAsia'), name)
    run.font.size = size
    run.font.bold = bold
    run.font.italic = italic
    run.font.superscript = superscript
    run.font.subscript = subscript


def save_equation(latex, path, fontsize=13):
    """Render a LaTeX math string as a PNG image."""
    fig = plt.figure(figsize=(6, 0.5))
    fig.text(0.5, 0.5, f'${latex}$', fontsize=fontsize,
             ha='center', va='center')
    plt.axis('off')
    plt.savefig(path, dpi=200, bbox_inches='tight', pad_inches=0.05)
    plt.close(fig)


def save_figure1(path):
    """Vertical architecture flowchart."""
    fig, ax = plt.subplots(figsize=(3.5, 4.5))
    ax.set_xlim(0, 4)
    ax.set_ylim(0, 6)
    ax.axis('off')

    boxes = [
        (0.5, 5, 'Sensing: CT +\naccelerometer'),
        (0.5, 4, 'Signal\nconditioning'),
        (0.5, 3, 'Feature\nextraction'),
        (0.5, 2, 'PLC decision\nand fusion'),
        (0.5, 1, 'HMI/SCADA'),
    ]
    for x, y, text in boxes:
        rect = FancyBboxPatch((x, y - 0.25), 3, 0.5,
                              boxstyle="round,pad=0.05",
                              facecolor='#e6e6e6', edgecolor='black')
        ax.add_patch(rect)
        ax.text(x + 1.5, y, text, ha='center', va='center', fontsize=8)

    for i in range(len(boxes) - 1):
        ax.annotate('', xy=(2, boxes[i + 1][1] + 0.25),
                    xytext=(2, boxes[i][1] - 0.25),
                    arrowprops=dict(arrowstyle='->', lw=1.5))

    plt.tight_layout()
    plt.savefig(path, dpi=200, bbox_inches='tight')
    plt.close(fig)


def save_figure2(path):
    """Signal processing and fusion chain."""
    fig, ax = plt.subplots(figsize=(6.5, 2.6))
    ax.set_xlim(0, 7)
    ax.set_ylim(0, 3)
    ax.axis('off')

    nodes = [
        (0.5, 2.2, 'current\nsensor'),
        (1.7, 2.2, 'current\nfeatures'),
        (2.9, 2.2, 'normalised\n$C$'),
        (0.5, 0.8, 'accelerometer'),
        (1.7, 0.8, 'vibration\nfeatures'),
        (2.9, 0.8, 'normalised\n$V$'),
        (4.4, 1.5, 'fusion\nscore $S$'),
        (5.9, 1.5, 'state\ndecision'),
    ]
    for x, y, text in nodes:
        rect = FancyBboxPatch((x - 0.3, y - 0.25), 0.6, 0.5,
                              boxstyle="round,pad=0.02",
                              facecolor='#e6e6e6', edgecolor='black')
        ax.add_patch(rect)
        ax.text(x, y, text, ha='center', va='center', fontsize=7)

    arrows = [
        ((0.8, 2.2), (1.4, 2.2)),
        ((2.0, 2.2), (2.6, 2.2)),
        ((0.8, 0.8), (1.4, 0.8)),
        ((2.0, 0.8), (2.6, 0.8)),
        ((3.2, 2.0), (4.1, 1.75)),
        ((3.2, 1.0), (4.1, 1.25)),
        ((4.7, 1.5), (5.6, 1.5)),
    ]
    for start, end in arrows:
        ax.annotate('', xy=end, xytext=start,
                    arrowprops=dict(arrowstyle='->', lw=1))

    plt.tight_layout()
    plt.savefig(path, dpi=200, bbox_inches='tight')
    plt.close(fig)


def save_figure3(path):
    """Illustrative comparison bar chart."""
    fig, ax = plt.subplots(figsize=(4.5, 3.2))
    approaches = ['Current only', 'Vibration only', 'Fused']
    electrical = [70, 35, 85]
    mechanical = [30, 80, 90]
    confidence = [35, 35, 80]

    x = np.arange(len(approaches))
    width = 0.22

    ax.bar(x - width, electrical, width, label='Electrical', color='#999999')
    ax.bar(x, mechanical, width, label='Mechanical', color='#bfbfbf')
    ax.bar(x + width, confidence, width, label='Confidence', color='#d9d9d9')

    ax.set_ylabel('Relative score', fontsize=8)
    ax.set_xlabel('Approach', fontsize=8)
    ax.set_xticks(x)
    ax.set_xticklabels(approaches, fontsize=7)
    ax.set_ylim(0, 100)
    ax.legend(fontsize=7, loc='upper center', ncol=3)
    ax.tick_params(axis='both', labelsize=7)

    plt.tight_layout()
    plt.savefig(path, dpi=200, bbox_inches='tight')
    plt.close(fig)


def add_image_centered(doc, path, width=Inches(3.0)):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(path, width=width)


def add_centered_heading(doc, text, size=Pt(17), bold=True):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    set_font(run, size=size, bold=bold)
    return p


def add_body_heading(doc, text, size=Pt(10)):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(3)
    run = p.add_run(text)
    set_font(run, size=size, bold=True)
    return p


def add_paragraph(doc, text, bold_prefix=None, size=Pt(10),
                  alignment=WD_ALIGN_PARAGRAPH.JUSTIFY,
                  first_line_indent=Cm(0.5)):
    p = doc.add_paragraph()
    p.alignment = alignment
    p.paragraph_format.first_line_indent = first_line_indent if first_line_indent else None
    if bold_prefix:
        r = p.add_run(bold_prefix)
        set_font(r, size=size, bold=True)
        if text:
            r = p.add_run(text)
            set_font(r, size=size)
    else:
        r = p.add_run(text)
        set_font(r, size=size)
    return p


# Create image assets
img_dir = 'docx_images'
os.makedirs(img_dir, exist_ok=True)

save_equation(r'I_{\mathrm{RMS}} = \sqrt{\frac{1}{N}\sum_{k=1}^{N} i_k^2}',
              os.path.join(img_dir, 'eq1.png'))
save_equation(r'\mathrm{Crest\;Factor} = \frac{\max(|x_k|)}{X_{\mathrm{RMS}}}',
              os.path.join(img_dir, 'eq2.png'))
save_equation(r'S = w_c C + w_v V,\quad w_c + w_v = 1',
              os.path.join(img_dir, 'eq3.png'))

save_figure1(os.path.join(img_dir, 'fig1.png'))
save_figure2(os.path.join(img_dir, 'fig2.png'))
save_figure3(os.path.join(img_dir, 'fig3.png'))

# Create document
doc = Document()

# Margins
s = doc.sections[0]
s.top_margin = Cm(2.5)
s.right_margin = Cm(2.0)
s.bottom_margin = Cm(3.0)
s.left_margin = Cm(3.0)
set_columns(s, 1)

# Title
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run('PLC Based Multi Sensor Condition Monitoring of Industrial Motors for Industrial Transformation')
set_font(run, size=Pt(17), bold=True)

# Authors
authors = doc.add_paragraph()
authors.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = authors.add_run('TAKUNDA PAMBAYI')
set_font(run, size=Pt(12))
run = authors.add_run('*')
set_font(run, size=Pt(12), superscript=True)
run = authors.add_run(' and ENG TANAKA D DZAPASI')
set_font(run, size=Pt(12))
run = authors.add_run('**')
set_font(run, size=Pt(12), superscript=True)

# Affiliation
aff = doc.add_paragraph()
aff.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = aff.add_run('Harare Institute of Technology, Harare, Zimbabwe')
set_font(run, size=Pt(10))

# Abstract
abstract = doc.add_paragraph()
abstract.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
run = abstract.add_run('Abstract. ')
set_font(run, size=Pt(10), bold=True)
run = abstract.add_run(
    'Industrial motors drive pumps, compressors, fans and conveyors. Unexpected failure stops production. '
    'This paper presents a practical condition monitoring framework that uses a programmable logic controller '
    'to combine motor electrical current and mechanical vibration. Time and frequency domain features are fused '
    'to classify normal, warning and critical states. The work suits plants that already have PLC infrastructure '
    'and need an affordable step from preventive to condition based maintenance.'
)
set_font(run, size=Pt(10))

# Keywords
kw = doc.add_paragraph()
kw.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
run = kw.add_run('Key words: ')
set_font(run, size=Pt(10), bold=True)
run = kw.add_run('PLC, condition monitoring, induction motor, multi sensor fusion, predictive maintenance.')
set_font(run, size=Pt(10))

# Correspondence
corr = doc.add_paragraph()
corr.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
run = corr.add_run('Address for correspondence: ')
set_font(run, size=Pt(9), bold=True)
run = corr.add_run('Takunda Pambayi, Harare Institute of Technology, Ganges Road, Harare, Zimbabwe; e-mail: tpambayi@hit.ac.zw')
set_font(run, size=Pt(9))

# Two-column body
body_section = doc.add_section(WD_SECTION.CONTINUOUS)
set_columns(body_section, 2, space='720')

# Introduction
add_body_heading(doc, 'Introduction')
add_paragraph(doc,
    'Electric motors keep factories moving. When one fails, an entire process line can stop. Conventional maintenance '
    'often runs on fixed calendars or waits for visible trouble. Both approaches miss early signs and can waste spare parts.')
add_paragraph(doc,
    'Condition based maintenance uses live measurements to decide when attention is needed. Current can be measured without '
    'touching the rotating shaft (Benbouzid, 2000). Vibration gives direct evidence of mechanical wear, imbalance and looseness '
    '(Gangsar and Tiwari, 2020). Many plants already use programmable logic controllers for motor control, so adding condition '
    'logic to the same PLC keeps monitoring affordable.')
add_paragraph(doc,
    'This paper proposes a PLC based multi sensor system for industrial induction motors. It combines electrical current and '
    'vibration evidence to detect abnormal states early.')

# Related Work
add_body_heading(doc, 'Related Work and Research Gap')
add_paragraph(doc,
    'Motor current signature analysis identifies abnormal patterns in stator current spectra (Benbouzid, 2000). Vibration analysis '
    'captures bearing defects, misalignment and looseness (Gangsar and Tiwari, 2020). Yang and Kim (2006) showed that combining '
    'the two signals improves fault decisions. Recent work has extended these methods to variable speed drives (Niu, 2023; '
    'Yakhni et al., 2023). Many advanced systems, however, still need specialist hardware or machine learning platforms that '
    'smaller factories cannot afford. The gap is a transparent, PLC centred method that fits existing control infrastructure.')

# Proposed System Architecture
add_body_heading(doc, 'Proposed System Architecture')
add_paragraph(doc,
    'The system has five layers: sensing, signal conditioning, feature extraction, PLC decision and HMI visualization. Current '
    'transformers and accelerometers collect signals. Filters and isolators condition them. The PLC compares extracted features '
    'against thresholds and fuses them. Sensor mounting matters; the accelerometer should sit near the bearing in a fixed radial '
    'direction, and operating speed, load and sampling settings must be logged (ISO, 2016).')

add_image_centered(doc, os.path.join(img_dir, 'fig1.png'), width=Inches(2.2))
cap1 = doc.add_paragraph()
cap1.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(cap1.add_run('Figure 1. Proposed PLC based multi sensor monitoring architecture.'), size=Pt(9))

# Signal Processing
add_body_heading(doc, 'Signal Processing and Fusion')
add_paragraph(doc,
    'For a sampled current window of N samples, the RMS current is')
add_image_centered(doc, os.path.join(img_dir, 'eq1.png'), width=Inches(2.0))
add_paragraph(doc,
    'Three phase imbalance is the largest phase deviation from the average current divided by the average. Vibration RMS is '
    'computed similarly, while crest factor links peak acceleration to RMS vibration:')
add_image_centered(doc, os.path.join(img_dir, 'eq2.png'), width=Inches(1.8))
add_paragraph(doc,
    'Spectral features come from the Fast Fourier Transform, with bin spacing delta f = F_s / N.')
add_paragraph(doc,
    'Each feature is normalised against a healthy baseline. The electrical indicator C and vibration indicator V are clipped to '
    '[0,1]. A weighted fusion score then combines them:')
add_image_centered(doc, os.path.join(img_dir, 'eq3.png'), width=Inches(2.0))
add_paragraph(doc,
    'If C = 0.65, V = 0.85, w_c = 0.40 and w_v = 0.60, then S = 0.77, which falls in the warning band when warning and critical '
    'thresholds are 0.60 and 0.80.')

add_image_centered(doc, os.path.join(img_dir, 'fig2.png'), width=Inches(3.0))
cap2 = doc.add_paragraph()
cap2.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(cap2.add_run('Figure 2. Signal processing and fusion chain from sensors to PLC decision.'), size=Pt(9))

# PLC Decision
add_body_heading(doc, 'PLC Decision and HMI')
add_paragraph(doc,
    'The PLC assigns one of four states. Normal means all features are within healthy limits. Warning means one feature has crossed '
    'its warning threshold for a persistence period. Critical means several features are abnormal or a severe threshold is passed. '
    'Sensor fault flags missing or saturated readings so the system does not decide from bad data. The HMI shows motor status, '
    'current and vibration RMS, condition state, alarm history and sensor health.')

# Table
table = doc.add_table(rows=1, cols=3)
table.style = 'Table Grid'
hdr_cells = table.rows[0].cells
headers = ['Condition', 'Current evidence', 'Vibration evidence']
for i, h in enumerate(headers):
    p = hdr_cells[i].paragraphs[0]
    run = p.add_run(h)
    set_font(run, size=Pt(9), bold=True)

table_data = [
    ('Healthy', 'Stable RMS and spectrum', 'Stable RMS and spectrum'),
    ('Overload', 'High RMS current', 'Load related increase'),
    ('Bearing wear', 'Modulation sidebands', 'RMS, crest factor and kurtosis rise'),
    ('Misalignment', 'Current variation', 'Axial/radial vibration increase'),
    ('Electrical fault', 'Imbalance or distortion', 'Secondary response'),
]
for row in table_data:
    cells = table.add_row().cells
    for i, val in enumerate(row):
        p = cells[i].paragraphs[0]
        set_font(p.add_run(val), size=Pt(9))

cap_t = doc.add_paragraph()
cap_t.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(cap_t.add_run('Table 1. Expected indicator behaviour for selected conditions.'), size=Pt(9))

# Validation
add_body_heading(doc, 'Validation and Discussion')
add_paragraph(doc,
    'Validation should start with healthy data at several loads. Controlled faults such as imbalance or misalignment are then '
    'introduced one at a time. Metrics include detection rate, false alarm rate, detection latency and monitoring availability '
    '(IEC, 2026). Figure 3 compares the proposed fused approach with current only and vibration only monitoring. The fused approach '
    'scores higher on both electrical and mechanical sensitivity. The main benefit is earlier warning without a separate specialist '
    'system. Limitations include motor specific baselines and the effects of sensor mounting, VFD switching and load variation.')

add_image_centered(doc, os.path.join(img_dir, 'fig3.png'), width=Inches(3.0))
cap3 = doc.add_paragraph()
cap3.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(cap3.add_run('Figure 3. Illustrative comparison of monitoring strategies. Values are not measured data.'), size=Pt(9))

# Conclusion
add_body_heading(doc, 'Conclusion')
add_paragraph(doc,
    'A PLC based multi sensor framework for industrial motor condition monitoring has been presented. It combines current and '
    'vibration evidence into transparent indicators and fuses them through simple PLC logic. The design uses existing automation '
    'infrastructure, making it accessible to factories that cannot yet invest in advanced analytics platforms. Future work should '
    'validate thresholds on a motor test rig and extend the system with temperature, voltage and speed information.')

# References
add_centered_heading(doc, 'References', size=Pt(10))
refs = [
    'Benbouzid, M.E.H. (2000) A review of induction motors signature analysis as a medium for faults detection, IEEE Transactions on Industrial Electronics, 47(5), pp. 984-993. doi:10.1109/41.873206.',
    'Gangsar, P. and Tiwari, R. (2020) Signal based condition monitoring techniques for fault detection and diagnosis of induction motors: a state of the art review, Mechanical Systems and Signal Processing, 144, p. 106908. doi:10.1016/j.ymssp.2020.106908.',
    'Yang, B.S. and Kim, K.J. (2006) Application of Dempster-Shafer theory in fault diagnosis of induction motors using vibration and current signals, Mechanical Systems and Signal Processing, 20(2), pp. 403-420. doi:10.1016/j.ymssp.2004.10.010.',
    'Niu, G. (2023) Motor fault diagnostics based on current signatures: a review, IEEE Transactions on Instrumentation and Measurement, 72, p. 3520919. doi:10.1109/TIM.2023.3285999.',
    'Yakhni, M.F., Cauet, S., Sakout, A., Assoum, H., Etien, E., Rambault, L. and El Gohary, M. (2023) Variable speed induction motors fault detection based on transient motor current signatures analysis: a review, Mechanical Systems and Signal Processing, 184, p. 109737. doi:10.1016/j.ymssp.2022.109737.',
    'ISO (2016) ISO 20816-1:2016 Mechanical vibration -- Measurement and evaluation of machine vibration -- Part 1: General guidelines. Geneva: International Organization for Standardization.',
    'IEC (2026) IEC 60034-1:2026 Rotating electrical machines -- Part 1: Rating and performance. Geneva: International Electrotechnical Commission.',
]
for ref in refs:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.first_line_indent = Cm(-0.5)
    p.paragraph_format.left_indent = Cm(0.5)
    set_font(p.add_run(ref), size=Pt(9))

doc.save('conference_paper_python.docx')
print('Created conference_paper_python.docx')
