"""Escreve o artigo DENTRO do modelo oficial de artigos da SBC.

O modelo (template/sbc_template.doc, baixado da mesma pasta do sbc_template.pdf que a professora indicou) foi
convertido para .docx pelo LibreOffice sem mudar nada (template/sbc_template-convertido.docx). Este script abre esse
arquivo, troca o texto da primeira página (título, autores, endereço, e-mails, Abstract, Keywords, Resumo e
Palavras-chave) mantendo os parágrafos originais, apaga o texto de exemplo e escreve o corpo clonando os parágrafos
do próprio modelo: "Heading 1", "Heading 2", "Normal" (1º parágrafo sem recuo; os seguintes começam com tabulação,
como no modelo), "Figure", "Legenda" (centralizada se cabe em uma linha; justificada, como a Figura 2 do modelo, se
não cabe) e "Reference". Assim estilos, fontes, espaçamentos, margens e seções são os do modelo.

Uso: python3 montar_docx.py saida.docx
"""
import copy
import importlib.util
import os
import re
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH as AL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt
from docx.text.paragraph import Paragraph

AQUI = os.path.dirname(os.path.abspath(__file__))
MODELO = os.path.join(AQUI, "template", "sbc_template-convertido.docx")
LARGURA_UTIL_CM = 21.0 - 2 * 3.0
spec = importlib.util.spec_from_file_location("conteudo", os.path.join(AQUI, "conteudo.py"))
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)

MULT = r"M(?:esforço|sequência|fantasma|grupo|defesa)"
MINUSCULAS = {"e", "de", "da", "do", "das", "dos", "a", "o", "as", "os", "em", "por", "com", "para", "no", "na", "ao"}


def iniciais(texto):
    """Iniciais maiúsculas (pedido da professora para tabelas), sem mexer em siglas e conectivos."""
    def palavra(i, w):
        nucleo = w.lstrip("(")
        if not nucleo or nucleo[0].isdigit() or any(ch.isupper() for ch in nucleo):
            return w
        if i > 0 and nucleo.lower() in MINUSCULAS:
            return w
        return w[: len(w) - len(nucleo)] + nucleo[0].upper() + nucleo[1:]
    return " ".join(palavra(i, w) for i, w in enumerate(texto.split(" ")))


def trocar_texto(p, texto):
    """Mantém o 1º run (com a formatação do modelo) e troca o texto; apaga os demais."""
    runs = p.runs
    for r in runs[1:]:
        r._r.getparent().remove(r._r)
    if runs:
        runs[0].text = texto
        runs[0].font.superscript = None
    else:
        p.add_run(texto)


def lingua(p, codigo):
    for r in p.runs:
        rpr = r._r.get_or_add_rPr()
        lang = rpr.find(qn("w:lang"))
        if lang is None:
            lang = OxmlElement("w:lang")
            rpr.append(lang)
        lang.set(qn("w:val"), codigo)


def borda(pai, lado, tam):
    el = OxmlElement(f"w:{lado}")
    el.set(qn("w:val"), "single")
    el.set(qn("w:sz"), tam)
    el.set(qn("w:space"), "0")
    el.set(qn("w:color"), "000000")
    pai.append(el)


