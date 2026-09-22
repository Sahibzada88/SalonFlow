from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from io import BytesIO


def generate_invoice_pdf(invoice_data: dict) -> BytesIO:
    """
    Generate a professional invoice PDF
    """

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()
    story = []

    # ===== PALETTE =====
    ink = colors.HexColor('#111827')          # near-black text
    muted = colors.HexColor('#6B7280')        # secondary text
    faint = colors.HexColor('#9CA3AF')        # footer text
    primary = colors.HexColor('#0F172A')      # deep navy (brand)
    accent = colors.HexColor('#2563EB')       # accent blue
    row_alt = colors.HexColor('#F8FAFC')      # zebra striping
    border = colors.HexColor('#E5E7EB')
    total_bg = colors.HexColor('#0F172A')

    # ===== HEADER: brand block + invoice meta side by side =====
    company_style = ParagraphStyle(
        'CompanyStyle', parent=styles['Heading1'],
        fontSize=22, textColor=primary, fontName='Helvetica-Bold',
        alignment=TA_LEFT, spaceAfter=2,
    )
    tagline_style = ParagraphStyle(
        'TaglineStyle', parent=styles['Normal'],
        fontSize=9, textColor=muted, fontName='Helvetica',
        alignment=TA_LEFT,
    )
    brand_block = [
        Paragraph("SALONFLOW", company_style),
        Paragraph("Salon Management Made Simple", tagline_style),
    ]

    inv_title_style = ParagraphStyle(
        'InvTitleStyle', parent=styles['Normal'],
        fontSize=20, textColor=ink, fontName='Helvetica-Bold',
        alignment=TA_RIGHT, spaceAfter=2, leading=22,
    )
    inv_num_style = ParagraphStyle(
        'InvNumStyle', parent=styles['Normal'],
        fontSize=10, textColor=muted, fontName='Helvetica',
        alignment=TA_RIGHT,
    )
    meta_block = [
        Paragraph("INVOICE", inv_title_style),
        Paragraph(f"#{invoice_data.get('invoice_number', 'N/A')}", inv_num_style),
    ]

    header_table = Table(
        [[brand_block, meta_block]],
        colWidths=[doc.width * 0.55, doc.width * 0.45],
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.35 * cm))
    story.append(HRFlowable(width="100%", thickness=1.4, color=primary))
    story.append(Spacer(1, 0.6 * cm))

    # ===== INFO STRIP: Bill To / Invoice details side by side =====
    label_style = ParagraphStyle(
        'LabelStyle', parent=styles['Normal'],
        fontSize=8.5, textColor=muted, fontName='Helvetica-Bold',
        spaceAfter=4,
    )
    value_style = ParagraphStyle(
        'ValueStyle', parent=styles['Normal'],
        fontSize=10, textColor=ink, fontName='Helvetica',
        leading=14,
    )
    value_style_r = ParagraphStyle(
        'ValueStyleR', parent=value_style, alignment=TA_RIGHT,
    )
    label_style_r = ParagraphStyle(
        'LabelStyleR', parent=label_style, alignment=TA_RIGHT,
    )

    customer_lines = []
    if invoice_data.get('customer_name'):
        customer_lines.append(f"<b>{invoice_data['customer_name']}</b>")
    if invoice_data.get('customer_phone'):
        customer_lines.append(invoice_data['customer_phone'])
    if invoice_data.get('customer_email'):
        customer_lines.append(invoice_data['customer_email'])
    if not customer_lines:
        customer_lines.append("Customer information not available")

    bill_to_block = [
        Paragraph("BILL TO", label_style),
        Paragraph("<br/>".join(customer_lines), value_style),
    ]

    details_block = [
        Paragraph("INVOICE DETAILS", label_style_r),
        Paragraph(
            f"Date: {invoice_data.get('date', 'N/A')}<br/>"
            f"Payment: {invoice_data.get('payment_method', 'N/A').title()}<br/>"
            f"Status: <b>{invoice_data.get('status', 'N/A').title()}</b>",
            value_style_r,
        ),
    ]

    info_strip = Table(
        [[bill_to_block, details_block]],
        colWidths=[doc.width * 0.55, doc.width * 0.45],
    )
    info_strip.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(info_strip)
    story.append(Spacer(1, 0.7 * cm))

    # ===== ITEMS TABLE =====
    items = invoice_data.get('items', [])
    col_widths = [doc.width * 0.46, doc.width * 0.12, doc.width * 0.21, doc.width * 0.21]

    cell_style = ParagraphStyle(
        'CellStyle', parent=styles['Normal'], fontSize=9.5, textColor=ink, leading=13,
    )
    cell_style_r = ParagraphStyle('CellStyleR', parent=cell_style, alignment=TA_RIGHT)
    head_style = ParagraphStyle(
        'HeadStyle', parent=styles['Normal'], fontSize=8.5,
        textColor=colors.white, fontName='Helvetica-Bold',
    )
    head_style_r = ParagraphStyle('HeadStyleR', parent=head_style, alignment=TA_RIGHT)

    if items:
        items_header = [
            Paragraph("DESCRIPTION", head_style),
            Paragraph("QTY", head_style_r),
            Paragraph("UNIT PRICE", head_style_r),
            Paragraph("AMOUNT", head_style_r),
        ]
        items_rows = []
        for item in items:
            items_rows.append([
                Paragraph(item.get('description', ''), cell_style),
                Paragraph(str(item.get('quantity', 1)), cell_style_r),
                Paragraph(f"Rs. {item.get('unit_price', 0):,}", cell_style_r),
                Paragraph(f"Rs. {item.get('total', 0):,}", cell_style_r),
            ])

        table_data = [items_header] + items_rows
        items_table = Table(table_data, colWidths=col_widths, repeatRows=1)

        style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), primary),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('LINEBELOW', (0, 0), (-1, 0), 0, primary),
            ('LINEBELOW', (0, 1), (-1, -1), 0.5, border),
        ]
        # zebra striping on body rows
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                style_cmds.append(('BACKGROUND', (0, i), (-1, i), row_alt))
            else:
                style_cmds.append(('BACKGROUND', (0, i), (-1, i), colors.white))

        items_table.setStyle(TableStyle(style_cmds))
        story.append(items_table)
    else:
        no_items_style = ParagraphStyle(
            'NoItemsStyle', parent=styles['Normal'], fontSize=10,
            textColor=muted, alignment=TA_CENTER,
        )
        story.append(Spacer(1, 0.3 * cm))
        story.append(Paragraph("No items found in this invoice.", no_items_style))

    story.append(Spacer(1, 0.6 * cm))

    # ===== TOTALS =====
    label_col = ParagraphStyle(
        'TotalsLabel', parent=styles['Normal'], fontSize=10,
        textColor=muted, fontName='Helvetica', alignment=TA_RIGHT,
    )
    value_col = ParagraphStyle(
        'TotalsValue', parent=styles['Normal'], fontSize=10,
        textColor=ink, fontName='Helvetica', alignment=TA_RIGHT,
    )

    totals_rows = [
        ["Subtotal", f"Rs. {invoice_data.get('subtotal', 0):,}"],
        ["Discount", f"- Rs. {invoice_data.get('discount', 0):,}"],
        ["Tax", f"Rs. {invoice_data.get('tax', 0):,}"],
    ]
    totals_data = [[Paragraph(l, label_col), Paragraph(v, value_col)] for l, v in totals_rows]

    totals_table = Table(totals_data, colWidths=[3.5 * cm, 4 * cm])
    totals_table.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, -1), (-1, -1), 0.5, border),
    ]))

    # Grand total pill, right-aligned under the totals
    total_label_style = ParagraphStyle(
        'TotalLabel', parent=styles['Normal'], fontSize=11,
        textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_LEFT,
    )
    total_value_style = ParagraphStyle(
        'TotalValue', parent=styles['Normal'], fontSize=14,
        textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_RIGHT,
    )
    grand_total_table = Table(
        [[Paragraph("TOTAL DUE", total_label_style),
          Paragraph(f"Rs. {invoice_data.get('total', 0):,}", total_value_style)]],
        colWidths=[3.5 * cm, 4 * cm],
    )
    grand_total_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), total_bg),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))

    totals_stack = Table([[totals_table], [Spacer(1, 0.15 * cm)], [grand_total_table]])
    totals_stack.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    totals_wrapper = Table([[totals_stack]], colWidths=[doc.width])
    totals_wrapper.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'RIGHT'),
        ('VALIGN', (0, 0), (0, 0), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(totals_wrapper)

    # ===== NOTES =====
    if invoice_data.get('notes'):
        story.append(Spacer(1, 0.6 * cm))
        notes_label_style = ParagraphStyle(
            'NotesLabel', parent=styles['Normal'], fontSize=8.5,
            textColor=muted, fontName='Helvetica-Bold', spaceAfter=3,
        )
        notes_style = ParagraphStyle(
            'NotesStyle', parent=styles['Normal'], fontSize=9.5,
            textColor=ink, fontName='Helvetica', leading=13,
        )
        story.append(Paragraph("NOTES", notes_label_style))
        story.append(Paragraph(invoice_data['notes'], notes_style))

    # ===== FOOTER =====
    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=0.75, color=border))
    story.append(Spacer(1, 0.3 * cm))

    footer_style = ParagraphStyle(
        'FooterStyle', parent=styles['Normal'], fontSize=9,
        textColor=colors.HexColor('#374151'), alignment=TA_CENTER,
        fontName='Helvetica-Bold', spaceAfter=2,
    )
    footer_sub_style = ParagraphStyle(
        'FooterSubStyle', parent=styles['Normal'], fontSize=8,
        textColor=faint, alignment=TA_CENTER, fontName='Helvetica',
    )
    story.append(Paragraph("Thank you for your business!", footer_style))
    story.append(Paragraph("Generated by SalonFlow", footer_sub_style))

    doc.build(story)
    buffer.seek(0)
    return buffer