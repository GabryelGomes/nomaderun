"""Monta o artigo em .docx com os estilos do modelo de artigos da SBC.

As medidas seguem o próprio modelo (docs/artigo/sbc/sbc_template.pdf): A4, margens 3,5/2,5/3,0 cm, Times 12 com
6 pt antes de cada parágrafo, título 16 negrito com 12 pt antes, autores 12 negrito, endereço 12, e-mails em
Courier New 10 (6 pt antes e depois), Abstract/Resumo em itálico com recuo de 0,8 cm, seções 13 negrito com 12 pt
antes, subseções 12 negrito, recuo de 1,27 cm a partir do 2º parágrafo, legendas Helvetica 10 negrito (6 pt antes e
depois; centralizadas se cabem em uma linha, senão justificadas com 0,8 cm) e referências 12 com 6 pt antes e
recuo de 0,5 cm a partir da 2ª linha.

Uso: python3 montar_docx.py saida.docx
"""
import importlib.util
import os
import re
import sys

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH as AL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

AQUI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("conteudo", os.path.join(AQUI, "conteudo.py"))
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)

TIMES, HELV, COURIER = "Times New Roman", "Helvetica", "Courier New"
LARGURA_UTIL_CM = 21.0 - 2 * 3.0


def fontes(rpr_owner, nome):
    rpr = rpr_owner.get_or_add_rPr()
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts")
        rpr.insert(0, rf)
    for k in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rf.set(qn(k), nome)
    for k in ("w:asciiTheme", "w:hAnsiTheme", "w:cstheme", "w:eastAsiaTheme"):
        if rf.get(qn(k)) is not None:
            del rf.attrib[qn(k)]


def estilo(doc, nome, *, fonte=TIMES, tam=12, negrito=False, italico=False, alinh=AL.JUSTIFY, antes=6, depois=0,
           recuo1=0.0, esq=0.0, dir_=0.0, base="Normal", manter_prox=False):
    st = doc.styles[nome] if nome in [s.name for s in doc.styles] else doc.styles.add_style(nome, WD_STYLE_TYPE.PARAGRAPH)
    if nome != "Normal":
        st.base_style = doc.styles[base]
    f = st.font
    f.name, f.size, f.bold, f.italic = fonte, Pt(tam), negrito, italico
    f.color.rgb = RGBColor(0, 0, 0)
    fontes(st.element, fonte)
    pf = st.paragraph_format
    pf.alignment, pf.space_before, pf.space_after = alinh, Pt(antes), Pt(depois)
    pf.first_line_indent, pf.left_indent, pf.right_indent = Cm(recuo1), Cm(esq), Cm(dir_)
    pf.line_spacing = 1.0
    pf.keep_with_next = manter_prox
    pf.widow_control = True
    ppr = st.element.get_or_add_pPr()
    bdr = ppr.find(qn("w:pBdr"))
    if bdr is not None:
        ppr.remove(bdr)
    return st