def montar(saida):
    doc = Document(MODELO)
    P = doc.paragraphs
    proto = {
        "h1": copy.deepcopy(P[11]._p), "h2": copy.deepcopy(P[21]._p),
        "p": copy.deepcopy(P[12]._p), "fig": copy.deepcopy(P[25]._p),
        "leg": copy.deepcopy(P[26]._p), "leg_longa": copy.deepcopy(P[28]._p),
        "ref": copy.deepcopy(P[38]._p),
    }
    for el in proto.values():
        for filho in list(el):
            if filho.tag != qn("w:pPr"):
                el.remove(filho)

    # ---- primeira página: os parágrafos do próprio modelo, com o texto trocado
    titulo, autores, end1, end2, end3, email = P[0], P[1], P[2], P[3], P[4], P[5]
    trocar_texto(titulo, C.TITULO)
    trocar_texto(autores, C.AUTORES)
    # uma instituição só: um parágrafo de endereço (estilo Address do modelo), com quebra de linha como no modelo
    trocar_texto(end2, C.ENDERECO[0])
    for linha in C.ENDERECO[1:]:
        r = end2.runs[0]
        r.add_break()
        r.add_text(linha)
    for p in (end1, end3):
        p._p.getparent().remove(p._p)
    trocar_texto(email, C.EMAILS)

    abstract, keywords, resumo, palavras = P[7], P[8], P[9], P[10]
    for p, rotulo, texto in ((abstract, "Abstract.", C.ABSTRACT), (resumo, "Resumo.", C.RESUMO)):
        runs = p.runs
        runs[0].text = rotulo
        runs[1].text = " " + texto
        for r in runs[2:]:
            r._r.getparent().remove(r._r)
    for p, texto in ((keywords, C.KEYWORDS), (palavras, C.PALAVRAS_CHAVE)):
        p.runs[-1].text = texto
    for p in (titulo, autores, end2, email, resumo, palavras):
        lingua(p, "pt-BR")

    # ---- apaga o texto de exemplo do modelo (do "1. General Information" até o fim), mantendo a seção final
    corpo = doc.element.body
    inicio = P[11]._p
    apagar, achou = [], False
    for el in list(corpo):
        if el is inicio:
            achou = True
        if achou and el.tag != qn("w:sectPr"):
            apagar.append(el)
    for el in apagar:
        corpo.remove(el)
    fim = corpo.find(qn("w:sectPr"))

    def novo(tipo, texto="", tab=False):
        el = copy.deepcopy(proto[tipo])
        fim.addprevious(el)
        p = Paragraph(el, doc._body)
        if texto:
            p.add_run(("\t" if tab else "") + texto)
        lingua(p, "pt-BR")
        return p

    def legenda(texto):
        # modelo, Seção 5: centralizada se cabe em uma linha; senão justificada (como a Figura 2 do modelo)
        return novo("leg" if len(texto) <= 72 else "leg_longa", texto)

    depois_de_titulo = True
    for b in C.B:
        tipo = b[0]
        if tipo in ("h1", "h2"):
            novo(tipo, b[1])
            depois_de_titulo = True
        elif tipo == "p":
            novo("p", b[1], tab=not depois_de_titulo)
            depois_de_titulo = False
        elif tipo == "formula":
            p = novo("p")
            p.alignment = AL.CENTER
            for pedaco in re.split(f"({MULT})", b[1]):
                if re.fullmatch(MULT, pedaco):
                    p.add_run("M").italic = True
                    sub = p.add_run(pedaco[1:])
                    sub.italic, sub.font.subscript = True, True
                elif pedaco:
                    p.add_run(pedaco).italic = True
            lingua(p, "pt-BR")
        elif tipo == "fig":
            _, arquivo, texto, largura = b
            p = novo("fig")
            p.paragraph_format.keep_with_next = True
            p.add_run().add_picture(os.path.join(AQUI, arquivo), width=Cm(min(largura, LARGURA_UTIL_CM)))
            legenda(texto)
        elif tipo == "tab":
            _, texto, linhas, larguras = b
            leg = legenda(texto)
            leg.paragraph_format.keep_with_next = True
            t = doc.add_table(rows=len(linhas), cols=len(linhas[0]))
            fim.addprevious(t._tbl)
            t.alignment = WD_TABLE_ALIGNMENT.CENTER
            # modelo, Seção 5: sem fundos e sem molduras desnecessárias -> só as linhas horizontais de abertura,
            # do cabeçalho e de fechamento
            bordas = OxmlElement("w:tblBorders")
            borda(bordas, "top", "8")
            borda(bordas, "bottom", "8")
            t._tbl.tblPr.append(bordas)
            if larguras:
                t.autofit = False
                fator = min(1.0, LARGURA_UTIL_CM / sum(larguras))
                larguras = [w * fator for w in larguras]
                for col, w in zip(t._tbl.tblGrid.findall(qn("w:gridCol")), larguras):
                    col.set(qn("w:w"), str(int(Cm(w).twips)))
            ultima = len(linhas) - 1
            total = linhas[ultima][0].startswith("Total")
            for linha_xml in t._tbl.tr_lst:  # linha da tabela nunca se divide entre duas páginas
                trpr = linha_xml.get_or_add_trPr()
                trpr.append(OxmlElement("w:cantSplit"))
            for i, linha in enumerate(linhas):
                for j, valor in enumerate(linha):
                    cel = t.cell(i, j)
                    if larguras:
                        cel.width = Cm(larguras[j])
                    if i == 0 or (i == ultima and total):
                        b_ = OxmlElement("w:tcBorders")
                        borda(b_, "bottom" if i == 0 else "top", "4")
                        cel._tc.get_or_add_tcPr().append(b_)
                    p = cel.paragraphs[0]
                    p.style = doc.styles["Normal"]
                    pf = p.paragraph_format
                    pf.space_before, pf.space_after, pf.alignment = Pt(1), Pt(1), AL.LEFT
                    pf.keep_with_next = i < ultima
                    r = p.add_run(iniciais(valor) if (i == 0 or j == 0) else valor)
                    r.font.size = Pt(10)
                    r.bold = i == 0 or (i == ultima and total)
                    lingua(p, "pt-BR")
            depois_de_titulo = False

    novo("h1", C.TITULO_REFERENCIAS)
    for ref in C.REFERENCIAS:
        novo("ref", ref)

    props = doc.core_properties
    props.title, props.author, props.language = C.TITULO, C.AUTORES, "pt-BR"
    props.subject = props.keywords = props.comments = ""
    doc.save(saida)


if __name__ == "__main__":
    montar(sys.argv[1] if len(sys.argv) > 1 else "artigo.docx")