def montar(saida):
    doc = Document()
    for s in doc.sections:
        s.page_width, s.page_height = Cm(21.0), Cm(29.7)
        s.top_margin, s.bottom_margin = Cm(3.5), Cm(2.5)
        s.left_margin, s.right_margin = Cm(3.0), Cm(3.0)
        s.header_distance = s.footer_distance = Cm(1.25)

    estilo(doc, "Normal")
    estilo(doc, "Title", tam=16, negrito=True, alinh=AL.CENTER, antes=12, depois=0)
    estilo(doc, "Author", negrito=True, alinh=AL.CENTER, antes=12, depois=0)
    estilo(doc, "Address", alinh=AL.CENTER, antes=0, depois=0)
    estilo(doc, "Email", fonte=COURIER, tam=10, alinh=AL.CENTER, antes=6, depois=6)
    estilo(doc, "Abstract", italico=True, antes=12, depois=0, esq=0.8, dir_=0.8)
    estilo(doc, "Heading 1", tam=13, negrito=True, alinh=AL.LEFT, antes=12, depois=0, manter_prox=True)
    estilo(doc, "Heading 2", negrito=True, alinh=AL.LEFT, antes=12, depois=0, manter_prox=True)
    estilo(doc, "First Paragraph")
    estilo(doc, "Body Text", recuo1=1.27)
    estilo(doc, "Caption", fonte=HELV, tam=10, negrito=True, alinh=AL.CENTER, antes=6, depois=6)
    estilo(doc, "Caption Long", fonte=HELV, tam=10, negrito=True, alinh=AL.JUSTIFY, antes=6, depois=6, esq=0.8,
           dir_=0.8, base="Caption")
    estilo(doc, "Figure", alinh=AL.CENTER, antes=6, depois=0, manter_prox=True)
    estilo(doc, "Formula", italico=True, alinh=AL.CENTER)
    estilo(doc, "Reference", alinh=AL.LEFT, recuo1=-0.5, esq=0.5)
    estilo(doc, "Table Text", tam=10, alinh=AL.LEFT, antes=1, depois=1)
    for nome in ("Caption", "Caption Long"):
        doc.styles[nome].paragraph_format.keep_with_next = False

    def par(texto, nome):
        p = doc.add_paragraph(style=nome)
        if texto:
            p.add_run(texto)
        return p

    def legenda(texto, tabela):
        # "centered if less than one line, otherwise justified and indented by 0.8cm" (modelo SBC, Seção 5)
        uma_linha = len(texto) <= 88
        p = par(texto, "Caption" if uma_linha else "Caption Long")
        p.paragraph_format.keep_with_next = tabela
        return p

    # Primeira página
    doc.paragraphs[0]._element.getparent().remove(doc.paragraphs[0]._element) if doc.paragraphs else None
    par(C.TITULO, "Title")
    par(C.AUTORES, "Author")
    enderecos = list(C.ENDERECO)
    primeiro = par(enderecos[0], "Address")
    primeiro.paragraph_format.space_before = Pt(12)
    for e in enderecos[1:]:
        par(e, "Address")
    par(C.EMAILS, "Email")
    for rotulo, texto in (("Abstract.", C.ABSTRACT), ("Resumo.", C.RESUMO)):
        p = doc.add_paragraph(style="Abstract")
        r = p.add_run(rotulo)
        r.bold = True
        p.add_run(" " + texto)

    # Corpo
    depois_de_titulo = False
    for b in C.B:
        tipo = b[0]
        if tipo in ("h1", "h2"):
            par(b[1], "Heading 1" if tipo == "h1" else "Heading 2")
            depois_de_titulo = True
        elif tipo == "p":
            par(b[1], "First Paragraph" if depois_de_titulo else "Body Text")
            depois_de_titulo = False
        elif tipo == "formula":
            # "M" seguido do nome do multiplicador vira M com o nome subscrito
            f = par("", "Formula")
            for pedaco in re.split(r"(M(?:esforço|sequência|fantasma|grupo|defesa))", b[1]):
                if re.fullmatch(r"M(?:esforço|sequência|fantasma|grupo|defesa)", pedaco):
                    f.add_run("M")
                    f.add_run(pedaco[1:]).font.subscript = True
                elif pedaco:
                    f.add_run(pedaco)
        elif tipo == "fig":
            _, arquivo, texto, largura = b
            p = par("", "Figure")
            p.add_run().add_picture(os.path.join(AQUI, arquivo), width=Cm(min(largura, LARGURA_UTIL_CM)))
            legenda(texto, tabela=False)
        elif tipo == "tab":
            _, texto, linhas, larguras = b
            legenda(texto, tabela=True)
            t = doc.add_table(rows=len(linhas), cols=len(linhas[0]))
            t.alignment = WD_TABLE_ALIGNMENT.CENTER
            bordas = OxmlElement("w:tblBorders")
            for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
                el = OxmlElement(f"w:{lado}")
                el.set(qn("w:val"), "single")
                el.set(qn("w:sz"), "4")
                el.set(qn("w:space"), "0")
                el.set(qn("w:color"), "000000")
                bordas.append(el)
            t._tbl.tblPr.append(bordas)
            if larguras:
                t.autofit = False
                fator = min(1.0, LARGURA_UTIL_CM / sum(larguras))
                larguras = [w * fator for w in larguras]
                for col, w in zip(t._tbl.tblGrid.findall(qn("w:gridCol")), larguras):
                    col.set(qn("w:w"), str(int(Cm(w).twips)))
            for i, linha in enumerate(linhas):
                for j, valor in enumerate(linha):
                    cel = t.cell(i, j)
                    if larguras:
                        cel.width = Cm(larguras[j])
                    p = cel.paragraphs[0]
                    p.style = doc.styles["Table Text"]
                    p.paragraph_format.keep_with_next = i < len(linhas) - 1
                    r = p.add_run(valor)
                    r.bold = i == 0 or (i == len(linhas) - 1 and linhas[i][0].startswith("Total"))
            depois_de_titulo = False

    par("Referências", "Heading 1")
    for ref in C.REFERENCIAS:
        par(ref, "Reference")

    props = doc.core_properties
    props.title = C.TITULO
    props.author = C.AUTORES
    props.language = "pt-BR"
    doc.save(saida)


if __name__ == "__main__":
    montar(sys.argv[1] if len(sys.argv) > 1 else "artigo.docx")
